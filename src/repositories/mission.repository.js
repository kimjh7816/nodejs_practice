import { pool } from "../db.config.js";

export const insertMission = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO missions
       (store_id, region_id, title, description, reward_type, reward_point, opened_at, closed_at, status)
     VALUES (?, ?, ?, ?, 'POINT', ?, NOW(), ?, 'OPEN');`,
    [
      data.storeId,
      data.regionId,
      data.title,
      data.description,
      data.rewardPoint,
      data.dueDate,
    ]
  );
  return result.insertId;
};

// conn을 넘기면 트랜잭션 안에서 조회하고, forUpdate면 해당 row에 잠금을 건다.
export const findMissionById = async (missionId, { conn = pool, forUpdate = false } = {}) => {
  const [rows] = await conn.query(
    `SELECT * FROM missions WHERE id = ?${forUpdate ? " FOR UPDATE" : ""};`,
    [missionId]
  );
  return rows[0] ?? null;
};

// 진행 중(IN_PROGRESS)이거나 인증 요청(REQUESTED) 상태면 "도전 중"으로 본다.
export const existsActiveUserMission = async (conn, userId, missionId) => {
  const [rows] = await conn.query(
    `SELECT EXISTS(
       SELECT 1 FROM user_missions
        WHERE user_id = ? AND mission_id = ? AND status IN ('IN_PROGRESS', 'REQUESTED')
     ) AS isActive;`,
    [userId, missionId]
  );
  return Boolean(rows[0].isActive);
};

export const insertUserMission = async (conn, data) => {
  const [result] = await conn.query(
    `INSERT INTO user_missions
       (user_id, mission_id, store_id, region_id, reward_type, reward_point, reward_rate, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      data.userId,
      data.missionId,
      data.storeId,
      data.regionId,
      data.rewardType,
      data.rewardPoint,
      data.rewardRate,
      data.expiresAt,
    ]
  );
  return result.insertId;
};

export const increaseMissionIssuedCount = async (conn, missionId) => {
  await conn.query(
    `UPDATE missions SET issued_count = issued_count + 1 WHERE id = ?;`,
    [missionId]
  );
};

export const findUserMissionById = async (userMissionId) => {
  const [rows] = await pool.query(
    `SELECT um.*, m.title, s.name AS store_name, fc.name AS category_name
       FROM user_missions um
       JOIN missions m ON um.mission_id = m.id
       JOIN stores s ON um.store_id = s.id
       JOIN food_categories fc ON s.category_id = fc.id
      WHERE um.id = ?;`,
    [userMissionId]
  );
  return rows[0] ?? null;
};
