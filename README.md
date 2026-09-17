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
├── errors.js               # 상태 코드를 가진 에러 클래스(HttpError 등)
├── controllers/            # 요청을 받아 DTO로 변환하고 서비스를 호출
├── services/               # 검증과 비즈니스 규칙, 트랜잭션(prisma.$transaction)
├── repositories/           # Prisma Client 쿼리 실행
├── dtos/                   # 요청 body → 내부 객체, DB row → 응답 형태
├── generated/prisma/       # prisma generate로 만들어진 Prisma Client (git 제외)
├── utils/validation.js     # id·문자열 등 공통 입력 검증
├── utils/bigint.js         # BigInt(id)를 JSON으로 내보내기 위한 설정
└── scripts/check-db.js     # DB 연결 확인 스크립트
```

## API

모든 경로는 `/api/v1` 하위이고, 요청과 응답 모두 JSON입니다. 성공하면 `{ "result": ... }` 형태로 응답합니다.

아직 로그인 기능이 없어서, 사용자가 필요한 API는 body의 `user_id`를 쓰고 값이 없으면 DB의 첫 번째 사용자로 처리합니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/v1/users/sign-up` | 회원가입 (선호 음식 카테고리 함께 저장) |
| POST | `/api/v1/regions/:regionId/stores` | 특정 지역에 가게 추가 |
| POST | `/api/v1/reviews/:storeId` | 가게에 리뷰 추가 |
| POST | `/api/v1/stores/:storeId/missions` | 가게에 미션 추가 |
| POST | `/api/v1/missions/:missionId/challenge` | 미션 도전하기 |
| GET | `/health/db` | DB 헬스 체크 |

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

**이미 도전 중인 미션인지 검증**합니다(`IN_PROGRESS` 또는 `REQUESTED` 상태). 가게·보상·기한은 요청 body가 아니라 DB에 저장된 미션 정보를 사용합니다. 클라이언트가 보낸 보상 포인트를 그대로 믿으면 값을 조작해 요청할 수 있기 때문입니다. 도전 기한은 `지금 + challenge_days`이며 미션 마감일을 넘지 않습니다.

### 에러 응답

에러는 `{ "message": "..." }` 형태이고, 상황에 맞는 상태 코드를 사용합니다.

| 상태 코드 | 예시 |
| --- | --- |
| 400 | 형식이 잘못된 입력 (별점이 1~5가 아님, 지난 마감일 등) |
| 404 | 존재하지 않는 지역·가게·미션·사용자 |
| 409 | 이미 도전 중인 미션, 선착순 마감된 미션 |

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
