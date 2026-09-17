import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { StatusCodes } from "http-status-codes";

import "./utils/bigint.js"; // Prisma가 돌려주는 BigInt id를 JSON으로 내보낼 수 있게 한다
import { disconnect, testConnection } from "./db.config.js";
import {
  handleListMyReviews,
  handleUserSignUp,
} from "./controllers/user.controller.js";
import {
  handleAddMission,
  handleAddReview,
  handleAddStore,
  handleListStoreMissions,
  handleListStoreReviews,
} from "./controllers/store.controller.js";
import {
  handleChallengeMission,
  handleCompleteMission,
  handleListMyMissions,
} from "./controllers/mission.controller.js";
import {
  createUser,
  findAllUsers,
  findUserById,
} from "./repositories/user.repository.js";

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors()); // cors 방식 허용
app.use(express.static("public")); // 정적 파일 접근
app.use(express.json()); // JSON 형태의 요청 body를 파싱
app.use(express.urlencoded({ extended: false })); // 단순 객체 문자열 형태로 본문 데이터 해석

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/api/v1/users/sign-up", handleUserSignUp);

app.post("/api/v1/regions/:regionId/stores", handleAddStore); // 특정 지역에 가게 추가
app.post("/api/v1/reviews/:storeId", handleAddReview); // 가게에 리뷰 추가 (끝에 / 가 붙어도 매칭됨)
app.post("/api/v1/stores/:storeId/missions", handleAddMission); // 가게에 미션 추가
app.post("/api/v1/missions/:missionId/challenge", handleChallengeMission); // 미션 도전하기
app.get("/api/v1/stores/:storeId/reviews", handleListStoreReviews); // 가게 리뷰 목록 조회
app.get("/api/v1/stores/:storeId/missions", handleListStoreMissions); // 가게 미션 목록 조회

// 로그인 기능이 생기면 "me"는 로그인한 사용자가 된다. 지금은 user_id(없으면 첫 번째 사용자)로 대신한다.
app.get("/api/v1/users/me/reviews", handleListMyReviews); // 내가 작성한 리뷰 목록
app.get("/api/v1/users/me/missions", handleListMyMissions); // 내가 진행 중인 미션 목록
app.patch(
  "/api/v1/users/me/missions/:userMissionId/complete",
  handleCompleteMission
); // 진행 중인 미션을 진행 완료로 바꾸기

// DB가 살아있는지 확인하는 헬스 체크
app.get("/health/db", async (req, res) => {
  await testConnection();
  res.json({ db: "ok" });
});

app.get("/users", async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);
  res.json(await findAllUsers({ limit, offset }));
});

app.get("/users/:id", async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "user not found" });
  }
  res.json(user);
});

app.post("/users", async (req, res) => {
  const { email, name, nickname, gender, regionId } = req.body;
  if (!email || !name || !nickname) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "email, name, nickname은 필수입니다." });
  }
  const id = await createUser({ email, name, nickname, gender, regionId });
  res.status(StatusCodes.CREATED).json({ id });
});

// Express 5는 async 핸들러에서 throw된 에러도 여기로 넘겨준다.
// HttpError처럼 statusCode가 있는 에러는 그 코드로, 나머지는 500으로 응답한다.
app.use((err, req, res, next) => {
  const statusCode = err.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
  if (statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
    console.error(err);
  }
  res
    .status(statusCode)
    .json({ message: err.message ?? "Internal Server Error" });
});

// DB 연결을 먼저 확인한 뒤 서버를 띄운다.
try {
  await testConnection();
  console.log("MySQL 연결 성공 (Prisma)");
} catch (err) {
  console.error("MySQL 연결 실패:", err.message);
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// 종료할 때 커넥션 풀도 같이 정리
const shutdown = async () => {
  server.close();
  await disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
