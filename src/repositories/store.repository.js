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

// tx를 넘기면 트랜잭션 안에서 조회한다.
export const findStoreById = async (storeId, { tx = prisma } = {}) =>
  tx.stores.findUnique({ where: { id: storeId } });
