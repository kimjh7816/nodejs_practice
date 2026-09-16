import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost", // mysql의 hostname
  user: process.env.DB_USER ?? "root", // user 이름
  port: Number(process.env.DB_PORT ?? 3306), // 포트 번호 (env 값은 문자열이라 숫자로 변환)
  database: process.env.DB_NAME ?? "node_study", // 데이터베이스 이름
  password: process.env.DB_PASSWORD ?? "", // 비밀번호 (빈 문자열도 유효하므로 ?? 사용)
  waitForConnections: true,
  // Pool에 획득할 수 있는 connection이 없을 때,
  // true면 요청을 queue에 넣고 connection을 사용할 수 있게 되면 요청을 실행하며, false이면 즉시 오류를 내보내고 다시 요청
  connectionLimit: 10, // 몇 개의 커넥션을 가지게끔 할 것인지
  queueLimit: 0, // getConnection에서 오류가 발생하기 전에 Pool에 대기할 요청의 개수 한도
  charset: "utf8mb4", // 이모지까지 저장 가능한 문자셋
});

// 여러 쿼리를 하나의 트랜잭션으로 묶는다.
// callback 안에서 에러가 나면 전부 rollback, 끝까지 성공하면 commit 한다.
export const withTransaction = async (callback) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// 서버 기동 시 DB가 실제로 붙는지 한 번 확인하는 용도
export const testConnection = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query("SELECT 1");
  } finally {
    conn.release(); // 반드시 pool에 반납해야 커넥션이 마르지 않음
  }
};
