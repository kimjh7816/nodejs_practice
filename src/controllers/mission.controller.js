import { StatusCodes } from "http-status-codes";
import { bodyToChallenge, bodyToCompleteMission } from "../dtos/mission.dto.js";
import {
  challengeMission,
  completeMission,
  listMyMissions,
} from "../services/mission.service.js";
import { optionalId, parseCursor } from "../utils/validation.js";

// POST /missions/:missionId/challenge
export const handleChallengeMission = async (req, res) => {
  const userMission = await challengeMission(
    bodyToChallenge(req.body, req.params.missionId)
  );
  res.status(StatusCodes.CREATED).json({ result: userMission });
};

// GET /users/me/missions?cursor=&user_id=
// GET 요청은 body가 없으므로 user_id를 query로 받는다.
export const handleListMyMissions = async (req, res) => {
  const missions = await listMyMissions(
    optionalId(req.query.user_id, "user_id"),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).json({ result: missions });
};

// PATCH /users/me/missions/:userMissionId/complete
// Express 5는 body 없이 요청하면 req.body가 undefined라서 빈 객체로 바꿔 넘긴다.
export const handleCompleteMission = async (req, res) => {
  const userMission = await completeMission(
    bodyToCompleteMission(req.body ?? {}, req.params.userMissionId)
  );
  res.status(StatusCodes.OK).json({ result: userMission });
};
