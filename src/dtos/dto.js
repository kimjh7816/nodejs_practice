import {
  optionalDate,
  optionalId,
  optionalString,
  parseIdList,
  requireEmail,
  requireString,
} from "../utils/validation.js";

// 다양한 입력(한글/영문/약자)을 users.gender ENUM 값으로 변환한다.
const normalizeGender = (value) => {
  const key = String(value ?? "").trim().toLowerCase();
  const map = {
    male: "MALE", m: "MALE", 남: "MALE", 남성: "MALE", 남자: "MALE",
    female: "FEMALE", f: "FEMALE", 여: "FEMALE", 여성: "FEMALE", 여자: "FEMALE",
    none: "NONE", "": "NONE",
  };
  return map[key] ?? "NONE";
};

// 검증하지 않고 넘기면 DB 제약(NOT NULL, 길이, UNIQUE)에 걸려 500이 나므로
// 컬럼 정의에 맞춰 여기서 먼저 걸러낸다.
export const bodyToUser = (body = {}) => ({
  email: requireEmail(body.email),
  name: requireString(body.name, "name", 50),
  gender: normalizeGender(body.gender),
  birth: optionalDate(body.birth, "birth"),
  address: optionalString(body.address, "address", 200) ?? "",
  detailAddress: optionalString(body.detailAddress, "detailAddress", 100) ?? "",
  phoneNumber: optionalString(body.phoneNumber, "phoneNumber", 20),
  preferences: parseIdList(body.preferences, "preferences"),
});

// 내 정보 수정 요청(PATCH)을 변환한다.
//
// PATCH는 보낸 항목만 바꾸는 것이므로, 아예 보내지 않은 항목(undefined)과
// 비우겠다고 보낸 항목(null 또는 "")을 구분해야 한다.
// - 키가 없으면        -> 결과 객체에도 키가 없다 (서비스가 건너뛴다)
// - null 또는 "" 이면  -> null (해당 컬럼을 비운다)
export const bodyToUpdateMe = (body = {}) => {
  const data = {};
  const has = (key) => body[key] !== undefined;
  const isEmpty = (key) => body[key] === null || body[key] === "";

  // name은 NOT NULL 컬럼이라 비울 수 없다.
  if (has("name")) data.name = requireString(body.name, "name", 50);
  if (has("nickname"))
    data.nickname = optionalString(body.nickname, "nickname", 20);
  if (has("gender")) data.gender = normalizeGender(body.gender);
  if (has("birth")) data.birth = optionalDate(body.birth, "birth");
  if (has("address")) data.address = optionalString(body.address, "address", 200);
  if (has("detailAddress"))
    data.detailAddress = optionalString(body.detailAddress, "detailAddress", 100);
  if (has("phoneNumber"))
    data.phoneNumber = optionalString(body.phoneNumber, "phoneNumber", 20);
  if (has("regionId"))
    data.regionId = isEmpty("regionId")
      ? null
      : optionalId(body.regionId, "regionId");
  // 선호 카테고리는 보낸 목록으로 통째로 교체한다. 빈 배열을 보내면 전부 지운다.
  if (has("preferences"))
    data.preferences = parseIdList(body.preferences, "preferences");

  return data;
};

// DB 조회 결과(user, preferences)를 클라이언트에 내려줄 응답 형태로 변환
export const responseFromUser = ({ user, preferences }) => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    gender: user.gender,
    regionId: user.region_id,
    birth: user.birth_date,
    address: user.address1,
    detailAddress: user.address2,
    phoneNumber: user.phone,
    // 선호 카테고리는 JOIN으로 가져온 카테고리 이름만 배열로 내려준다.
    preferCategory: preferences.map((preference) => preference.name),
  };
};