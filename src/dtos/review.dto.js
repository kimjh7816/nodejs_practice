import { BadRequestError } from "../errors.js";
import { toCursorPage } from "../utils/pagination.js";
import { optionalString, parseId, requireString } from "../utils/validation.js";

// 작성자는 body가 아니라 세션에서 온 userId를 쓴다. (남의 이름으로 리뷰를 쓸 수 없게)
export const bodyToReview = (body, storeId, userId) => {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError("rating은 1~5 사이의 정수여야 합니다.");
  }

  return {
    storeId: parseId(storeId, "storeId"),
    userId,
    content: requireString(body.review_content, "review_content", 1000),
    rating,
    imageUrl: optionalString(body.review_image_url, "review_image_url", 512),
  };
};

export const responseFromReview = ({ review, images }) => ({
  review_id: review.id,
  store_id: review.store_id,
  user_id: review.user_id,
  review_content: review.content,
  rating: review.rating,
  review_image_urls: images.map((image) => image.image_url),
  created_at: review.created_at,
});

// 가게 리뷰 목록 응답
export const responseFromReviews = (reviews) =>
  toCursorPage(reviews, (review) => ({
    review_id: review.id,
    nickname: review.users.nickname,
    rating: review.rating,
    review_content: review.content,
    created_at: review.created_at,
  }));

// 내가 작성한 리뷰 목록 응답
export const responseFromMyReviews = (reviews) =>
  toCursorPage(reviews, (review) => ({
    review_id: review.id,
    store_id: review.store_id,
    store_name: review.stores.name,
    nickname: review.users.nickname,
    rating: review.rating,
    review_content: review.content,
    review_image_urls: review.review_images.map((image) => image.image_url),
    created_at: review.created_at,
  }));
