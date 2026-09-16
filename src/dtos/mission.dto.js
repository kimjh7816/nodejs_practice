import { BadRequestError } from "../errors.js";
import { optionalString, parseId, requireString } from "../utils/validation.js";

export const bodyToMission = (body, storeId) => {
  const rewardPoint = Number(body.reward_point);
  if (!Number.isInteger(rewardPoint) || rewardPoint < 1) {
    throw new BadRequestError("reward_point는 1 이상의 정수여야 합니다.");
  }

  const dueDate = new Date(body.due_date);
  if (!body.due_date || Number.isNaN(dueDate.getTime())) {
    throw new BadRequestError("due_date는 올바른 날짜 형식이어야 합니다.");
  }
  if (dueDate <= new Date()) {
    throw new BadRequestError("due_date는 현재 시각 이후여야 합니다.");
  }

  return {
    storeId: parseId(storeId, "storeId"),
    title: requireString(body.mission_name, "mission_name", 100),
    description: optionalString(body.description, "description", 500),
    rewardPoint,
    dueDate,
  };
};

export const responseFromMission = (mission) => ({
  mission_id: mission.id,
  store_id: mission.store_id,
  region_id: mission.region_id,
  mission_name: mission.title,
  description: mission.description,
  reward_point: mission.reward_point,
  due_date: mission.closed_at,
  status: mission.status,
  created_at: mission.created_at,
});

// 도전할 미션의 가게/지역/보상 정보는 클라이언트가 보낸 값이 아니라 DB의 미션 정보를 기준으로 한다.
// (body의 store_id, reward_point 등을 믿으면 조작된 값으로 도전할 수 있기 때문)
export const bodyToChallenge = (body, missionId) => ({
  missionId: parseId(missionId, "missionId"),
  userId:
    body.user_id === undefined ? undefined : parseId(body.user_id, "user_id"),
});

export const responseFromUserMission = (userMission) => ({
  user_mission_id: userMission.id,
  mission_id: userMission.mission_id,
  user_id: userMission.user_id,
  store_id: userMission.store_id,
  region_id: userMission.region_id,
  store_name: userMission.store_name,
  category: userMission.category_name,
  mission_name: userMission.title,
  reward_point: userMission.reward_point,
  reward_rate: userMission.reward_rate,
  status: userMission.status,
  started_at: userMission.started_at,
  due_date: userMission.expires_at,
});
