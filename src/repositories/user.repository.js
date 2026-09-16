import { pool } from "../db.config.js";

// User 데이터 삽입
export const addUser = async (data) => {
  const conn = await pool.getConnection();

  try {
    const [confirm] = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM users WHERE email = ?) as isExistEmail;`,
      data.email
    );

    if (confirm[0].isExistEmail) {
      return null;
    }

    const [result] = await pool.query(
      `INSERT INTO users (email, name, gender, birth_date, address1, address2, phone) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        data.email,
        data.name,
        data.gender,
        data.birth,
        data.address,
        data.detailAddress,
        data.phoneNumber,
      ]
    );

    return result.insertId;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};

// 사용자 정보 얻기
export const getUser = async (userId) => {
  const conn = await pool.getConnection();

  try {
    const [user] = await pool.query(`SELECT * FROM users WHERE id = ?;`, userId);

    console.log(user);

    if (user.length == 0) {
      return null;
    }

    return user;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};

// 음식 선호 카테고리 매핑
export const setPreference = async (userId, foodCategoryId) => {
  const conn = await pool.getConnection();

  try {
    await pool.query(
      `INSERT INTO user_food_preferences (user_id, category_id) VALUES (?, ?);`,
      [userId, foodCategoryId]
    );

    return;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};

// 사용자 목록 조회 (페이징)
export const findAllUsers = async ({ limit, offset }) => {
  const conn = await pool.getConnection();

  try {
    const [rows] = await pool.query(
      `SELECT id, email, name, nickname, gender, region_id, point_balance, status, created_at
         FROM users
        ORDER BY id
        LIMIT ? OFFSET ?;`,
      [limit, offset]
    );

    return rows;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};

// 사용자 단건 조회
export const findUserById = async (id) => {
  const conn = await pool.getConnection();

  try {
    const [rows] = await pool.query(
      `SELECT id, email, name, nickname, gender, region_id, point_balance, status, created_at
         FROM users
        WHERE id = ?;`,
      [id]
    );

    return rows[0] ?? null;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};

// 인증 기능이 생기기 전까지 "현재 로그인한 사용자"로 쓸 첫 번째 사용자 id
export const findFirstUserId = async () => {
  const [rows] = await pool.query(`SELECT id FROM users ORDER BY id LIMIT 1;`);
  return rows[0]?.id ?? null;
};

// 사용자 생성
export const createUser = async ({ email, name, nickname, gender, regionId }) => {
  const conn = await pool.getConnection();

  try {
    const [result] = await pool.query(
      `INSERT INTO users (email, name, nickname, gender, region_id) VALUES (?, ?, ?, ?, ?);`,
      [email, name, nickname, gender ?? "NONE", regionId ?? null]
    );

    return result.insertId;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};

// 사용자 선호 카테고리 반환
export const getUserPreferencesByUserId = async (userId) => {
  const conn = await pool.getConnection();

  try {
    const [preferences] = await pool.query(
      "SELECT ufp.category_id AS food_category_id, ufp.user_id, fc.name " +
        "FROM user_food_preferences ufp JOIN food_categories fc ON ufp.category_id = fc.id " +
        "WHERE ufp.user_id = ? ORDER BY ufp.category_id ASC;",
      userId
    );

    return preferences;
  } catch (err) {
    throw new Error(
      `오류가 발생했어요. 요청 파라미터를 확인해주세요. (${err})`
    );
  } finally {
    conn.release();
  }
};


