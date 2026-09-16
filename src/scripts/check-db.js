// .env의 접속 정보로 MySQL에 실제로 붙는지 확인하는 스크립트
// 실행: npm run db:check
import { pool } from "../db.config.js";

try {
  const [[info]] = await pool.query(
    "SELECT VERSION() AS version, DATABASE() AS db, NOW() AS now"
  );
  console.log("연결 성공");
  console.log("  MySQL 버전 :", info.version);
  console.log("  현재 DB    :", info.db);
  console.log("  서버 시각  :", info.now);

  const [tables] = await pool.query("SHOW TABLES");
  console.log(
    "  테이블     :",
    tables.length ? tables.map((t) => Object.values(t)[0]).join(", ") : "(없음)"
  );
} catch (err) {
  console.error("연결 실패:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await pool.end(); // 스크립트가 끝나도 프로세스가 안 죽는 걸 막기 위해 pool을 닫는다
}
