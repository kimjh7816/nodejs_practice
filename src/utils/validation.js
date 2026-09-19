import { BadRequestError } from "../errors.js";

// 1 이상의 정수 id인지 확인한다. (path parameter, body의 *_id 값에 사용)
export const parseId = (value, fieldName) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new BadRequestError(`${fieldName}는 1 이상의 정수여야 합니다.`);
  }
  return id;
};

// 값이 없으면 undefined, 있으면 parseId와 같은 규칙으로 검사한다. (선택 입력인 user_id 등에 사용)
export const optionalId = (value, fieldName) =>
  value === undefined ? undefined : parseId(value, fieldName);

// 커서 페이지네이션의 cursor. 값이 없으면 처음부터(0) 조회한다.
export const parseCursor = (value) =>
  value === undefined ? 0 : parseId(value, "cursor");

// 1 이상의 정수인지 확인한다. (금액 등 id가 아닌 숫자 입력에 사용)
export const parsePositiveInt = (value, fieldName) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new BadRequestError(`${fieldName}는 1 이상의 정수여야 합니다.`);
  }
  return number;
};

// 0 이상의 정수인지 확인한다. (offset 등 0을 허용해야 하는 값에 사용)
export const parseOffset = (value, fieldName = "offset") => {
  if (value === undefined || value === "") {
    return 0;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new BadRequestError(`${fieldName}는 0 이상의 정수여야 합니다.`);
  }
  return number;
};

// 비어있지 않은 문자열인지 확인하고, 앞뒤 공백을 제거해서 돌려준다.
export const requireString = (value, fieldName, maxLength) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(`${fieldName}는 필수입니다.`);
  }
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw new BadRequestError(`${fieldName}는 ${maxLength}자 이하여야 합니다.`);
  }
  return trimmed;
};

// 값이 없으면 null, 있으면 requireString과 같은 규칙으로 검사한다.
export const optionalString = (value, fieldName, maxLength) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return requireString(value, fieldName, maxLength);
};

// 이메일 형식 검사. DB의 email 컬럼은 VARCHAR(255) UNIQUE 이므로 길이도 함께 본다.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const requireEmail = (value, fieldName = "email") => {
  const email = requireString(value, fieldName, 255);
  if (!EMAIL_REGEX.test(email)) {
    throw new BadRequestError(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  // 대소문자만 다른 이메일이 중복 가입되지 않도록 소문자로 맞춘다.
  return email.toLowerCase();
};

// 필수 날짜 값. "2000-02-03" 같은 문자열을 Date로 바꾼다.
export const requireDate = (value, fieldName) => {
  const date = new Date(value);
  if (value === undefined || value === null || Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName}는 올바른 날짜 형식이어야 합니다.`);
  }
  return date;
};

// 값이 없으면 null, 있으면 requireDate와 같은 규칙으로 검사한다.
export const optionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return requireDate(value, fieldName);
};

// id 배열인지 확인한다. (선호 카테고리 목록 등)
export const parseIdList = (value, fieldName) => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestError(`${fieldName}는 배열이어야 합니다.`);
  }
  // 같은 값을 두 번 보내면 유니크 제약에 걸리므로 중복을 제거한다.
  return [...new Set(value.map((item) => parseId(item, fieldName)))];
};
