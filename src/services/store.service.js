import { responseFromStore } from "../dtos/store.dto.js";
import {
  FoodCategoryNotFoundError,
  RegionNotActiveError,
  RegionNotFoundError,
} from "../errors.js";
import {
  findFoodCategoryById,
  findRegionById,
  findStoreById,
  insertStore,
} from "../repositories/store.repository.js";

export const addStore = async (data) => {
  const region = await findRegionById(data.regionId);
  if (!region) {
    throw new RegionNotFoundError({ regionId: data.regionId });
  }
  if (!region.is_active) {
    throw new RegionNotActiveError({ regionId: data.regionId });
  }

  const category = await findFoodCategoryById(data.categoryId);
  if (!category) {
    throw new FoodCategoryNotFoundError({ categoryId: data.categoryId });
  }

  const storeId = await insertStore(data);
  const store = await findStoreById(storeId);

  return responseFromStore(store);
};
