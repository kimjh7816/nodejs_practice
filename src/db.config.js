import dotenv from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "./generated/prisma/client.ts";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 없습니다. .env를 확인해주세요.");
}

// Prisma 7부터는 DB 드라이버를 직접 붙여줘야 한다(driver adapter).
// MySQL은 mariadb 드라이버를 쓰고, 커넥션 풀은 이 어댑터가 내부에서 관리한다.
// (풀 옵션은 DATABASE_URL 뒤에 ?connectionLimit=10 처럼 붙여서 조절할 수 있다)
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);

export const prisma = new PrismaClient({ adapter });

// 서버 기동 시 DB가 실제로 붙는지 한 번 확인하는 용도.
// 연결만 열어보는 것으로는 부족해서(커넥션은 지연 생성될 수 있다) 가벼운 조회를 한 번 보낸다.
export const testConnection = async () => {
  await prisma.$connect();
  await prisma.regions.count();
};

// 종료할 때 커넥션 풀을 정리한다.
export const disconnect = async () => {
  await prisma.$disconnect();
};
