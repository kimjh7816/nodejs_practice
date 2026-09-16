import { StatusCodes } from "http-status-codes";
import { bodyToChallenge } from "../dtos/mission.dto.js";
import { challengeMission } from "../services/mission.service.js";

// POST /missions/:missionId/challenge
export const handleChallengeMission = async (req, res) => {
  const userMission = await challengeMission(
    bodyToChallenge(req.body, req.params.missionId)
  );
  res.status(StatusCodes.CREATED).json({ result: userMission });
};
