// .env의 DATABASE_URL로 MySQL에 실제로 붙는지 Prisma를 통해 확인하는 스크립트
// 실행: npm run db:check
//
// DB 접근은 모두 Prisma Client API로만 한다. (VERSION(), SHOW TABLES 같은 원시 SQL은 쓰지 않는다)
// 그래서 서버 버전이나 테이블 목록 대신, 스키마에 선언된 모델의 row 수를 세어 연결을 확인한다.
import { disconnect, prisma } from "../db.config.js";

// 스키마에 정의된 모델 이름들. 새 모델을 추가하면 여기에도 넣어주면 된다.
const MODEL_NAMES = [
  "regions",
  "food_categories",
  "users",
  "stores",
  "missions",
  "reviews",
  "user_missions",
  "point_transactions",
];

try {
  console.log("연결 성공");
  console.log("  현재 시각 :", new Date().toISOString());
  console.log("  모델별 row 수");

  for (const name of MODEL_NAMES) {
    const count = await prisma[name].count();
    console.log(`    ${name.padEnd(20)} ${count}`);
  }
} catch (err) {
  console.error("연결 실패:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await disconnect(); // 스크립트가 끝나도 프로세스가 안 죽는 걸 막기 위해 연결을 닫는다
}
