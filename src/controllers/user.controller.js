import { StatusCodes } from "http-status-codes";
import { bodyToUser } from "../dtos/dto.js";
import { listMyReviews } from "../services/review.service.js";
import { userSignUp } from "../services/user.service.js";
import { optionalId, parseCursor } from "../utils/validation.js";

// POST /users/sign-up
export const handleUserSignUp = async (req, res) => {
  const user = await userSignUp(bodyToUser(req.body ?? {}));
  res.status(StatusCodes.CREATED).success(user);
};

// GET /users/me/reviews?cursor=&user_id=
// GET 요청은 body가 없으므로 user_id를 query로 받는다.
export const handleListMyReviews = async (req, res) => {
  const reviews = await listMyReviews(
    optionalId(req.query.user_id, "user_id"),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).success(reviews);
};
