import { StatusCodes } from "http-status-codes";
import { bodyToMission } from "../dtos/mission.dto.js";
import { bodyToReview } from "../dtos/review.dto.js";
import { bodyToStore } from "../dtos/store.dto.js";
import { addMission } from "../services/mission.service.js";
import { addReview } from "../services/review.service.js";
import { addStore } from "../services/store.service.js";

// POST /regions/:regionId/stores
export const handleAddStore = async (req, res) => {
  const store = await addStore(bodyToStore(req.body, req.params.regionId));
  res.status(StatusCodes.CREATED).json({ result: store });
};

// POST /reviews/:storeId
export const handleAddReview = async (req, res) => {
  const review = await addReview(bodyToReview(req.body, req.params.storeId));
  res.status(StatusCodes.CREATED).json({ result: review });
};

// POST /stores/:storeId/missions
export const handleAddMission = async (req, res) => {
  const mission = await addMission(bodyToMission(req.body, req.params.storeId));
  res.status(StatusCodes.CREATED).json({ result: mission });
};
