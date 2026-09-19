import { StatusCodes } from "http-status-codes";
import { bodyToMission } from "../dtos/mission.dto.js";
import { bodyToReview } from "../dtos/review.dto.js";
import { bodyToStore } from "../dtos/store.dto.js";
import { addMission, listStoreMissions } from "../services/mission.service.js";
import { addReview, listStoreReviews } from "../services/review.service.js";
import { addStore } from "../services/store.service.js";
import { parseCursor, parseId } from "../utils/validation.js";

// POST /regions/:regionId/stores
export const handleAddStore = async (req, res) => {
  const store = await addStore(bodyToStore(req.body, req.params.regionId));
  res.status(StatusCodes.CREATED).success(store);
};

// POST /reviews/:storeId
export const handleAddReview = async (req, res) => {
  const review = await addReview(bodyToReview(req.body, req.params.storeId));
  res.status(StatusCodes.CREATED).success(review);
};

// POST /stores/:storeId/missions
export const handleAddMission = async (req, res) => {
  const mission = await addMission(bodyToMission(req.body, req.params.storeId));
  res.status(StatusCodes.CREATED).success(mission);
};

// GET /stores/:storeId/reviews?cursor=
// parseInt는 "abc"를 NaN으로 바꿔 Prisma 에러(500)가 나므로, parseId로 검증해서 400으로 응답한다.
export const handleListStoreReviews = async (req, res) => {
  const reviews = await listStoreReviews(
    parseId(req.params.storeId, "storeId"),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).success(reviews);
};

// GET /stores/:storeId/missions?cursor=
export const handleListStoreMissions = async (req, res) => {
  const missions = await listStoreMissions(
    parseId(req.params.storeId, "storeId"),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).success(missions);
};
