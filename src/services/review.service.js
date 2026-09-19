import { prisma } from "../db.config.js";
import {
  responseFromMyReviews,
  responseFromReview,
  responseFromReviews,
} from "../dtos/review.dto.js";
import { StoreNotFoundError } from "../errors.js";
import {
  applyReviewToStore,
  findReviewById,
  findReviewImagesByReviewId,
  getAllStoreReviews,
  getAllUserReviews,
  insertReview,
  insertReviewImage,
} from "../repositories/review.repository.js";
import { findStoreById } from "../repositories/store.repository.js";
import { PAGE_FETCH_SIZE } from "../utils/pagination.js";
import { resolveCurrentUserId } from "./user.service.js";

export const addReview = async (data) => {
  const userId = await resolveCurrentUserId(data.userId);

  // 리뷰 저장, 이미지 저장, 가게 평점 갱신 중 하나라도 실패하면 모두 되돌린다.
  // $transaction의 콜백이 정상 종료하면 commit, 에러를 던지면 rollback 된다.
  //
  // 격리 수준을 READ COMMITTED로 낮추는 이유는 applyReviewToStore 때문이다.
  // 평균 평점을 reviews 테이블에서 다시 집계하는데, MySQL 기본값인 REPEATABLE READ에서는
  // 트랜잭션 시작 시점의 스냅샷만 보여서 그 사이에 커밋된 다른 리뷰가 평균에서 빠질 수 있다.
  const reviewId = await prisma.$transaction(
    async (tx) => {
      // 리뷰를 추가하려는 가게가 존재하는지 검증
      const store = await findStoreById(data.storeId, { tx });
      if (!store) {
        throw new StoreNotFoundError({ storeId: data.storeId });
      }

      const newReviewId = await insertReview(tx, { ...data, userId });
      if (data.imageUrl) {
        await insertReviewImage(tx, newReviewId, data.imageUrl);
      }
      await applyReviewToStore(tx, data.storeId);

      return newReviewId;
    },
    { isolationLevel: "ReadCommitted" }
  );

  const review = await findReviewById(reviewId);
  const images = await findReviewImagesByReviewId(reviewId);

  return responseFromReview({ review, images });
};

export const listStoreReviews = async (storeId, cursor) => {
  const store = await findStoreById(storeId);
  if (!store) {
    throw new StoreNotFoundError({ storeId });
  }

  const reviews = await getAllStoreReviews(storeId, cursor, PAGE_FETCH_SIZE);
  return responseFromReviews(reviews);
};

export const listMyReviews = async (requestUserId, cursor) => {
  const userId = await resolveCurrentUserId(requestUserId);

  const reviews = await getAllUserReviews(userId, cursor, PAGE_FETCH_SIZE);
  return responseFromMyReviews(reviews);
};
