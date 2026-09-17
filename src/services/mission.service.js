import { prisma } from "../db.config.js";
import {
  responseFromMission,
  responseFromUserMission,
} from "../dtos/mission.dto.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.js";
import {
  existsActiveUserMission,
  findMissionById,
  findUserMissionById,
  increaseMissionIssuedCount,
  insertMission,
  insertUserMission,
} from "../repositories/mission.repository.js";
import { findStoreById } from "../repositories/store.repository.js";
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
