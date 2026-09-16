import { BadRequestError } from "../errors.js";
import { optionalString, parseId, requireString } from "../utils/validation.js";

export const bodyToReview = (body, storeId) => {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError("rating은 1~5 사이의 정수여야 합니다.");
  }

  return {
    storeId: parseId(storeId, "storeId"),
    // user_id가 없으면 서비스에서 첫 번째 사용자로 채운다.
    userId:
      body.user_id === undefined ? undefined : parseId(body.user_id, "user_id"),
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
