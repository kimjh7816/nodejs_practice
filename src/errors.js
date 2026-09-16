import { StatusCodes } from "http-status-codes";

// 에러 핸들러가 statusCode를 보고 알맞은 HTTP 상태 코드로 응답할 수 있게 한다.
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends HttpError {
  constructor(message) {
    super(StatusCodes.BAD_REQUEST, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message) {
    super(StatusCodes.NOT_FOUND, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message) {
    super(StatusCodes.CONFLICT, message);
  }
}
