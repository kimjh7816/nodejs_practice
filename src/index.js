import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { StatusCodes } from "http-status-codes";
import session from "express-session";
import passport from "passport";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";

import { socialProviders } from "./auth.config.js";
import { requireAuth } from "./auth.middleware.js";


import "./utils/bigint.js"; // Prisma가 돌려주는 BigInt id를 JSON으로 내보낼 수 있게 한다
import { prisma, disconnect, testConnection } from "./db.config.js";
import {
  InvalidJsonError,
  RouteNotFoundError,
  ServiceError,
  SocialProviderNotConfiguredError,
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
  handleGetMyProfile,
  handleListMyReviews,
  handleUpdateMyProfile,
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

// .env에 키가 채워진 제공자만 등록한다.
for (const provider of socialProviders) {
  if (provider.strategy) {
    passport.use(provider.strategy);
  }
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));


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

app.use(
  session({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // ms
    },
    resave: false,
    saveUninitialized: false,
    secret: process.env.EXPRESS_SESSION_SECRET,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, // ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(passport.initialize());
app.use(passport.session());



app.get("/", (req, res) => {
  // #swagger.ignore = true
  console.log(req.user);
  res.send("Hello World!");
});

app.post("/api/v1/users/sign-up", handleUserSignUp); // 회원가입

app.post("/api/v1/regions/:regionId/stores", handleAddStore); // 특정 지역에 가게 추가
app.post("/api/v1/reviews/:storeId", requireAuth, handleAddReview); // 가게에 리뷰 추가 (로그인한 사용자가 작성자가 된다)
app.post("/api/v1/stores/:storeId/missions", handleAddMission); // 가게에 미션 추가
app.post(
  "/api/v1/missions/:missionId/challenge",
  requireAuth,
  handleChallengeMission
); // 미션 도전하기 (로그인한 사용자가 도전한다)
app.get("/api/v1/stores/:storeId/reviews", handleListStoreReviews); // 가게 리뷰 목록 조회
app.get("/api/v1/stores/:storeId/missions", handleListStoreMissions); // 가게 미션 목록 조회

/*** 소셜 로그인 ***/
// /oauth2/login/<제공자> 로 들어오면 해당 제공자의 로그인 화면으로 보내고,
// 로그인을 마치면 /oauth2/callback/<제공자> 로 돌아와 세션을 만든 뒤 "/"로 보낸다.
// 제공자마다 하는 일이 같으므로 목록을 돌며 한 번에 등록한다.
for (const { name, label, strategy, missingEnv } of socialProviders) {
  const loginPath = `/oauth2/login/${name}`;
  const callbackPath = `/oauth2/callback/${name}`;

  // 키가 없는 제공자는 라우트는 남겨두되, 부르면 이유를 알려준다.
  // (등록조차 하지 않으면 404가 나서 오타인지 설정 누락인지 구분되지 않는다)
  if (!strategy) {
    const notConfigured = (req, res, next) =>
      next(new SocialProviderNotConfiguredError({ provider: name, missingEnv }));
    app.get(loginPath, notConfigured);
    app.get(callbackPath, notConfigured);
    continue;
  }

  app.get(loginPath, passport.authenticate(name));
  app.get(
    callbackPath,
    passport.authenticate(name, {
      failureRedirect: loginPath,
      failureMessage: true,
    }),
    (req, res) => res.redirect("/")
  );
  console.log(`${label} 로그인 사용 가능: ${loginPath}`);
}

for (const { label, strategy, missingEnv } of socialProviders) {
  if (!strategy) {
    console.warn(`${label} 로그인 꺼짐 - .env에 ${missingEnv.join(", ")}가 없습니다.`);
  }
}

// 로그아웃. 세션 스토어(session 테이블)의 기록까지 지워야 쿠키만 남는 상황을 막을 수 있다.
app.post("/oauth2/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return next(destroyErr);
      }
      res.clearCookie("connect.sid");
      res.success({ loggedOut: true });
    });
  });
});

/*** 로그인한 사용자("me") 전용 API ***/
// 어떤 사용자인지는 세션에서 정해진다. requireAuth가 세션이 없는 요청을 401로 막는다.
app.get("/api/v1/users/me", requireAuth, handleGetMyProfile); // 내 정보 조회
app.patch("/api/v1/users/me", requireAuth, handleUpdateMyProfile); // 내 정보 수정
app.get("/api/v1/users/me/reviews", requireAuth, handleListMyReviews); // 내가 작성한 리뷰 목록
app.get("/api/v1/users/me/missions", requireAuth, handleListMyMissions); // 내가 진행 중인 미션 목록
app.patch(
  "/api/v1/users/me/missions/:userMissionId/complete",
  requireAuth,
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
