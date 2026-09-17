import { prisma } from "../db.config.js";

export const insertReview = async (tx, data) => {
  const review = await tx.reviews.create({
    data: {
      user_id: data.userId,
      store_id: data.storeId,
      rating: data.rating,
      content: data.content,
    },
    select: { id: true },
  });

  return review.id;
};

export const insertReviewImage = async (tx, reviewId, imageUrl, sortOrder = 0) => {
  await tx.review_images.create({
    data: { review_id: reviewId, image_url: imageUrl, sort_order: sortOrder },
  });
};

// 새 리뷰를 반영해 가게의 평균 평점과 리뷰 수를 갱신한다.
// rating_avg는 기존 컬럼 값(rating_avg, review_count)으로 계산해야 해서 Prisma Client API로는 표현할 수 없다.
// (increment 같은 원자적 연산은 있지만 컬럼끼리 곱하고 나누는 식은 raw로 써야 한다)
// MySQL UPDATE는 SET을 왼쪽부터 적용하므로, review_count를 올리기 전에 rating_avg를 먼저 계산해야 한다.
export const applyReviewToStore = async (tx, storeId, rating) => {
  await tx.$executeRaw`
    UPDATE stores
       SET rating_avg = ROUND((rating_avg * review_count + ${rating}) / (review_count + 1), 1),
           review_count = review_count + 1
     WHERE id = ${storeId}`;
};

export const findReviewById = async (reviewId) =>
  prisma.reviews.findUnique({ where: { id: reviewId } });

export const findReviewImagesByReviewId = async (reviewId) =>
  prisma.review_images.findMany({
    where: { review_id: reviewId },
    select: { image_url: true },
    orderBy: { sort_order: "asc" },
  });
