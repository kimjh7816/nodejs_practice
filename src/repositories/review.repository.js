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

// 가게 리뷰 목록 (커서 기반 페이지네이션)
// cursor보다 id가 큰 리뷰를 id 오름차순으로 가져온다. 삭제된(deleted_at이 있는) 리뷰는 제외한다.
// 작성자 정보는 화면에 필요한 닉네임만 select 한다. (users 전체를 가져오면 email, password_hash 등이 응답에 섞인다)
export const getAllStoreReviews = async (storeId, cursor, take) =>
  prisma.reviews.findMany({
    select: {
      id: true,
      rating: true,
      content: true,
      created_at: true,
      users: { select: { nickname: true } },
    },
    where: { store_id: storeId, deleted_at: null, id: { gt: cursor } },
    orderBy: { id: "asc" },
    take,
  });

// 사용자가 작성한 리뷰 목록 (커서 기반 페이지네이션)
// 화면에 가게 이름, 닉네임, 별점, 작성일, 내용, 사진이 나오므로 관계 테이블에서 필요한 컬럼만 함께 가져온다.
export const getAllUserReviews = async (userId, cursor, take) =>
  prisma.reviews.findMany({
    select: {
      id: true,
      store_id: true,
      rating: true,
      content: true,
      created_at: true,
      stores: { select: { name: true } },
      users: { select: { nickname: true } },
      review_images: {
        select: { image_url: true },
        orderBy: { sort_order: "asc" },
      },
    },
    where: { user_id: userId, deleted_at: null, id: { gt: cursor } },
    orderBy: { id: "asc" },
    take,
  });
