import { pool } from "../db.config.js";

export const findRegionById = async (regionId) => {
  const [rows] = await pool.query(
    `SELECT id, display_name, is_active FROM regions WHERE id = ?;`,
    [regionId]
  );
  return rows[0] ?? null;
};

export const findFoodCategoryById = async (categoryId) => {
  const [rows] = await pool.query(
    `SELECT id, name, is_active FROM food_categories WHERE id = ?;`,
    [categoryId]
  );
  return rows[0] ?? null;
};

export const insertStore = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO stores (region_id, category_id, name, address1, open_time, close_time)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      data.regionId,
      data.categoryId,
      data.name,
      data.address,
      data.openTime,
      data.closeTime,
    ]
  );
  return result.insertId;
};

// conn을 넘기면 트랜잭션 안에서 조회하고, forUpdate면 해당 row에 잠금을 건다.
export const findStoreById = async (storeId, { conn = pool, forUpdate = false } = {}) => {
  const [rows] = await conn.query(
    `SELECT * FROM stores WHERE id = ?${forUpdate ? " FOR UPDATE" : ""};`,
    [storeId]
  );
  return rows[0] ?? null;
};
