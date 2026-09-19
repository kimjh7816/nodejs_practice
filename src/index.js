import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { StatusCodes } from "http-status-codes";

import "./utils/bigint.js"; // Prisma가 돌려주는 BigInt id를 JSON으로 내보낼 수 있게 한다
import { disconnect, testConnection } from "./db.config.js";
import {
  InvalidJsonError,
  RouteNotFoundError,
  ServiceError,
  UserNotFoundError,
} from "./errors.js";
import {
  optionalId,
  parseId,
  parseOffset,
  parsePositiveInt,
  requireEmail,
  requireString,
} from "./utils/validation.js";
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

/*** 공통 응답을 사용할 수 있는 헬퍼 함수 등록 ***/
// 모든 API는 { resultType, error, success } 한 가지 형태로만 응답한다.
app.use((req, res, next) => {
  res.success = (success) => {
    return res.json({ resultType: "SUCCESS", error: null, success });
  };

  res.error = ({ errorCode = "unknown", reason = null, data = null }) => {
    return res.json({
      resultType: "FAIL",
      error: { errorCode, reason, data },
      success: null,
    });
  };

  next();
});

app.use(cors()); // cors 방식 허용
app.use(express.static("public")); // 정적 파일 접근
app.use(express.json()); // JSON 형태의 요청 body를 파싱
app.use(express.urlencoded({ extended: false })); // 단순 객체 문자열 형태로 본문 데이터 해석

app.get("/", (req, res) => {
  res.success("Hello World!");
});

app.post("/api/v1/users/sign-up", handleUserSignUp); // 회원가입

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
  res.success({ db: "ok" });
});

/*** Prisma 전환 이전에 만든 확인용 라우트 ***/
// 회원가입 API와 기능이 겹치는 임시 라우트지만, 응답만 공통 규격에 맞춰 남겨둔다.
app.get("/users", async (req, res) => {
  const limit = parsePositiveInt(req.query.limit ?? 20, "limit");
  const offset = parseOffset(req.query.offset);
  res.success(await findAllUsers({ limit, offset }));
});

app.get("/users/:id", async (req, res) => {
  const user = await findUserById(parseId(req.params.id, "id"));
  if (!user) {
    throw new UserNotFoundError({ userId: req.params.id });
  }
  res.success(user);
});

app.post("/users", async (req, res) => {
  const body = req.body ?? {};
  const id = await createUser({
    email: requireEmail(body.email),
    name: requireString(body.name, "name", 50),
    nickname: requireString(body.nickname, "nickname", 20),
    gender: body.gender,
    regionId: optionalId(body.regionId, "regionId"),
  });
  res.status(StatusCodes.CREATED).success({ id });
});

/*** 등록되지 않은 경로 처리 ***/
// 여기까지 내려왔다면 매칭된 라우트가 없다는 뜻이므로, Express 기본 HTML 404 대신
// 공통 오류 규격으로 응답하도록 커스텀 오류를 만들어 아래 오류 핸들러로 넘긴다.
app.use((req, res, next) => {
  next(new RouteNotFoundError(req.method, req.originalUrl));
});

/*** 전역 오류를 처리하기 위한 미들웨어 ***/
// Express 5는 async 핸들러에서 throw된 에러도 여기로 넘겨준다.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // express.json()이 본문 파싱에 실패하면 SyntaxError를 던진다. 우리 규격의 오류로 바꿔준다.
  const error =
    err instanceof SyntaxError && "body" in err ? new InvalidJsonError() : err;

  // ServiceError를 상속한 오류는 의도적으로 던진 것이므로 그대로 내보낸다.
  if (error instanceof ServiceError) {
    return res.status(error.statusCode).error({
      errorCode: error.errorCode,
      reason: error.reason,
      data: error.data,
    });
  }

  // 여기로 온 오류는 예상하지 못한 것(코드 버그, DB 장애 등)이다.
  // 내부 사정이 그대로 노출되지 않도록 메시지를 고정하고, 원인은 서버 로그에만 남긴다.
  console.error(error);
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).error({
    errorCode: "C000",
    reason: "서버 내부 오류가 발생했습니다.",
    data: null,
  });
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
