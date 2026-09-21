import { BadRequestError } from "../errors.js";
import { toCursorPage } from "../utils/pagination.js";
import {
  optionalString,
  parseId,
  parsePositiveInt,
  requireDate,
  requireString,
} from "../utils/validation.js";

export const bodyToMission = (body, storeId) => {
  const rewardPoint = Number(body.reward_point);
  if (!Number.isInteger(rewardPoint) || rewardPoint < 1) {
    throw new BadRequestError("reward_point는 1 이상의 정수여야 합니다.");
  }

  const dueDate = requireDate(body.due_date, "due_date");
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
// 누가 도전하는지도 마찬가지로 body가 아니라 세션에서 온 userId를 쓴다.
export const toChallenge = (missionId, userId) => ({
  missionId: parseId(missionId, "missionId"),
  userId,
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

// 가게의 미션 목록 응답
export const responseFromStoreMissions = (missions) =>
  toCursorPage(missions, (mission) => ({
    mission_id: mission.id,
    mission_name: mission.title,
    description: mission.description,
    min_order_amount: mission.min_order_amount,
    reward_type: mission.reward_type,
    reward_point: mission.reward_point,
    reward_rate: mission.reward_rate,
    due_date: mission.closed_at,
  }));

// 내가 진행 중인 미션 목록 응답
export const responseFromMyMissions = (userMissions) =>
  toCursorPage(userMissions, (userMission) => ({
    user_mission_id: userMission.id,
    mission_id: userMission.mission_id,
    store_id: userMission.store_id,
    store_name: userMission.stores.name,
    mission_name: userMission.missions.title,
    min_order_amount: userMission.missions.min_order_amount,
    reward_type: userMission.reward_type,
    reward_point: userMission.reward_point,
    reward_rate: userMission.reward_rate,
    status: userMission.status,
    started_at: userMission.started_at,
    due_date: userMission.expires_at,
  }));

// 미션 완료 요청
// 비율(RATE) 보상 미션은 결제 금액으로 포인트를 계산하므로 paid_amount를 받는다. (POINT 미션은 없어도 된다)
export const bodyToCompleteMission = (body, userMissionId, userId) => ({
  userMissionId: parseId(userMissionId, "userMissionId"),
  userId,
  paidAmount:
    body.paid_amount === undefined
      ? undefined
      : parsePositiveInt(body.paid_amount, "paid_amount"),
});

export const responseFromCompletedUserMission = (userMission, pointBalance) => ({
  ...responseFromUserMission(userMission),
  paid_amount: userMission.paid_amount,
  earned_point: userMission.earned_point,
  completed_at: userMission.completed_at,
  point_balance: pointBalance,
});
