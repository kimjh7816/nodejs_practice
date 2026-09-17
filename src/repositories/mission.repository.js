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

// tx를 넘기면 트랜잭션 안에서 조회하고, forUpdate면 해당 row에 잠금을 건다.
// Prisma Client API에는 행 잠금이 없어서 잠그는 쿼리만 raw로 보낸다.
// 잠금은 트랜잭션이 끝날 때까지 유지되므로, 값은 그 뒤에 findUnique로 읽어도 안전하다.
export const findMissionById = async (missionId, { tx = prisma, forUpdate = false } = {}) => {
  if (forUpdate) {
    await tx.$queryRaw`SELECT id FROM missions WHERE id = ${missionId} FOR UPDATE`;
  }

  return tx.missions.findUnique({ where: { id: missionId } });
};

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

// 여러 요청이 동시에 들어와도 발급 수가 덮어씌워지지 않도록 increment(원자적 증가)를 쓴다.
export const increaseMissionIssuedCount = async (tx, missionId) => {
  await tx.missions.update({
    where: { id: missionId },
    data: { issued_count: { increment: 1 } },
  });
};

// tx를 넘기면 트랜잭션 안에서 조회하고, forUpdate면 해당 row에 잠금을 건다. (findMissionById와 같은 방식)
export const findUserMissionById = async (
  userMissionId,
  { tx = prisma, forUpdate = false } = {}
) => {
  if (forUpdate) {
    await tx.$queryRaw`SELECT id FROM user_missions WHERE id = ${userMissionId} FOR UPDATE`;
  }

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

// 미션을 성공(진행 완료) 상태로 바꾼다.
// active_flag는 status로 계산되는 generated column이라, SUCCESS가 되면 DB가 알아서 NULL로 바꾼다.
// (그래서 같은 미션에 다시 도전할 수 있게 된다)
export const completeUserMission = async (tx, userMissionId, { earnedPoint, paidAmount }) => {
  await tx.user_missions.update({
    where: { id: userMissionId },
    data: {
      status: "SUCCESS",
      completed_at: new Date(),
      earned_point: earnedPoint,
      paid_amount: paidAmount, // undefined면 Prisma가 이 컬럼은 건드리지 않는다
    },
  });
};
