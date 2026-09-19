import { prisma } from "../db.config.js";
import {
  responseFromCompletedUserMission,
  responseFromMission,
  responseFromMyMissions,
  responseFromStoreMissions,
  responseFromUserMission,
} from "../dtos/mission.dto.js";
import {
  DuplicateMissionChallengeError,
  MissionNotFoundError,
  MissionNotOpenError,
  MissionQuotaExceededError,
  PaidAmountRequiredError,
  StoreNotActiveError,
  StoreNotFoundError,
  UserMissionExpiredError,
  UserMissionNotFoundError,
  UserMissionNotInProgressError,
} from "../errors.js";
import {
  ACTIVE_USER_MISSION_STATUSES,
  claimMissionQuota,
  completeUserMission,
  existsActiveUserMission,
  findMissionById,
  findUserMissionById,
  getAllActiveUserMissions,
  getAllStoreMissions,
  insertMission,
  insertUserMission,
} from "../repositories/mission.repository.js";
import { findStoreById } from "../repositories/store.repository.js";
import {
  increaseRegionSuccessCount,
  increaseUserPoint,
  insertPointTransaction,
} from "../repositories/user.repository.js";
import { PAGE_FETCH_SIZE } from "../utils/pagination.js";
import { violatedUniqueConstraint } from "../utils/prisma-error.js";
import { resolveCurrentUserId } from "./user.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const addMission = async (data) => {
  const store = await findStoreById(data.storeId);
  if (!store) {
    throw new StoreNotFoundError({ storeId: data.storeId });
  }
  if (store.status !== "ACTIVE") {
    throw new StoreNotActiveError({ storeId: data.storeId, status: store.status });
  }

  // 미션의 지역은 가게가 속한 지역을 따른다.
  const missionId = await insertMission({ ...data, regionId: store.region_id });
  const mission = await findMissionById(missionId);

  return responseFromMission(mission);
};

export const challengeMission = async (data) => {
  const userId = await resolveCurrentUserId(data.userId);

  // $transaction의 콜백이 정상 종료하면 commit, 에러를 던지면 rollback 된다.
  //
  // 격리 수준을 READ COMMITTED로 낮추는 이유는 아래 중복 도전 검사 때문이다.
  // MySQL 기본값인 REPEATABLE READ에서는 트랜잭션이 처음 읽은 시점의 스냅샷을 계속 보여줘서,
  // 바로 직전에 커밋된 다른 사람의 도전 기록이 검사에서 빠질 수 있다.
  const userMissionId = await prisma.$transaction(async (tx) => {
    const mission = await findMissionById(data.missionId, { tx });
    if (!mission) {
      throw new MissionNotFoundError({ missionId: data.missionId });
    }

    const now = new Date();
    const isOpen =
      mission.status === "OPEN" &&
      mission.opened_at <= now &&
      (mission.closed_at === null || now < mission.closed_at);
    if (!isOpen) {
      throw new MissionNotOpenError({ missionId: mission.id, status: mission.status });
    }

    // 선착순 자리를 먼저 차지한다. (조회 -> 검사 -> 증가로 나누면 그 사이에 다른 요청이 끼어들 수 있다)
    // 이 UPDATE가 미션 row에 잠금을 걸어 주므로, 같은 미션에 동시에 들어온 도전 요청은
    // 아래 중복 검사를 순서대로(직전 요청이 커밋된 뒤에) 수행하게 된다.
    if (!(await claimMissionQuota(tx, mission.id))) {
      throw new MissionQuotaExceededError({
        missionId: mission.id,
        totalQuota: mission.total_quota,
      });
    }

    // 도전하려는 미션이 이미 도전 중인지 검증
    // (여기서 오류를 던지면 트랜잭션이 롤백되면서 위에서 올린 발급 수도 함께 되돌아간다)
    if (await existsActiveUserMission(tx, userId, mission.id)) {
      throw new DuplicateMissionChallengeError({ missionId: mission.id, userId });
    }

    // 도전 기한은 도전 가능 일수만큼이지만, 미션 마감일을 넘을 수는 없다.
    let expiresAt = new Date(now.getTime() + mission.challenge_days * DAY_MS);
    if (mission.closed_at !== null && mission.closed_at < expiresAt) {
      expiresAt = mission.closed_at;
    }

    try {
      return await insertUserMission(tx, {
        userId,
        missionId: mission.id,
        storeId: mission.store_id,
        regionId: mission.region_id,
        rewardType: mission.reward_type,
        rewardPoint: mission.reward_point,
        rewardRate: mission.reward_rate,
        expiresAt,
      });
    } catch (err) {
      // user_missions에는 (user_id, mission_id, active_flag) 유니크 제약(uk_um_active)이 걸려 있다.
      // 위의 검사를 통과한 요청 두 개가 거의 동시에 INSERT하면 여기서 걸리므로,
      // DB 제약 오류를 500으로 흘려보내지 않고 중복 도전 오류로 바꿔 던진다.
      if (violatedUniqueConstraint(err) === "uk_um_active") {
        throw new DuplicateMissionChallengeError({ missionId: mission.id, userId });
      }
      throw err;
    }
  }, { isolationLevel: "ReadCommitted" });

  const userMission = await findUserMissionById(userMissionId);
  return responseFromUserMission(userMission);
};

export const listStoreMissions = async (storeId, cursor) => {
  const store = await findStoreById(storeId);
  if (!store) {
    throw new StoreNotFoundError({ storeId });
  }

  const missions = await getAllStoreMissions(storeId, cursor, PAGE_FETCH_SIZE);
  return responseFromStoreMissions(missions);
};

export const listMyMissions = async (requestUserId, cursor) => {
  const userId = await resolveCurrentUserId(requestUserId);

  const userMissions = await getAllActiveUserMissions(userId, cursor, PAGE_FETCH_SIZE);
  return responseFromMyMissions(userMissions);
};

// POINT 미션은 정해진 포인트를, RATE 미션은 결제 금액의 reward_rate(%)만큼을 지급한다. (소수점 이하는 버림)
const calculateEarnedPoint = (userMission, paidAmount) => {
  if (userMission.reward_type === "POINT") {
    return userMission.reward_point ?? 0;
  }

  if (paidAmount === undefined) {
    throw new PaidAmountRequiredError({ userMissionId: userMission.id });
  }
  return Math.floor((paidAmount * Number(userMission.reward_rate)) / 100);
};

export const completeMission = async (data) => {
  const userId = await resolveCurrentUserId(data.userId);

  const pointBalance = await prisma.$transaction(async (tx) => {
    const userMission = await findUserMissionById(data.userMissionId, { tx });
    // 다른 사용자의 미션은 존재 여부도 알려주지 않는다.
    // (DB의 id는 BigInt, 요청으로 받은 id는 number일 수 있어서 BigInt로 맞춰 비교한다)
    if (!userMission || userMission.user_id !== BigInt(userId)) {
      throw new UserMissionNotFoundError({ userMissionId: data.userMissionId });
    }
    if (!ACTIVE_USER_MISSION_STATUSES.includes(userMission.status)) {
      throw new UserMissionNotInProgressError({
        userMissionId: userMission.id,
        status: userMission.status,
      });
    }
    if (userMission.expires_at <= new Date()) {
      throw new UserMissionExpiredError({
        userMissionId: userMission.id,
        expiresAt: userMission.expires_at,
      });
    }

    const earnedPoint = calculateEarnedPoint(userMission, data.paidAmount);

    // 완료 처리는 "아직 진행 중이고 기한이 남아 있을 때만" 이라는 조건과 함께 한 번에 수행한다.
    // 같은 요청이 동시에 두 번 들어오면 먼저 도착한 쪽만 성공하고, 나머지는 여기서 걸러진다.
    const completed = await completeUserMission(tx, userMission.id, {
      earnedPoint,
      paidAmount: data.paidAmount,
    });
    if (!completed) {
      throw new UserMissionNotInProgressError({
        userMissionId: userMission.id,
        status: userMission.status,
      });
    }
    const balanceAfter = await increaseUserPoint(tx, userId, earnedPoint);
    await insertPointTransaction(tx, {
      userId,
      amount: earnedPoint,
      balanceAfter,
      type: "MISSION_REWARD",
      sourceType: "USER_MISSION",
      sourceId: userMission.id,
      description: `${userMission.store_name} 미션 성공`,
    });
    await increaseRegionSuccessCount(tx, userId, userMission.region_id);

    return balanceAfter;
  });

  const userMission = await findUserMissionById(data.userMissionId);
  return responseFromCompletedUserMission(userMission, pointBalance);
};
