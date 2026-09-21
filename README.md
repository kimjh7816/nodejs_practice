# nodejs_practice

Node.js 공부 기록 저장소. Express와 MySQL로 음식점 미션 서비스 API를 만들어보고 있습니다.
DB 접근은 Prisma ORM으로 하고, 로그인은 Passport로 구글·네이버 소셜 로그인을 씁니다.

## 환경

- Node.js 24 (`.nvmrc` 참고)
- npm 11
- MySQL 8
- Prisma ORM 7
- Passport (`passport-google-oauth20`, `passport-naver-v2`) + `express-session` + `@quixo3/prisma-session-store`

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
npx prisma db push   # schema.prisma의 변경을 실제 DB에 반영하기
npx prisma generate  # schema.prisma로 Prisma Client 생성 (src/generated/prisma)
npx prisma studio    # 브라우저로 데이터 확인
```

방향이 반대인 두 명령입니다. `db pull`은 DB → 스키마 파일, `db push`는 스키마 파일 → DB입니다.
`schema.prisma`에 모델을 추가하기만 하고 `db push`를 하지 않으면, Prisma는 그 테이블이 있다고 믿는데
DB에는 없어서 `The table ... does not exist in the current database` 오류가 납니다.

`db push`를 하기 전에 어떤 SQL이 실행될지 먼저 확인할 수 있습니다. 예상치 못한 `DROP`이나 `ALTER`가
섞여 있지 않은지 보고 나서 반영하는 습관을 들이는 게 좋습니다.

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

이 저장소는 `migrate dev`를 쓰지 않습니다. 테이블을 SQL로 먼저 만들고 `db pull`로 스키마를 가져온
구조라 마이그레이션 히스토리가 없고, 이 상태에서 `migrate dev`를 돌리면 "히스토리가 없으니 DB를
리셋하자"고 제안해 데이터가 날아갈 수 있기 때문입니다.

`.env.example`을 복사해 `.env`를 만들고 DB 접속 정보를 채웁니다.

```bash
cp .env.example .env
```

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `PORT` | 서버 포트 | 3000 |
| `DATABASE_URL` | MySQL 접속 URL. Prisma Client와 Prisma CLI가 함께 사용합니다. | `mysql://root:password@localhost:3306/node_study` |
| `BASE_URL` | 소셜 로그인 콜백 URL의 앞부분. 없으면 `http://localhost:3000` | `http://localhost:3000` |
| `EXPRESS_SESSION_SECRET` | 세션 쿠키 서명 키 | 아무 긴 문자열 |
| `PASSPORT_GOOGLE_CLIENT_ID` / `PASSPORT_GOOGLE_CLIENT_SECRET` | Google Cloud Console에서 발급 | - |
| `PASSPORT_NAVER_CLIENT_ID` / `PASSPORT_NAVER_CLIENT_SECRET` | 네이버 개발자센터에서 발급 | - |

서버는 뜨기 전에 DB 연결을 먼저 확인하고, 실패하면 바로 종료됩니다.

소셜 로그인은 **키가 채워진 제공자만 켜집니다.** 키가 없는 제공자는 로그인만 꺼지고 서버는 정상적으로 뜨므로, 아직 앱 등록을 못 한 제공자 때문에 나머지 API까지 막히지 않습니다. 기동할 때 어느 쪽이 켜지고 꺼졌는지 로그로 알려줍니다.

```
Google 로그인 사용 가능: /oauth2/login/google
Naver 로그인 꺼짐 - .env에 PASSPORT_NAVER_CLIENT_ID, PASSPORT_NAVER_CLIENT_SECRET가 없습니다.
```

꺼진 제공자의 로그인 주소로 들어가면 503(`U007`)과 함께 어떤 키가 없는지 알려줍니다.

## 폴더 구조

요청은 `controller → service → repository` 순서로 흐르고, 요청/응답 형태 변환은 DTO가 담당합니다.

```
prisma/schema.prisma        # DB 스키마 (prisma db pull로 가져온 모델 정의)
prisma7.config.ts           # Prisma CLI 설정 (schema 위치, DATABASE_URL)
src/
├── index.js                # 앱 설정, 라우트 등록, 에러 핸들러
├── db.config.js            # Prisma Client 생성 (mariadb 드라이버 어댑터)
├── auth.config.js          # Passport 전략(Google, Naver)과 소셜 로그인 공통 처리
├── auth.middleware.js      # 로그인 필요 라우트를 막는 requireAuth, 세션의 사용자 id
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

"누가 요청했는지"는 **세션에서만** 정해집니다. 요청 body나 query의 `user_id`는 더 이상 받지 않습니다. 남의 id를 적어 보내면 그 사람인 척할 수 있기 때문입니다. 아래 표에서 🔒 표시가 있는 API는 로그인하지 않고 부르면 401(`U004`)로 응답합니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/v1/users/sign-up` | 회원가입 (선호 음식 카테고리 함께 저장) |
| GET | `/api/v1/users/me` 🔒 | 내 정보 조회 |
| PATCH | `/api/v1/users/me` 🔒 | 내 정보 수정 |
| POST | `/api/v1/regions/:regionId/stores` | 특정 지역에 가게 추가 |
| POST | `/api/v1/reviews/:storeId` 🔒 | 가게에 리뷰 추가 |
| GET | `/api/v1/stores/:storeId/reviews` | 가게의 리뷰 목록 |
| POST | `/api/v1/stores/:storeId/missions` | 가게에 미션 추가 |
| GET | `/api/v1/stores/:storeId/missions` | 가게의 도전 가능한 미션 목록 |
| POST | `/api/v1/missions/:missionId/challenge` 🔒 | 미션 도전하기 |
| GET | `/api/v1/users/me/reviews` 🔒 | 내가 작성한 리뷰 목록 |
| GET | `/api/v1/users/me/missions` 🔒 | 내가 진행 중인 미션 목록 |
| PATCH | `/api/v1/users/me/missions/:userMissionId/complete` 🔒 | 진행 중인 미션을 진행 완료로 바꾸기 |
| GET | `/health/db` | DB 헬스 체크 |

소셜 로그인은 `/api/v1` 밖에 있습니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/oauth2/login/google` | 구글 로그인 시작 |
| GET | `/oauth2/callback/google` | 구글 로그인 콜백 (구글이 호출) |
| GET | `/oauth2/login/naver` | 네이버 로그인 시작 |
| GET | `/oauth2/callback/naver` | 네이버 로그인 콜백 (네이버가 호출) |
| POST | `/oauth2/logout` | 로그아웃 (세션 삭제) |

생성 API(회원가입, 가게·리뷰·미션 추가, 미션 도전)는 `201 Created`로, 조회와 수정은 `200 OK`로 응답합니다.

### 목록 조회 (커서 기반 페이지네이션)

목록 API는 모두 id 오름차순으로 5개씩 내려줍니다. 응답의 `pagination.cursor`를 다음 요청의 `?cursor=`에 넣으면 이어서 조회합니다. 더 조회할 데이터가 없으면 `cursor`는 `null`, `hasNext`는 `false`입니다.

```http
GET /api/v1/users/me/reviews?cursor=5
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

body는 없습니다. 누가 도전하는지는 세션에서 정해집니다.

**이미 도전 중인 미션인지 검증**합니다(`IN_PROGRESS` 또는 `REQUESTED` 상태). 선착순 인원은 "아직 자리가 남아 있을 때만" 이라는 조건을 `UPDATE`의 `WHERE`에 함께 넣어 한 번에 차지하므로, 동시에 요청이 몰려도 정원을 넘지 않습니다. 그래도 통과한 동시 요청은 `user_missions`의 유니크 제약(`uk_um_active`)에서 걸리는데, 이 경우도 500이 아니라 `M004`로 응답합니다. 가게·보상·기한은 요청 body가 아니라 DB에 저장된 미션 정보를 사용합니다. 클라이언트가 보낸 보상 포인트를 그대로 믿으면 값을 조작해 요청할 수 있기 때문입니다. 도전 기한은 `지금 + challenge_days`이며 미션 마감일을 넘지 않습니다.

### 미션 완료

```http
PATCH /api/v1/users/me/missions/7/complete
```

```json
{
  "paid_amount": 16000
}
```

미션을 `SUCCESS`로 바꾸고 보상 포인트를 지급합니다. 상태 변경, 포인트 잔액 증가, 포인트 내역 저장, 지역 미션 성공 횟수 증가를 하나의 트랜잭션으로 처리합니다.

- `POINT` 미션은 `reward_point`만큼, `RATE` 미션은 `paid_amount × reward_rate%`만큼 지급합니다. `paid_amount`는 `RATE` 미션에서만 필요합니다.
- 다른 사용자의 미션이면 404(`M005`), 진행 중이 아니면 409(`M006`), 도전 기한이 지났으면 400(`M007`)으로 응답합니다.
- 완료 요청이 동시에 들어와도 포인트가 한 번만 지급되도록, "아직 진행 중이고 기한이 남아 있을 때만" 이라는 조건을 상태 변경 `UPDATE`의 `WHERE`에 함께 넣습니다. 먼저 도착한 요청만 성공하고 나머지는 `M006`이 됩니다.

### 소셜 로그인

Passport로 구글과 네이버 로그인을 붙였습니다. 네이버 전략은 [`passport-naver-v2`](https://www.npmjs.com/package/passport-naver-v2)를 썼습니다. 네이버가 제공하는 최신 회원 프로필 API(`openapi.naver.com/v1/nid/me`)에 맞춰져 있고 타입 정의까지 포함되어 있어서, 오래 방치된 `passport-naver` 대신 선택했습니다.

두 제공자가 하는 일이 같으므로, `auth.config.js`의 `socialProviders` 목록을 `index.js`가 돌면서 전략과 라우트를 한 번에 등록합니다. 제공자를 더 붙일 때는 전략을 만들고 이 목록에 한 줄만 더하면 됩니다.

로그인 흐름은 두 제공자가 같습니다.

1. `/oauth2/login/<제공자>` → 제공자의 로그인 화면으로 리다이렉트
2. 로그인 완료 → 제공자가 `/oauth2/callback/<제공자>?code=...` 로 돌려보냄
3. 받은 `code`로 프로필을 조회해 DB에서 사용자를 찾거나 만듦
4. `connect.sid` 쿠키로 세션 ID를 내려주고 `/` 로 리다이렉트

세션은 메모리가 아니라 `session` 테이블에 저장합니다(`@quixo3/prisma-session-store`). 서버를 재시작해도 로그인이 유지되고, 여러 대로 늘려도 세션을 공유할 수 있습니다. 이후 요청은 쿠키에 담긴 세션 ID로 사용자를 복원해 `req.user`에 채워줍니다.

**사용자를 알아보는 기준은 이메일입니다.** 같은 이메일로 구글과 네이버를 모두 쓰면 한 계정으로 합쳐지고, 어느 제공자로 로그인했는지는 `user_social_accounts` 테이블에 각각 남습니다.

제공자마다 주는 정보가 달라서, 처음 로그인할 때 채워지는 항목도 다릅니다.

| 항목 | Google | Naver |
| --- | --- | --- |
| 이메일 | ✅ | ✅ (동의한 경우) |
| 이름 | ✅ | ✅ (없으면 별명) |
| 성별 | - | ✅ (`M`/`F` → `MALE`/`FEMALE`) |
| 생년월일 | - | ✅ (`birthYear` + `birthday` 조합) |
| 전화번호 | - | ✅ |

네이버에서 사용자가 이메일 제공에 동의하지 않으면 이메일이 비어서 오는데, 이 경우 400(`U006`)으로 응답합니다. 나머지 빈 항목은 `PATCH /api/v1/users/me`로 채웁니다.

로그아웃은 `POST /oauth2/logout`입니다. 세션 쿠키만 지우면 `session` 테이블에 기록이 남으므로, `req.logout()`과 `req.session.destroy()`를 함께 호출해 DB 기록까지 지웁니다.

#### 제공자 앱 등록

두 콘솔 모두 **콜백 URL을 미리 등록**해야 하고, 코드의 값과 한 글자라도 다르면 로그인이 실패합니다. 소셜 로그인에서 가장 자주 막히는 지점입니다. 코드 쪽 값은 `.env`의 `BASE_URL` 뒤에 경로를 붙여 만듭니다.

| 제공자 | 발급처 | 등록할 콜백 URL |
| --- | --- | --- |
| Google | Google Cloud Console → API 및 서비스 → 사용자 인증 정보 | `http://localhost:3000/oauth2/callback/google` |
| Naver | [네이버 개발자센터](https://developers.naver.com) → 애플리케이션 등록 (환경: PC 웹) | `http://localhost:3000/oauth2/callback/naver` |

네이버는 애플리케이션 등록 시 제공받을 항목을 고르는데, **이메일 주소는 반드시 포함**해야 합니다. 이 프로젝트는 이메일로 사용자를 식별하기 때문입니다.

### 내 정보 수정

```http
PATCH /api/v1/users/me
```

```json
{
  "nickname": "엘빈",
  "gender": "남",
  "birth": "1999-02-03",
  "address": "서울시 마포구",
  "detailAddress": "101동 1001호",
  "phoneNumber": "010-1234-5678",
  "preferences": [1, 3]
}
```

소셜 로그인으로 가입하면 이메일과 이름 정도만 채워지므로, 나머지를 채우는 용도입니다. 회원가입 API를 고치는 대신 새 API를 만들었습니다. 회원가입(`POST`)은 "없던 계정을 만든다", 이 API(`PATCH`)는 "내 계정의 일부를 바꾼다"로 뜻이 분명히 갈리기 때문입니다.

- **보낸 항목만 바뀝니다.** 키를 아예 넣지 않으면 그 컬럼은 건드리지 않고, `null`이나 `""`를 넣으면 그 컬럼을 비웁니다.
- `preferences`는 부분 수정이 아니라 보낸 목록으로 **통째로 교체**합니다. 빈 배열을 보내면 전부 지웁니다.
- 이메일은 계정을 알아보는 기준이라 바꿀 수 없습니다.
- 닉네임이 이미 쓰이고 있으면 409(`U005`), 없는 지역이면 404(`S003`), 없는 카테고리면 404(`S005`)로 응답합니다.

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
| U004 | `AuthRequiredError` | 401 | 로그인이 필요한 API를 세션 없이 호출 |
| U005 | `DuplicateUserNicknameError` | 409 | 이미 사용 중인 닉네임 |
| U006 | `SocialEmailRequiredError` | 400 | 소셜 계정에서 이메일을 받지 못함 |
| U007 | `SocialProviderNotConfiguredError` | 503 | `.env`에 키가 없어 꺼져 있는 소셜 로그인 호출 |
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

U003은 로그인 기능이 없던 시절 "등록된 사용자가 한 명도 없음"(`NoRegisteredUserError`)에 쓰던 번호입니다. 그 오류는 사라졌지만, 같은 번호가 다른 뜻으로 쓰여 옛 로그와 헷갈리는 일이 없도록 비워두고 U004부터 이어 붙였습니다.

새 오류를 추가할 때는 반드시 `ServiceError`를 상속해야 합니다. 그렇지 않으면 `errorCode`가 `unknown`으로 나갑니다.

DB 유니크 제약 위반(`P2002`)처럼 사전 검사를 통과한 동시 요청이 DB에서 걸리는 경우도 500으로 흘려보내지 않고, `src/utils/prisma-error.js`로 어떤 제약인지 확인해 알맞은 커스텀 에러로 바꿔 던집니다.

응답 규격을 터미널에서 직접 확인하는 명령은 [`docs/api-check.md`](docs/api-check.md)에 정리해두었습니다.

## DB

테이블은 MySQL에 직접 만들어 사용하고 있습니다. 미션 설명을 저장하려면 `missions` 테이블에 컬럼이 하나 필요합니다.

```sql
ALTER TABLE missions ADD COLUMN description VARCHAR(500) NULL AFTER title;
```

### session 테이블

로그인 세션을 담을 테이블입니다. 다른 테이블과 달리 `schema.prisma`에 모델을 먼저 쓰고 `db push`로
만들었습니다. 애플리케이션이 쓰는 테이블이지 도메인 데이터가 아니라서, SQL 스크립트가 아니라
스키마 파일을 출처로 두는 편이 관리하기 낫다고 봤습니다.

```prisma
model Session {
  id        String   @id
  sid       String   @unique
  data      String   @db.Text
  expiresAt DateTime @map("expires_at")

  @@map("session")
}
```

`data`에는 세션 내용이 JSON 문자열로 들어갑니다. 처음에는 `VARCHAR(512)`로 뒀는데, 세션에 담는 값이
늘어나면 길이를 넘겨 저장이 실패할 수 있어 `TEXT`(최대 65,535바이트)로 바꿨습니다.

만료된 세션은 `@quixo3/prisma-session-store`가 2분마다 정리합니다(`checkPeriod`).

## 학습 기록

| 날짜 | 주제 | 폴더 | 메모 |
| --- | --- | --- | --- |
| 2026-09-11 | 초기 세팅 | - | 프로젝트 생성 |
| 2026-09-13 | DB 연동 | `src/` | MySQL 커넥션 풀, 테이블 설계 |
| 2026-09-15 | 회원가입 API | `src/` | controller-service-repository 계층 분리, DTO |
| 2026-09-16 | 가게·리뷰·미션 API | `src/` | 트랜잭션, 에러 상태 코드 처리 |
| 2026-09-17 | 목록 조회 API | `src/` | Prisma ORM 전환 마무리, 커서 기반 페이지네이션, 미션 완료 |
| 2026-09-19 | 응답 규격·오류 처리 | `src/`, `docs/` | 공통 응답 규격 통일, 도메인별 커스텀 에러, 원시 SQL 제거 |
| 2026-09-21 | 소셜 로그인 | `src/`, `prisma/`, `docs/` | Passport로 구글·네이버 로그인, `session` 테이블에 세션 저장, `user_id` 하드코딩을 세션 기반 인증으로 교체, 내 정보 조회·수정 API |
