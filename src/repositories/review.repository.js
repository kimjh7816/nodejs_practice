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
//
// 1) review_count는 increment로 원자적으로 올린다. 이 UPDATE가 가게 row에 배타 잠금을 걸기 때문에,
//    같은 가게에 동시에 들어온 다른 리뷰 트랜잭션은 여기서 멈췄다가 우리가 커밋한 뒤에 이어서 진행한다.
// 2) rating_avg는 reviews 테이블에서 다시 집계한다.
//    (컬럼끼리 곱하고 나누는 UPDATE는 Prisma Client API로 표현할 수 없어서, 원본에서 평균을 새로 구한다)
//    1)의 잠금을 쥔 채로 집계하므로 다른 리뷰가 중간에 끼어들지 않는다.
//    단, 이 집계가 직전에 커밋된 리뷰까지 보려면 트랜잭션 격리 수준이 READ COMMITTED여야 한다.
//    (MySQL 기본값인 REPEATABLE READ는 트랜잭션 시작 시점의 스냅샷을 계속 보여준다)
export const applyReviewToStore = async (tx, storeId) => {
  await tx.stores.update({
    where: { id: storeId },
    data: { review_count: { increment: 1 } },
  });

  const { _avg } = await tx.reviews.aggregate({
    where: { store_id: storeId, deleted_at: null },
    _avg: { rating: true },
  });

  // rating_avg 컬럼은 DECIMAL(2,1)이라 소수점 첫째 자리까지만 저장된다.
  await tx.stores.update({
    where: { id: storeId },
    data: { rating_avg: Math.round((Number(_avg.rating) || 0) * 10) / 10 },
  });
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
