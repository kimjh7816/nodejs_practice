import { withTransaction } from "../db.config.js";
import { responseFromReview } from "../dtos/review.dto.js";
import { NotFoundError } from "../errors.js";
import {
  applyReviewToStore,
  findReviewById,
  findReviewImagesByReviewId,
  insertReview,
  insertReviewImage,
} from "../repositories/review.repository.js";
import { findStoreById } from "../repositories/store.repository.js";
import { resolveCurrentUserId } from "./user.service.js";

export const addReview = async (data) => {
  const userId = await resolveCurrentUserId(data.userId);

  // 리뷰 저장, 이미지 저장, 가게 평점 갱신 중 하나라도 실패하면 모두 되돌린다.
  const reviewId = await withTransaction(async (conn) => {
    // 리뷰를 추가하려는 가게가 존재하는지 검증
    const store = await findStoreById(data.storeId, { conn, forUpdate: true });
    if (!store) {
      throw new NotFoundError("존재하지 않는 가게입니다.");
    }

    const newReviewId = await insertReview(conn, { ...data, userId });
    if (data.imageUrl) {
      await insertReviewImage(conn, newReviewId, data.imageUrl);
    }
    await applyReviewToStore(conn, data.storeId, data.rating);

    return newReviewId;
  });

  const review = await findReviewById(reviewId);
  const images = await findReviewImagesByReviewId(reviewId);

  return responseFromReview({ review, images });
};
