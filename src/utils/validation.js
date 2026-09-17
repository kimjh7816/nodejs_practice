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
