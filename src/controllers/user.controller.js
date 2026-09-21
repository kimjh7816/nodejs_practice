import { StatusCodes } from "http-status-codes";
import { bodyToUpdateMe, bodyToUser } from "../dtos/dto.js";
import { listMyReviews } from "../services/review.service.js";
import {
  getMyProfile,
  updateMyProfile,
  userSignUp,
} from "../services/user.service.js";
import { currentUserId } from "../auth.middleware.js";
import { parseCursor } from "../utils/validation.js";

// POST /users/sign-up
export const handleUserSignUp = async (req, res) => {
  const user = await userSignUp(bodyToUser(req.body ?? {}));
  res.status(StatusCodes.CREATED).success(user);
};

// GET /users/me
export const handleGetMyProfile = async (req, res) => {
  const user = await getMyProfile(currentUserId(req));
  res.status(StatusCodes.OK).success(user);
};

// PATCH /users/me
// 소셜 로그인으로 가입해 비어 있는 항목(전화번호, 생일 등)을 채우는 용도다.
export const handleUpdateMyProfile = async (req, res) => {
  const user = await updateMyProfile(
    currentUserId(req),
    bodyToUpdateMe(req.body ?? {})
  );
  res.status(StatusCodes.OK).success(user);
};

// GET /users/me/reviews?cursor=
// 누구의 목록인지는 세션에서 정해지므로 user_id를 받지 않는다.
export const handleListMyReviews = async (req, res) => {
  const reviews = await listMyReviews(
    currentUserId(req),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).success(reviews);
};
