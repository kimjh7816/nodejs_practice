import { prisma } from "../db.config.js";

export const insertMission = async (data) => {
  const mission = await prisma.missions.create({
    data: {
      store_id: data.storeId,
      region_id: data.regionId,
      title: data.title,
      description: data.description,
      reward_type: "POINT",
      reward_point: data.rewardPoint,
      opened_at: new Date(),
      closed_at: data.dueDate,
      status: "OPEN",
    },
    select: { id: true },
  });

  return mission.id;
};

// tx를 넘기면 트랜잭션 안에서 조회한다.
export const findMissionById = async (missionId, { tx = prisma } = {}) =>
  tx.missions.findUnique({ where: { id: missionId } });

// 진행 중(IN_PROGRESS)이거나 인증 요청(REQUESTED) 상태면 "도전 중"으로 본다.
export const ACTIVE_USER_MISSION_STATUSES = ["IN_PROGRESS", "REQUESTED"];

export const existsActiveUserMission = async (tx, userId, missionId) => {
  const active = await tx.user_missions.findFirst({
    where: {
      user_id: userId,
      mission_id: missionId,
      status: { in: ACTIVE_USER_MISSION_STATUSES },
    },
    select: { id: true },
  });

  return active !== null;
};

export const insertUserMission = async (tx, data) => {
  const userMission = await tx.user_missions.create({
    data: {
      user_id: data.userId,
      mission_id: data.missionId,
      store_id: data.storeId,
      region_id: data.regionId,
      reward_type: data.rewardType,
      reward_point: data.rewardPoint,
      reward_rate: data.rewardRate,
      expires_at: data.expiresAt,
    },
    select: { id: true },
  });

  return userMission.id;
};

// 선착순 한 자리를 차지하면서 발급 수를 1 올린다. 자리가 없으면 false를 돌려준다.
//
// 조회해서 확인한 뒤 올리면 그 사이에 다른 요청이 끼어들 수 있으므로,
// "아직 자리가 남아 있을 때만" 이라는 조건을 UPDATE의 WHERE에 함께 넣어 한 번에 처리한다.
// (issued_count < total_quota 처럼 컬럼끼리 비교하는 건 Prisma의 field reference로 표현한다)
// 이 UPDATE가 미션 row에 배타 잠금을 걸기 때문에, 같은 미션에 동시에 들어온 도전 요청은
// 여기서 줄을 서게 되고 뒤따르는 중복 도전 검사도 직전 커밋 결과를 보고 판단할 수 있다.
export const claimMissionQuota = async (tx, missionId) => {
  const { count } = await tx.missions.updateMany({
    where: {
      id: missionId,
      OR: [
        { total_quota: null }, // 인원 제한이 없는 미션
        { issued_count: { lt: prisma.missions.fields.total_quota } },
      ],
    },
    data: { issued_count: { increment: 1 } },
  });

  return count === 1;
};

// tx를 넘기면 트랜잭션 안에서 조회한다. (findMissionById와 같은 방식)
export const findUserMissionById = async (userMissionId, { tx = prisma } = {}) => {
  const userMission = await tx.user_missions.findUnique({
    where: { id: userMissionId },
    include: {
      missions: { select: { title: true } },
      stores: {
        select: { name: true, food_categories: { select: { name: true } } },
      },
    },
  });

  if (!userMission) {
    return null;
  }

  // 기존 JOIN 쿼리와 같은 평평한 모양(title, store_name, category_name)으로 맞춰서 돌려준다.
  const { missions, stores, ...rest } = userMission;
  return {
    ...rest,
    title: missions.title,
    store_name: stores.name,
    category_name: stores.food_categories.name,
  };
};

// 가게의 미션 목록 (커서 기반 페이지네이션)
// 사용자에게 보여주는 목록이므로 지금 도전할 수 있는 미션만 조회한다. (challengeMission의 도전 가능 조건과 같다)
export const getAllStoreMissions = async (storeId, cursor, take) => {
  const now = new Date();

  return prisma.missions.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      min_order_amount: true,
      reward_type: true,
      reward_point: true,
      reward_rate: true,
      closed_at: true,
    },
    where: {
      store_id: storeId,
      status: "OPEN",
      opened_at: { lte: now },
      OR: [{ closed_at: null }, { closed_at: { gt: now } }],
      id: { gt: cursor },
    },
    orderBy: { id: "asc" },
    take,
  });
};

// 사용자가 진행 중인 미션 목록 (커서 기반 페이지네이션)
// 상태가 진행 중이어도 도전 기한이 지났으면 더 이상 완료할 수 없으므로 제외한다.
export const getAllActiveUserMissions = async (userId, cursor, take) =>
  prisma.user_missions.findMany({
    select: {
      id: true,
      mission_id: true,
      store_id: true,
      status: true,
      reward_type: true,
      reward_point: true,
      reward_rate: true,
      started_at: true,
      expires_at: true,
      missions: { select: { title: true, min_order_amount: true } },
      stores: { select: { name: true } },
    },
    where: {
      user_id: userId,
      status: { in: ACTIVE_USER_MISSION_STATUSES },
      expires_at: { gt: new Date() },
      id: { gt: cursor },
    },
    orderBy: { id: "asc" },
    take,
  });

// 진행 중이고 기한이 남은 미션만 성공(진행 완료) 상태로 바꾼다. 바꾸지 못했으면 false를 돌려준다.
//
// "진행 중인지" 를 조회로 확인하고 나서 UPDATE 하면 그 사이에 같은 요청이 한 번 더 들어와
// 포인트가 두 번 지급될 수 있다. 그래서 그 조건을 UPDATE의 WHERE에 함께 넣어,
// 먼저 도착한 요청만 상태를 바꾸고 나머지는 count가 0이 되도록 한다.
//
// active_flag는 status로 계산되는 generated column이라, SUCCESS가 되면 DB가 알아서 NULL로 바꾼다.
// (그래서 같은 미션에 다시 도전할 수 있게 된다)
export const completeUserMission = async (tx, userMissionId, { earnedPoint, paidAmount }) => {
  const { count } = await tx.user_missions.updateMany({
    where: {
      id: userMissionId,
      status: { in: ACTIVE_USER_MISSION_STATUSES },
      expires_at: { gt: new Date() },
    },
    data: {
      status: "SUCCESS",
      completed_at: new Date(),
      earned_point: earnedPoint,
      paid_amount: paidAmount, // undefined면 Prisma가 이 컬럼은 건드리지 않는다
    },
  });

  return count === 1;
};
