import dotenv from "dotenv";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as NaverStrategy } from "passport-naver-v2";

import { prisma } from "./db.config.js";
import { SocialEmailRequiredError } from "./errors.js";

dotenv.config();

// 콜백 URL은 각 제공자 콘솔에 등록한 값과 한 글자도 다르면 안 된다.
// 배포 주소가 달라질 수 있으므로 .env의 BASE_URL로 바꿔 끼울 수 있게 해둔다.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// 키가 채워진 제공자만 켠다.
//
// 키가 없다고 서버를 통째로 못 띄우게 하면, 아직 앱 등록을 못 한 제공자 하나 때문에
// 나머지 API까지 막힌다. 대신 그 제공자의 로그인만 꺼두고 기동 시 어떤 키가 없는지 알려준다.
// (키가 비어 있는 채로 전략을 만들면 passport가 "OAuth2Strategy requires a clientID option"
//  처럼 어디가 문제인지 알기 어려운 메시지로 죽어버린다)
const missingEnv = (...keys) => keys.filter((key) => !process.env[key]);

/*** 제공자 공통 로그인 처리 ***/

// 소셜 로그인으로 들어온 사용자를 찾거나 만들고, 연결 기록을 남긴다.
//
// 사용자 식별 기준은 이메일이다. 같은 이메일로 구글과 네이버를 모두 쓰면 한 계정으로 합쳐지고,
// user_social_accounts에 어느 제공자로 로그인했는지가 각각 남는다.
const socialLogin = async (provider, { providerUserId, email, ...optional }) => {
  if (!email) {
    // 네이버는 사용자가 이메일 제공에 동의하지 않으면 email이 비어서 온다.
    throw new SocialEmailRequiredError({ provider });
  }

  return prisma.$transaction(async (tx) => {
    let user = await tx.users.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (user === null) {
      // 처음 로그인한 사용자. 제공자가 준 항목만 채우고 나머지는 비워둔다.
      // (부족한 정보는 PATCH /api/v1/users/me 로 사용자가 직접 채운다)
      user = await tx.users.create({
        data: {
          email,
          name: optional.name ?? email.split("@")[0],
          gender: optional.gender ?? "NONE",
          birth_date: optional.birthDate ?? null,
          phone: optional.phone ?? null,
        },
        select: { id: true, email: true, name: true },
      });
    }

    // 같은 제공자로 다시 로그인하면 연결 기록은 이미 있으므로 새로 만들지 않는다.
    await tx.user_social_accounts.upsert({
      where: {
        provider_provider_user_id: { provider, provider_user_id: providerUserId },
      },
      create: {
        user_id: user.id,
        provider,
        provider_user_id: providerUserId,
      },
      update: {},
    });

    await tx.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    return user;
  });
};

// passport의 verify 콜백은 Promise가 아니라 (err, user) 형태의 콜백을 기대한다.
const toVerifyCallback = (promise, cb) =>
  promise.then((user) => cb(null, user)).catch((err) => cb(err));

/*** Google ***/

const googleMissing = missingEnv(
  "PASSPORT_GOOGLE_CLIENT_ID",
  "PASSPORT_GOOGLE_CLIENT_SECRET"
);

export const googleStrategy = googleMissing.length > 0 ? null : new GoogleStrategy(
  {
    clientID: process.env.PASSPORT_GOOGLE_CLIENT_ID,
    clientSecret: process.env.PASSPORT_GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/oauth2/callback/google`,
    scope: ["email", "profile"],
    state: true,
  },
  (accessToken, refreshToken, profile, cb) =>
    toVerifyCallback(
      socialLogin("GOOGLE", {
        providerUserId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      }),
      cb
    )
);

/*** Naver ***/

// 네이버는 성별을 M/F/U로 준다. users.gender ENUM(MALE/FEMALE/NONE)으로 바꾼다.
const naverGender = (value) =>
  ({ M: "MALE", F: "FEMALE" })[value] ?? "NONE";

// 네이버는 생년월일을 birthYear("1999")와 birthday("02-03")로 나눠서 준다.
// 둘 다 있어야 날짜를 만들 수 있고, 하나라도 없으면 비워둔다.
const naverBirthDate = ({ birthYear, birthday }) => {
  if (!birthYear || !birthday) {
    return null;
  }
  const date = new Date(`${birthYear}-${birthday}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const naverMissing = missingEnv(
  "PASSPORT_NAVER_CLIENT_ID",
  "PASSPORT_NAVER_CLIENT_SECRET"
);

export const naverStrategy = naverMissing.length > 0 ? null : new NaverStrategy(
  {
    clientID: process.env.PASSPORT_NAVER_CLIENT_ID,
    clientSecret: process.env.PASSPORT_NAVER_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/oauth2/callback/naver`,
  },
  (accessToken, refreshToken, profile, cb) =>
    toVerifyCallback(
      socialLogin("NAVER", {
        providerUserId: profile.id,
        email: profile.email,
        // 네이버는 실명(name)과 별명(nickname)을 따로 준다. 실명이 없으면 별명으로 대신한다.
        name: profile.name ?? profile.nickname,
        gender: naverGender(profile.gender),
        // mobile은 "010-1234-5678" 형태로 온다. phone 컬럼이 VARCHAR(20)이라 그대로 들어간다.
        phone: profile.mobile ?? null,
        birthDate: naverBirthDate(profile),
      }),
      cb
    )
);

/*** 등록된 제공자 목록 ***/
// index.js가 이 목록을 돌며 passport 전략과 라우트를 등록한다.
// 제공자를 추가할 때 여기에 한 줄만 더하면 되도록 모아둔다.
export const socialProviders = [
  { name: "google", label: "Google", strategy: googleStrategy, missingEnv: googleMissing },
  { name: "naver", label: "Naver", strategy: naverStrategy, missingEnv: naverMissing },
];
