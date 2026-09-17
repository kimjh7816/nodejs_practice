import { StatusCodes } from "http-status-codes";
import { bodyToUser } from "../dtos/dto.js";
import { listMyReviews } from "../services/review.service.js";
import { userSignUp } from "../services/user.service.js";
import { optionalId, parseCursor } from "../utils/validation.js";

export const handleUserSignUp = async (req, res, next) => {
  console.log("회원가입을 요청했습니다!");
  console.log("body:", req.body); // 값이 잘 들어오나 확인하기 위한 테스트용

  const user = await userSignUp(bodyToUser(req.body));
  res.status(StatusCodes.OK).json({ result: user });
};

// GET /users/me/reviews?cursor=&user_id=
// GET 요청은 body가 없으므로 user_id를 query로 받는다.
export const handleListMyReviews = async (req, res) => {
  const reviews = await listMyReviews(
    optionalId(req.query.user_id, "user_id"),
    parseCursor(req.query.cursor)
  );
  res.status(StatusCodes.OK).json({ result: reviews });
};
