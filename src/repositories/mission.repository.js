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
export const existsActiveUserMission = async (tx, userId, missionId) => {
  const active = await tx.user_missions.findFirst({
    where: {
      user_id: userId,
      mission_id: missionId,
      status: { in: ["IN_PROGRESS", "REQUESTED"] },
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

export const findUserMissionById = async (userMissionId) => {
  const userMission = await prisma.user_missions.findUnique({
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
