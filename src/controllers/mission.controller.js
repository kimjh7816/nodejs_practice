import { StatusCodes } from "http-status-codes";
import { bodyToCompleteMission, toChallenge } from "../dtos/mission.dto.js";
import {
  challengeMission,
  completeMission,
  listMyMissions,
} from "../services/mission.service.js";
import { currentUserId } from "../auth.middleware.js";
import { parseCursor } from "../utils/validation.js";

// POST /missions/:missionId/challenge
export const handleChallengeMission = async (req, res) => {
  const userMission = await challengeMission(
    toChallenge(req.params.missionId, currentUserId(req))
  );
  res.status(StatusCodes.CREATED).success(userMission);
};

// GET /users/me/missions?cursor=
// 누구의 목록인지는 세션에서 정해지므로 user_id를 받지 않는다.
export const handleListMyMissions = async (req, res) => {
  const missions = await listMyMissions(
    currentUserId(req),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).success(missions);
};

// PATCH /users/me/missions/:userMissionId/complete
// Express 5는 body 없이 요청하면 req.body가 undefined라서 빈 객체로 바꿔 넘긴다.
export const handleCompleteMission = async (req, res) => {
  const userMission = await completeMission(
    bodyToCompleteMission(
      req.body ?? {},
      req.params.userMissionId,
      currentUserId(req)
    )
  );
  res.status(StatusCodes.OK).success(userMission);
};
