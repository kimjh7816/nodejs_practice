import { responseFromStore } from "../dtos/store.dto.js";
import { BadRequestError, NotFoundError } from "../errors.js";
import {
  findFoodCategoryById,
  findRegionById,
  findStoreById,
  insertStore,
} from "../repositories/store.repository.js";

export const addStore = async (data) => {
  const region = await findRegionById(data.regionId);
  if (!region) {
    throw new NotFoundError("존재하지 않는 지역입니다.");
  }
  if (!region.is_active) {
    throw new BadRequestError("서비스하지 않는 지역입니다.");
  }

  const category = await findFoodCategoryById(data.categoryId);
  if (!category) {
    throw new NotFoundError("존재하지 않는 가게 카테고리입니다.");
  }

  const storeId = await insertStore(data);
  const store = await findStoreById(storeId);

  return responseFromStore(store);
};
