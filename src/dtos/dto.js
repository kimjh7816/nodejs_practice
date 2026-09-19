import {
  optionalDate,
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

// DB 조회 결과(user, preferences)를 클라이언트에 내려줄 응답 형태로 변환
export const responseFromUser = ({ user, preferences }) => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    gender: user.gender,
    birth: user.birth_date,
    address: user.address1,
    detailAddress: user.address2,
    phoneNumber: user.phone,
    // 선호 카테고리는 JOIN으로 가져온 카테고리 이름만 배열로 내려준다.
    preferCategory: preferences.map((preference) => preference.name),
  };
};