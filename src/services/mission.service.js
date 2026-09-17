import { prisma } from "../db.config.js";
import {
  responseFromCompletedUserMission,
  responseFromMission,
  responseFromMyMissions,
  responseFromStoreMissions,
  responseFromUserMission,
} from "../dtos/mission.dto.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.js";
import {
  ACTIVE_USER_MISSION_STATUSES,
  completeUserMission,
  existsActiveUserMission,
  findMissionById,
  findUserMissionById,
  getAllActiveUserMissions,
  getAllStoreMissions,
  increaseMissionIssuedCount,
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
import { resolveCurrentUserId } from "./user.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const addMission = async (data) => {
  const store = await findStoreById(data.storeId);
  if (!store) {
    throw new NotFoundError("존재하지 않는 가게입니다.");
  }
  if (store.status !== "ACTIVE") {
    throw new BadRequestError("영업 중인 가게에만 미션을 추가할 수 있습니다.");
  }

  // 미션의 지역은 가게가 속한 지역을 따른다.
  const missionId = await insertMission({ ...data, regionId: store.region_id });
  const mission = await findMissionById(missionId);

  return responseFromMission(mission);
};

export const challengeMission = async (data) => {
  const userId = await resolveCurrentUserId(data.userId);

  // $transaction의 콜백이 정상 종료하면 commit, 에러를 던지면 rollback 된다.
  const userMissionId = await prisma.$transaction(async (tx) => {
    // 같은 미션에 동시에 도전 요청이 들어와도 중복 검사와 발급 수 증가가 꼬이지 않도록 미션 row를 잠근다.
    const mission = await findMissionById(data.missionId, {
      tx,
      forUpdate: true,
    });
    if (!mission) {
      throw new NotFoundError("존재하지 않는 미션입니다.");
    }

    const now = new Date();
    const isOpen =
      mission.status === "OPEN" &&
      mission.opened_at <= now &&
      (mission.closed_at === null || now < mission.closed_at);
    if (!isOpen) {
      throw new BadRequestError("현재 도전할 수 없는 미션입니다.");
    }

    if (
      mission.total_quota !== null &&
      mission.issued_count >= mission.total_quota
    ) {
      throw new ConflictError("선착순 인원이 마감된 미션입니다.");
    }

    // 도전하려는 미션이 이미 도전 중인지 검증
    if (await existsActiveUserMission(tx, userId, mission.id)) {
      throw new ConflictError("이미 도전 중인 미션입니다.");
    }

    // 도전 기한은 도전 가능 일수만큼이지만, 미션 마감일을 넘을 수는 없다.
    let expiresAt = new Date(now.getTime() + mission.challenge_days * DAY_MS);
    if (mission.closed_at !== null && mission.closed_at < expiresAt) {
      expiresAt = mission.closed_at;
    }

    const newUserMissionId = await insertUserMission(tx, {
      userId,
      missionId: mission.id,
      storeId: mission.store_id,
      regionId: mission.region_id,
      rewardType: mission.reward_type,
      rewardPoint: mission.reward_point,
      rewardRate: mission.reward_rate,
      expiresAt,
    });
    await increaseMissionIssuedCount(tx, mission.id);

    return newUserMissionId;
  });

  const userMission = await findUserMissionById(userMissionId);
  return responseFromUserMission(userMission);
};

export const listStoreMissions = async (storeId, cursor) => {
  const store = await findStoreById(storeId);
  if (!store) {
    throw new NotFoundError("존재하지 않는 가게입니다.");
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
    throw new BadRequestError("결제 금액 비율로 보상하는 미션은 paid_amount가 필요합니다.");
  }
  return Math.floor((paidAmount * Number(userMission.reward_rate)) / 100);
};

export const completeMission = async (data) => {
  const userId = await resolveCurrentUserId(data.userId);

  const pointBalance = await prisma.$transaction(async (tx) => {
    // 같은 미션에 완료 요청이 동시에 들어와도 포인트가 두 번 지급되지 않도록 row를 잠근다.
    const userMission = await findUserMissionById(data.userMissionId, {
      tx,
      forUpdate: true,
    });
    // 다른 사용자의 미션은 존재 여부도 알려주지 않는다.
    // (DB의 id는 BigInt, 요청으로 받은 id는 number일 수 있어서 BigInt로 맞춰 비교한다)
    if (!userMission || userMission.user_id !== BigInt(userId)) {
      throw new NotFoundError("존재하지 않는 미션입니다.");
    }
    if (!ACTIVE_USER_MISSION_STATUSES.includes(userMission.status)) {
      throw new ConflictError("진행 중인 미션이 아닙니다.");
    }
    if (userMission.expires_at <= new Date()) {
      throw new BadRequestError("도전 기한이 지난 미션입니다.");
    }

    const earnedPoint = calculateEarnedPoint(userMission, data.paidAmount);

    await completeUserMission(tx, userMission.id, {
      earnedPoint,
      paidAmount: data.paidAmount,
    });
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
