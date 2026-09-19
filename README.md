# nodejs_practice

Node.js 공부 기록 저장소. Express와 MySQL로 음식점 미션 서비스 API를 만들어보고 있습니다.
DB 접근은 Prisma ORM으로 합니다.

## 환경

- Node.js 24 (`.nvmrc` 참고)
- npm 11
- MySQL 8
- Prisma ORM 7

## 실행

```bash
npm install      # 의존성 설치
npm start        # 서버 실행 (src/index.js)
npm run dev      # 파일 변경 시 자동 재시작 (nodemon)
npm run db:check # .env 정보로 MySQL에 붙는지 확인
```

`prisma/schema.prisma`를 바꾸거나 DB 스키마가 바뀌면 Prisma Client를 다시 만들어야 합니다.

```bash
npx prisma db pull   # 실제 DB 스키마를 schema.prisma로 가져오기
npx prisma generate  # schema.prisma로 Prisma Client 생성 (src/generated/prisma)
npx prisma studio    # 브라우저로 데이터 확인
```

`.env.example`을 복사해 `.env`를 만들고 DB 접속 정보를 채웁니다.

```bash
cp .env.example .env
```

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `PORT` | 서버 포트 | 3000 |
| `DATABASE_URL` | MySQL 접속 URL. Prisma Client와 Prisma CLI가 함께 사용합니다. | `mysql://root:password@localhost:3306/node_study` |

서버는 뜨기 전에 DB 연결을 먼저 확인하고, 실패하면 바로 종료됩니다.

## 폴더 구조

요청은 `controller → service → repository` 순서로 흐르고, 요청/응답 형태 변환은 DTO가 담당합니다.

```
prisma/schema.prisma        # DB 스키마 (prisma db pull로 가져온 모델 정의)
prisma7.config.ts           # Prisma CLI 설정 (schema 위치, DATABASE_URL)
src/
├── index.js                # 앱 설정, 라우트 등록, 에러 핸들러
├── db.config.js            # Prisma Client 생성 (mariadb 드라이버 어댑터)
├── errors.js               # 도메인별 커스텀 에러 클래스(ServiceError 상속)
├── controllers/            # 요청을 받아 DTO로 변환하고 서비스를 호출
├── services/               # 검증과 비즈니스 규칙, 트랜잭션(prisma.$transaction)
├── repositories/           # Prisma Client 쿼리 실행
├── dtos/                   # 요청 body → 내부 객체, DB row → 응답 형태
├── generated/prisma/       # prisma generate로 만들어진 Prisma Client (git 제외)
├── utils/validation.js     # id·문자열·날짜 등 공통 입력 검증
├── utils/pagination.js     # 커서 기반 페이지네이션 공통 처리
├── utils/bigint.js         # BigInt(id)를 JSON으로 내보내기 위한 설정
├── utils/prisma-error.js   # Prisma 제약 위반을 커스텀 에러로 바꾸기 위한 헬퍼
└── scripts/check-db.js     # DB 연결 확인 스크립트
docs/api-check.md           # 응답 규격을 터미널에서 확인하는 명령 모음
```

DB 접근은 전부 Prisma Client API로만 합니다. 원시 SQL(`$queryRaw`, `$executeRaw`)은 쓰지 않습니다.

## API

모든 경로는 `/api/v1` 하위이고, 요청과 응답 모두 JSON입니다. 성공이든 실패든 아래 한 가지 형태로만 응답합니다.

```json
{ "resultType": "SUCCESS", "error": null, "success": { }  }
{ "resultType": "FAIL",    "error": { "errorCode": "U001", "reason": "...", "data": { } }, "success": null }
```

아직 로그인 기능이 없어서, 사용자가 필요한 API는 `user_id`를 쓰고 값이 없으면 DB의 첫 번째 사용자로 처리합니다. POST·PATCH는 body로, GET은 query(`?user_id=1`)로 받습니다. 경로의 `me`는 로그인 기능이 생기면 로그인한 사용자를 뜻하게 됩니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/v1/users/sign-up` | 회원가입 (선호 음식 카테고리 함께 저장) |
| POST | `/api/v1/regions/:regionId/stores` | 특정 지역에 가게 추가 |
| POST | `/api/v1/reviews/:storeId` | 가게에 리뷰 추가 |
| GET | `/api/v1/stores/:storeId/reviews` | 가게의 리뷰 목록 |
| POST | `/api/v1/stores/:storeId/missions` | 가게에 미션 추가 |
| GET | `/api/v1/stores/:storeId/missions` | 가게의 도전 가능한 미션 목록 |
| POST | `/api/v1/missions/:missionId/challenge` | 미션 도전하기 |
| GET | `/api/v1/users/me/reviews` | 내가 작성한 리뷰 목록 |
| GET | `/api/v1/users/me/missions` | 내가 진행 중인 미션 목록 |
| PATCH | `/api/v1/users/me/missions/:userMissionId/complete` | 진행 중인 미션을 진행 완료로 바꾸기 |
| GET | `/health/db` | DB 헬스 체크 |

생성 API(회원가입, 가게·리뷰·미션 추가, 미션 도전)는 `201 Created`로, 조회와 미션 완료는 `200 OK`로 응답합니다.

### 목록 조회 (커서 기반 페이지네이션)

목록 API는 모두 id 오름차순으로 5개씩 내려줍니다. 응답의 `pagination.cursor`를 다음 요청의 `?cursor=`에 넣으면 이어서 조회합니다. 더 조회할 데이터가 없으면 `cursor`는 `null`, `hasNext`는 `false`입니다.

```http
GET /api/v1/users/me/reviews?user_id=1&cursor=5
```

```json
{
  "resultType": "SUCCESS",
  "error": null,
  "success": {
    "data": [
      {
        "review_id": 6,
        "store_id": 1,
        "store_name": "반이학생마라탕",
        "nickname": "nickname012",
        "rating": 5,
        "review_content": "음 너무 맛있어요!",
        "review_image_urls": [],
        "created_at": "2026-09-13T18:33:01.000Z"
      }
    ],
    "pagination": { "cursor": null, "hasNext": false }
  }
}
```

- 리뷰 목록은 삭제된(`deleted_at`이 있는) 리뷰를 제외합니다.
- 가게 미션 목록은 지금 도전할 수 있는 미션(`OPEN`, 시작일이 지났고 마감일 전)만 보여줍니다.
- 진행 중인 미션 목록은 `IN_PROGRESS`, `REQUESTED` 상태이고 도전 기한이 남은 미션만 보여줍니다.

### 가게 추가

```http
POST /api/v1/regions/1/stores
```

```json
{
  "store_category_id": 2,
  "store_name": "UP TO ME",
  "store_address": "서울시 마포구 성미산로 165-6",
  "operating_hours": "12:00 - 22:00"
}
```

`operating_hours`는 `open_time`과 `close_time` 컬럼으로 나눠 저장합니다. 지역과 카테고리가 실제로 있는지 확인합니다.

### 리뷰 추가

```http
POST /api/v1/reviews/1
```

```json
{
  "user_id": 1,
  "review_content": "코스 요리 좋네요 어버이날 재밌게 보냈습니다~",
  "rating": 5,
  "review_image_url": "https://example.com/review-image.jpg"
}
```

리뷰를 추가하려는 **가게가 존재하는지 검증**합니다. 리뷰 저장, 이미지 저장, 가게의 평균 평점·리뷰 수 갱신을 하나의 트랜잭션으로 처리합니다.

평균 평점은 기존 값으로 계산하지 않고 `reviews` 테이블에서 다시 집계합니다. 컬럼끼리 곱하고 나누는 `UPDATE`는 Prisma Client API로 표현할 수 없기 때문이고, 값이 틀어져 있어도 새 리뷰가 들어올 때 바로잡히는 장점도 있습니다. 이 집계가 직전에 커밋된 리뷰까지 보도록 해당 트랜잭션은 `READ COMMITTED`로 실행합니다.

### 미션 추가

```http
POST /api/v1/stores/1/missions
```

```json
{
  "mission_name": "UP TO ME 방문 인증샷 올리기",
  "description": "매장 방문 후 인증샷을 업로드해주세요.",
  "reward_point": 100,
  "due_date": "2026-12-31T23:59:59.000Z"
}
```

미션의 지역은 가게가 속한 지역을 따르고, `due_date`는 `closed_at` 컬럼에 저장합니다. 마감일은 현재 시각 이후여야 합니다.

### 미션 도전

```http
POST /api/v1/missions/6/challenge
```

```json
{
  "user_id": 1
}
```

**이미 도전 중인 미션인지 검증**합니다(`IN_PROGRESS` 또는 `REQUESTED` 상태). 선착순 인원은 "아직 자리가 남아 있을 때만" 이라는 조건을 `UPDATE`의 `WHERE`에 함께 넣어 한 번에 차지하므로, 동시에 요청이 몰려도 정원을 넘지 않습니다. 그래도 통과한 동시 요청은 `user_missions`의 유니크 제약(`uk_um_active`)에서 걸리는데, 이 경우도 500이 아니라 `M004`로 응답합니다. 가게·보상·기한은 요청 body가 아니라 DB에 저장된 미션 정보를 사용합니다. 클라이언트가 보낸 보상 포인트를 그대로 믿으면 값을 조작해 요청할 수 있기 때문입니다. 도전 기한은 `지금 + challenge_days`이며 미션 마감일을 넘지 않습니다.

### 미션 완료

```http
PATCH /api/v1/users/me/missions/7/complete
```

```json
{
  "user_id": 1,
  "paid_amount": 16000
}
```

미션을 `SUCCESS`로 바꾸고 보상 포인트를 지급합니다. 상태 변경, 포인트 잔액 증가, 포인트 내역 저장, 지역 미션 성공 횟수 증가를 하나의 트랜잭션으로 처리합니다.

- `POINT` 미션은 `reward_point`만큼, `RATE` 미션은 `paid_amount × reward_rate%`만큼 지급합니다. `paid_amount`는 `RATE` 미션에서만 필요합니다.
- 다른 사용자의 미션이면 404(`M005`), 진행 중이 아니면 409(`M006`), 도전 기한이 지났으면 400(`M007`)으로 응답합니다.
- 완료 요청이 동시에 들어와도 포인트가 한 번만 지급되도록, "아직 진행 중이고 기한이 남아 있을 때만" 이라는 조건을 상태 변경 `UPDATE`의 `WHERE`에 함께 넣습니다. 먼저 도착한 요청만 성공하고 나머지는 `M006`이 됩니다.

### 에러 응답

의도적으로 던지는 오류는 모두 `src/errors.js`의 `ServiceError`를 상속한 커스텀 에러입니다. 전역 에러 핸들러가 `statusCode`로 HTTP 상태 코드를, `errorCode`·`reason`·`data`로 응답 본문을 만듭니다. `data`에는 어떤 값 때문에 실패했는지가 담깁니다.

```json
{
  "resultType": "FAIL",
  "error": {
    "errorCode": "U001",
    "reason": "이미 존재하는 이메일입니다.",
    "data": { "email": "test@example.com", "name": "엘빈" }
  },
  "success": null
}
```

`errorCode`는 도메인 머리글자와 일련번호로 붙입니다.

| 코드 | 클래스 | 상태 | 설명 |
| --- | --- | --- | --- |
| C000 | - | 500 | 예상하지 못한 서버 오류 (원인은 서버 로그에만 남김) |
| C001 | `BadRequestError` | 400 | 요청 값 형식 오류 |
| C002 | `NotFoundError` | 404 | 리소스 없음 (기본값) |
| C003 | `ConflictError` | 409 | 상태 충돌 (기본값) |
| C004 | `RouteNotFoundError` | 404 | 등록되지 않은 경로 |
| C005 | `InvalidJsonError` | 400 | 본문이 올바른 JSON이 아님 |
| U001 | `DuplicateUserEmailError` | 409 | 이미 존재하는 이메일 |
| U002 | `UserNotFoundError` | 404 | 존재하지 않는 사용자 |
| U003 | `NoRegisteredUserError` | 404 | 등록된 사용자가 한 명도 없음 |
| S001 | `StoreNotFoundError` | 404 | 존재하지 않는 가게 |
| S002 | `StoreNotActiveError` | 400 | 영업 중이 아닌 가게 |
| S003 | `RegionNotFoundError` | 404 | 존재하지 않는 지역 |
| S004 | `RegionNotActiveError` | 400 | 서비스하지 않는 지역 |
| S005 | `FoodCategoryNotFoundError` | 404 | 존재하지 않는 음식 카테고리 |
| M001 | `MissionNotFoundError` | 404 | 존재하지 않는 미션 |
| M002 | `MissionNotOpenError` | 400 | 지금 도전할 수 없는 미션 |
| M003 | `MissionQuotaExceededError` | 409 | 선착순 마감 |
| M004 | `DuplicateMissionChallengeError` | 409 | 이미 도전 중인 미션 |
| M005 | `UserMissionNotFoundError` | 404 | 존재하지 않는 도전 미션 |
| M006 | `UserMissionNotInProgressError` | 409 | 진행 중이 아닌 미션 |
| M007 | `UserMissionExpiredError` | 400 | 도전 기한이 지난 미션 |
| M008 | `PaidAmountRequiredError` | 400 | `RATE` 미션인데 `paid_amount`가 없음 |

새 오류를 추가할 때는 반드시 `ServiceError`를 상속해야 합니다. 그렇지 않으면 `errorCode`가 `unknown`으로 나갑니다.

DB 유니크 제약 위반(`P2002`)처럼 사전 검사를 통과한 동시 요청이 DB에서 걸리는 경우도 500으로 흘려보내지 않고, `src/utils/prisma-error.js`로 어떤 제약인지 확인해 알맞은 커스텀 에러로 바꿔 던집니다.

응답 규격을 터미널에서 직접 확인하는 명령은 [`docs/api-check.md`](docs/api-check.md)에 정리해두었습니다.

## DB

테이블은 MySQL에 직접 만들어 사용하고 있습니다. 미션 설명을 저장하려면 `missions` 테이블에 컬럼이 하나 필요합니다.

```sql
ALTER TABLE missions ADD COLUMN description VARCHAR(500) NULL AFTER title;
```

## 학습 기록

| 날짜 | 주제 | 폴더 | 메모 |
| --- | --- | --- | --- |
| 2026-09-11 | 초기 세팅 | - | 프로젝트 생성 |
| 2026-09-13 | DB 연동 | `src/` | MySQL 커넥션 풀, 테이블 설계 |
| 2026-09-15 | 회원가입 API | `src/` | controller-service-repository 계층 분리, DTO |
| 2026-09-16 | 가게·리뷰·미션 API | `src/` | 트랜잭션, 에러 상태 코드 처리 |
| 2026-09-17 | 목록 조회 API | `src/` | Prisma ORM 전환 마무리, 커서 기반 페이지네이션, 미션 완료 |
| 2026-09-19 | 응답 규격·오류 처리 | `src/`, `docs/` | 공통 응답 규격 통일, 도메인별 커스텀 에러, 원시 SQL 제거 |
