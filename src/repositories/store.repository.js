import { prisma } from "../db.config.js";

export const findRegionById = async (regionId) =>
  prisma.regions.findUnique({
    where: { id: regionId },
    select: { id: true, display_name: true, is_active: true },
  });

export const findFoodCategoryById = async (categoryId) =>
  prisma.food_categories.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, is_active: true },
  });

export const insertStore = async (data) => {
  const store = await prisma.stores.create({
    data: {
      region_id: data.regionId,
      category_id: data.categoryId,
      name: data.name,
      address1: data.address,
      open_time: data.openTime,
      close_time: data.closeTime,
    },
    select: { id: true },
  });

  return store.id;
};

// tx를 넘기면 트랜잭션 안에서 조회하고, forUpdate면 해당 row에 잠금을 건다.
// Prisma Client API에는 행 잠금이 없어서 잠그는 쿼리만 raw로 보낸다.
// 잠금은 트랜잭션이 끝날 때까지 유지되므로, 값은 그 뒤에 findUnique로 읽어도 안전하다.
// (raw 결과를 그대로 쓰면 UNSIGNED INT가 BigInt로 오는 등 타입이 달라지므로 값 조회는 Prisma에 맡긴다)
export const findStoreById = async (storeId, { tx = prisma, forUpdate = false } = {}) => {
  if (forUpdate) {
    await tx.$queryRaw`SELECT id FROM stores WHERE id = ${storeId} FOR UPDATE`;
  }

  return tx.stores.findUnique({ where: { id: storeId } });
};
