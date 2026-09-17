// .env의 DATABASE_URL로 MySQL에 실제로 붙는지 Prisma를 통해 확인하는 스크립트
// 실행: npm run db:check
import { disconnect, prisma } from "../db.config.js";

try {
  const [info] = await prisma.$queryRaw`
    SELECT VERSION() AS version, DATABASE() AS db, NOW() AS now`;
  console.log("연결 성공");
  console.log("  MySQL 버전 :", info.version);
  console.log("  현재 DB    :", info.db);
  console.log("  서버 시각  :", info.now);

  // SHOW TABLES는 Prisma 모델 API로 표현할 수 없으므로 raw 쿼리를 쓴다.
  const tables = await prisma.$queryRaw`SHOW TABLES`;
  console.log(
    "  테이블     :",
    tables.length
      ? tables.map((table) => Object.values(table)[0]).join(", ")
      : "(없음)"
  );
} catch (err) {
  console.error("연결 실패:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await disconnect(); // 스크립트가 끝나도 프로세스가 안 죽는 걸 막기 위해 연결을 닫는다
}
