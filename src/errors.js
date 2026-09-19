import { StatusCodes } from "http-status-codes";

/**
 * 이 프로젝트에서 의도적으로 던지는 모든 오류의 부모 클래스.
 *
 * 전역 오류 처리 미들웨어(index.js)가 이 객체를 받아
 *   - statusCode  -> HTTP 상태 코드
 *   - errorCode / reason / data -> 응답 본문의 error 객체
 * 로 변환한다. 새 오류를 만들 때 이 클래스를 상속해야 errorCode가 "unknown"으로 떨어지지 않는다.
 *
 * errorCode 체계 (도메인 머리글자 + 일련번호)
 *   C: 공통(Common)   U: 사용자(User)   S: 가게/지역(Store)   M: 미션(Mission)
 */
export class ServiceError extends Error {
  constructor({ errorCode, statusCode, reason, data = null }) {
    super(reason);
    this.name = new.target.name; // 실제로 던져진 하위 클래스 이름이 스택에 찍히도록
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.reason = reason;
    this.data = data;
  }
}

/*** 공통 오류 ***/

// 요청 값의 형식이 잘못된 경우 (validation, DTO 변환 단계)
export class BadRequestError extends ServiceError {
  constructor(reason, data = null, errorCode = "C001") {
    super({ errorCode, statusCode: StatusCodes.BAD_REQUEST, reason, data });
  }
}

// 대상 리소스를 찾지 못한 경우
export class NotFoundError extends ServiceError {
  constructor(reason, data = null, errorCode = "C002") {
    super({ errorCode, statusCode: StatusCodes.NOT_FOUND, reason, data });
  }
}

// 현재 리소스 상태와 요청이 충돌하는 경우 (중복 생성 등)
export class ConflictError extends ServiceError {
  constructor(reason, data = null, errorCode = "C003") {
    super({ errorCode, statusCode: StatusCodes.CONFLICT, reason, data });
  }
}

// 등록되지 않은 경로로 요청이 들어온 경우
export class RouteNotFoundError extends NotFoundError {
  constructor(method, path) {
    super(`${method} ${path} 경로를 찾을 수 없습니다.`, { method, path }, "C004");
  }
}

// 본문이 올바른 JSON이 아닌 경우 (express.json()이 던지는 SyntaxError를 감싼다)
export class InvalidJsonError extends BadRequestError {
  constructor() {
    super("요청 본문이 올바른 JSON 형식이 아닙니다.", null, "C005");
  }
}

/*** 사용자(User) 오류 ***/

export class DuplicateUserEmailError extends ConflictError {
  constructor(data = null) {
    super("이미 존재하는 이메일입니다.", data, "U001");
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(data = null) {
    super("존재하지 않는 사용자입니다.", data, "U002");
  }
}

// 로그인 기능이 없어 user_id를 생략했는데 DB에 사용자가 한 명도 없는 경우
export class NoRegisteredUserError extends NotFoundError {
  constructor() {
    super("등록된 사용자가 없습니다.", null, "U003");
  }
}

/*** 가게 / 지역(Store) 오류 ***/

export class StoreNotFoundError extends NotFoundError {
  constructor(data = null) {
    super("존재하지 않는 가게입니다.", data, "S001");
  }
}

export class StoreNotActiveError extends BadRequestError {
  constructor(data = null) {
    super("영업 중인 가게가 아닙니다.", data, "S002");
  }
}

export class RegionNotFoundError extends NotFoundError {
  constructor(data = null) {
    super("존재하지 않는 지역입니다.", data, "S003");
  }
}

export class RegionNotActiveError extends BadRequestError {
  constructor(data = null) {
    super("서비스하지 않는 지역입니다.", data, "S004");
  }
}

export class FoodCategoryNotFoundError extends NotFoundError {
  constructor(data = null) {
    super("존재하지 않는 음식 카테고리입니다.", data, "S005");
  }
}

/*** 미션(Mission) 오류 ***/

export class MissionNotFoundError extends NotFoundError {
  constructor(data = null) {
    super("존재하지 않는 미션입니다.", data, "M001");
  }
}

export class MissionNotOpenError extends BadRequestError {
  constructor(data = null) {
    super("현재 도전할 수 없는 미션입니다.", data, "M002");
  }
}

export class MissionQuotaExceededError extends ConflictError {
  constructor(data = null) {
    super("선착순 인원이 마감된 미션입니다.", data, "M003");
  }
}

export class DuplicateMissionChallengeError extends ConflictError {
  constructor(data = null) {
    super("이미 도전 중인 미션입니다.", data, "M004");
  }
}

// 다른 사용자의 미션은 존재 여부 자체를 알려주지 않기 위해 이 오류로 응답한다.
export class UserMissionNotFoundError extends NotFoundError {
  constructor(data = null) {
    super("존재하지 않는 도전 미션입니다.", data, "M005");
  }
}

export class UserMissionNotInProgressError extends ConflictError {
  constructor(data = null) {
    super("진행 중인 미션이 아닙니다.", data, "M006");
  }
}

export class UserMissionExpiredError extends BadRequestError {
  constructor(data = null) {
    super("도전 기한이 지난 미션입니다.", data, "M007");
  }
}

export class PaidAmountRequiredError extends BadRequestError {
  constructor(data = null) {
    super("결제 금액 비율로 보상하는 미션은 paid_amount가 필요합니다.", data, "M008");
  }
}
