import { pool } from "../db.config.js";

export const insertReview = async (conn, data) => {
  const [result] = await conn.query(
    `INSERT INTO reviews (user_id, store_id, rating, content) VALUES (?, ?, ?, ?);`,
    [data.userId, data.storeId, data.rating, data.content]
  );
  return result.insertId;
};

export const insertReviewImage = async (conn, reviewId, imageUrl, sortOrder = 0) => {
  await conn.query(
    `INSERT INTO review_images (review_id, image_url, sort_order) VALUES (?, ?, ?);`,
    [reviewId, imageUrl, sortOrder]
  );
};

// 새 리뷰를 반영해 가게의 평균 평점과 리뷰 수를 갱신한다.
// MySQL UPDATE는 SET을 왼쪽부터 적용하므로, review_count를 올리기 전에 rating_avg를 먼저 계산해야 한다.
export const applyReviewToStore = async (conn, storeId, rating) => {
  await conn.query(
    `UPDATE stores
        SET rating_avg = ROUND((rating_avg * review_count + ?) / (review_count + 1), 1),
            review_count = review_count + 1
      WHERE id = ?;`,
    [rating, storeId]
  );
};

export const findReviewById = async (reviewId) => {
  const [rows] = await pool.query(`SELECT * FROM reviews WHERE id = ?;`, [
    reviewId,
  ]);
  return rows[0] ?? null;
};

export const findReviewImagesByReviewId = async (reviewId) => {
  const [rows] = await pool.query(
    `SELECT image_url FROM review_images WHERE review_id = ? ORDER BY sort_order;`,
    [reviewId]
  );
  return rows;
};
