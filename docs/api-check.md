# API 응답 규격 점검

터미널에 그대로 붙여넣어 확인할 수 있는 명령 모음이다.
모든 응답은 `{ resultType, error, success }` 한 가지 형태로만 나와야 한다.

## 0. 준비

서버를 띄우고, 아래 명령들이 쓸 변수를 등록한다.

```bash
npm run dev          # 다른 터미널에서
```

```bash
export B=http://localhost:3000/api/v1
export J="Content-Type: application/json"
```

응답을 읽기 좋게 보려면 `jq`를 쓰거나, 없으면 `python3 -m json.tool`을 붙인다.

```bash
curl -s "$B/stores/1/reviews" | python3 -m json.tool
```

HTTP 상태 코드까지 보고 싶으면 `-i`를 붙인다.

```bash
curl -si "$B/stores/1/reviews" | head -1
```

---

## 1. 성공 응답 규격

`resultType: "SUCCESS"`, `error: null`, 데이터는 `success` 안에 들어간다.

```bash
curl -s http://localhost:3000/ ; echo
curl -s http://localhost:3000/health/db ; echo
curl -s "$B/stores/1/reviews" ; echo
curl -s "$B/stores/1/missions" ; echo
curl -s "$B/users/me/reviews" ; echo
curl -s "$B/users/me/missions" ; echo
```

기대:

```json
{"resultType":"SUCCESS","error":null,"success":{"data":[...],"pagination":{"cursor":null,"hasNext":false}}}
```

### 회원가입 (201 Created)

```bash
curl -si -X POST "$B/users/sign-up" -H "$J" -d '{
  "email": "check-001@example.com",
  "name": "엘빈",
  "gender": "남성",
  "birth": "2000-02-03",
  "address": "주소1",
  "detailAddress": "세부주소1",
  "phoneNumber": "010-1234-1234",
  "preferences": [1]
}' | tail -2
```

기대: `HTTP/1.1 201 Created` + `resultType: "SUCCESS"`

---

## 2. 공통 오류 (C)

| 코드 | 상황 | HTTP |
|---|---|---|
| C000 | 예상하지 못한 서버 오류 | 500 |
| C001 | 요청 값 형식 오류 | 400 |
| C002 | 리소스 없음 (기본값) | 404 |
| C003 | 상태 충돌 (기본값) | 409 |
| C004 | 등록되지 않은 경로 | 404 |
| C005 | 본문이 JSON이 아님 | 400 |

```bash
# C004 - 없는 경로 (Express 기본 HTML 404가 아니라 우리 규격으로 나와야 한다)
curl -s "$B/nope" ; echo

# C005 - 깨진 JSON
curl -s -X POST "$B/users/sign-up" -H "$J" -d '{oops}' ; echo

# C001 - cursor가 숫자가 아님
curl -s "$B/stores/1/reviews?cursor=abc" ; echo

# C001 - storeId가 숫자가 아님
curl -s "$B/stores/abc/reviews" ; echo

# C001 - rating 범위 초과
curl -s -X POST "$B/reviews/1" -H "$J" -d '{"rating":9,"review_content":"좋아요"}' ; echo

# C001 - due_date가 과거
curl -s -X POST "$B/stores/1/missions" -H "$J" \
  -d '{"mission_name":"지난 미션","reward_point":100,"due_date":"2020-01-01"}' ; echo
```

---

## 3. 사용자 오류 (U)

| 코드 | 클래스 | HTTP |
|---|---|---|
| U001 | `DuplicateUserEmailError` | 409 |
| U002 | `UserNotFoundError` | 404 |
| U003 | `NoRegisteredUserError` | 404 |

```bash
# U001 - 이미 가입된 이메일 (위 회원가입을 한 번 더 실행)
curl -si -X POST "$B/users/sign-up" -H "$J" \
  -d '{"email":"check-001@example.com","name":"엘빈","preferences":[1]}' | tail -2

# U002 - 없는 사용자
curl -s "$B/users/me/reviews?user_id=999999" ; echo
curl -s "$B/users/me/missions?user_id=999999" ; echo

# C001 - email 누락
curl -s -X POST "$B/users/sign-up" -H "$J" -d '{"name":"엘빈"}' ; echo

# C001 - email 형식 오류
curl -s -X POST "$B/users/sign-up" -H "$J" -d '{"email":"abc","name":"엘빈"}' ; echo

# C001 - name이 50자 초과
curl -s -X POST "$B/users/sign-up" -H "$J" \
  -d "{\"email\":\"check-002@example.com\",\"name\":\"$(printf 'ㄱ%.0s' {1..51})\"}" ; echo
```

U001 기대:

```json
{"resultType":"FAIL","error":{"errorCode":"U001","reason":"이미 존재하는 이메일입니다.","data":{"email":"check-001@example.com", ...}},"success":null}
```

---

## 4. 가게 / 지역 오류 (S)

| 코드 | 클래스 | HTTP |
|---|---|---|
| S001 | `StoreNotFoundError` | 404 |
| S002 | `StoreNotActiveError` | 400 |
| S003 | `RegionNotFoundError` | 404 |
| S004 | `RegionNotActiveError` | 400 |
| S005 | `FoodCategoryNotFoundError` | 404 |

```bash
# S001 - 없는 가게
curl -s "$B/stores/99999/reviews" ; echo
curl -s "$B/stores/99999/missions" ; echo
curl -s -X POST "$B/reviews/99999" -H "$J" -d '{"rating":5,"review_content":"좋아요"}' ; echo

# S003 - 없는 지역
curl -s -X POST "$B/regions/99999/stores" -H "$J" \
  -d '{"store_category_id":1,"store_name":"테스트","store_address":"주소"}' ; echo

# S005 - 없는 음식 카테고리 (가게 등록)
curl -s -X POST "$B/regions/1/stores" -H "$J" \
  -d '{"store_category_id":9999,"store_name":"테스트","store_address":"주소"}' ; echo

# S005 - 없는 음식 카테고리 (회원가입 선호 카테고리)
curl -s -X POST "$B/users/sign-up" -H "$J" \
  -d '{"email":"check-003@example.com","name":"엘빈","preferences":[9999]}' ; echo
```

---

## 5. 미션 오류 (M)

| 코드 | 클래스 | HTTP |
|---|---|---|
| M001 | `MissionNotFoundError` | 404 |
| M002 | `MissionNotOpenError` | 400 |
| M003 | `MissionQuotaExceededError` | 409 |
| M004 | `DuplicateMissionChallengeError` | 409 |
| M005 | `UserMissionNotFoundError` | 404 |
| M006 | `UserMissionNotInProgressError` | 409 |
| M007 | `UserMissionExpiredError` | 400 |
| M008 | `PaidAmountRequiredError` | 400 |

```bash
# M001 - 없는 미션에 도전
curl -s -X POST "$B/missions/99999/challenge" -H "$J" -d '{}' ; echo

# M005 - 없는 도전 미션 완료
curl -s -X PATCH "$B/users/me/missions/99999/complete" -H "$J" -d '{}' ; echo
```

### 도전 → 중복 도전 → 완료 → 재완료 (M004, M006)

```bash
# 가게와 미션을 새로 만든다
SID=$(curl -s -X POST "$B/regions/1/stores" -H "$J" \
  -d '{"store_category_id":1,"store_name":"점검용 가게","store_address":"주소"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['success']['store_id'])")

MID=$(curl -s -X POST "$B/stores/$SID/missions" -H "$J" \
  -d '{"mission_name":"점검용 미션","reward_point":100,"due_date":"2027-12-31"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['success']['mission_id'])")

echo "store=$SID mission=$MID"
# opened_at은 DB가 채우는데 DB 시계가 Node 프로세스 시계보다 조금 앞설 수 있다.
# 미션을 만들자마자 도전하면 "아직 시작 전"으로 보여 M002가 날 수 있으므로 잠깐 기다린다.
sleep 2

# 도전 (성공)
UMID=$(curl -s -X POST "$B/missions/$MID/challenge" -H "$J" -d '{}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['success']['user_mission_id'])")
echo "user_mission=$UMID"

# M004 - 같은 미션에 또 도전
curl -s -X POST "$B/missions/$MID/challenge" -H "$J" -d '{}' ; echo

# 완료 (성공) - earned_point와 point_balance가 올라간다
curl -s -X PATCH "$B/users/me/missions/$UMID/complete" -H "$J" -d '{}' ; echo

# M006 - 이미 완료한 미션을 또 완료
curl -s -X PATCH "$B/users/me/missions/$UMID/complete" -H "$J" -d '{}' ; echo
```

---

## 6. 동시 요청에도 안전한지 (Prisma 전용 처리 확인)

행 잠금용 원시 SQL(`SELECT ... FOR UPDATE`)을 걷어내고, 조건을 `UPDATE`의 `WHERE`에 함께 넣는
방식으로 바꿨다. 같은 요청이 동시에 들어와도 한 번만 성공해야 한다.

```bash
# 같은 미션에 동시에 10번 도전 -> 1건만 SUCCESS, 나머지는 M004
SID=$(curl -s -X POST "$B/regions/1/stores" -H "$J" \
  -d '{"store_category_id":1,"store_name":"동시성 점검","store_address":"주소"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['success']['store_id'])")
MID=$(curl -s -X POST "$B/stores/$SID/missions" -H "$J" \
  -d '{"mission_name":"동시성 미션","reward_point":100,"due_date":"2027-12-31"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['success']['mission_id'])")
sleep 2

seq 10 | xargs -P 10 -I% curl -s -X POST "$B/missions/$MID/challenge" -H "$J" -d '{}' \
  | python3 -c "
import json,sys
codes = {}
for line in sys.stdin.read().replace('}{','}\n{').splitlines():
    d = json.loads(line)
    key = (d['error'] or {}).get('errorCode', 'SUCCESS')
    codes[key] = codes.get(key, 0) + 1
print(codes)"
```

기대: `{'SUCCESS': 1, 'M004': 9}`

`xargs`의 치환 문자를 `{}`가 아니라 `%`로 쓴 이유는, `-I{}`로 두면 본문의 `-d '{}'`까지
번호로 바꿔버려서 요청이 전부 `C005`(JSON 형식 오류)로 떨어지기 때문이다.

발급 수도 정확히 1이어야 한다. (실패한 도전은 롤백되어 `issued_count`가 다시 내려간다)

```bash
node --input-type=module -e "
import { prisma } from './src/db.config.js';
const m = await prisma.missions.findUnique({ where: { id: $MID }, select: { issued_count: true } });
const c = await prisma.user_missions.count({ where: { mission_id: $MID } });
console.log('issued_count =', m.issued_count, '| user_missions =', c);
await prisma.\$disconnect();
"
```

```bash
# 완료 요청도 동시에 5번 -> 1건만 SUCCESS, 나머지는 M006 (포인트 중복 지급 없음)
UMID=$(curl -s -X POST "$B/missions/$MID/challenge" -H "$J" -d '{"user_id":2}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['success']['user_mission_id'])")

seq 5 | xargs -P 5 -I% curl -s -X PATCH "$B/users/me/missions/$UMID/complete" -H "$J" -d '{"user_id":2}' \
  | python3 -c "
import json,sys
codes = {}
for line in sys.stdin.read().replace('}{','}\n{').splitlines():
    d = json.loads(line)
    key = (d['error'] or {}).get('errorCode', 'SUCCESS')
    codes[key] = codes.get(key, 0) + 1
print(codes)"
```

기대: `{'SUCCESS': 1, 'M006': 4}`

```bash
# 같은 이메일로 동시에 5번 가입 -> 1건만 SUCCESS, 나머지는 U001
E="race-$(date +%s)@example.com"
seq 5 | xargs -P 5 -I% curl -s -X POST "$B/users/sign-up" -H "$J" -d "{\"email\":\"$E\",\"name\":\"엘빈\"}" \
  | python3 -c "
import json,sys
codes = {}
for line in sys.stdin.read().replace('}{','}\n{').splitlines():
    d = json.loads(line)
    key = (d['error'] or {}).get('errorCode', 'SUCCESS')
    codes[key] = codes.get(key, 0) + 1
print(codes)"
```

기대: `{'SUCCESS': 1, 'U001': 4}`

이 세 가지는 DB의 유니크 제약이나 조건부 `UPDATE`에서 걸러지는데,
그 결과를 500이 아니라 각각의 커스텀 오류로 바꿔서 응답하는지 확인하는 것이 핵심이다.

---

## 7. 리뷰 평점 집계가 맞는지

`rating_avg`를 컬럼 계산 SQL 대신 `reviews` 테이블 집계로 다시 구하도록 바꿨다.
저장된 값과 실제 집계가 같아야 한다.

```bash
curl -s -X POST "$B/reviews/1" -H "$J" -d '{"rating":4,"review_content":"집계 확인"}' > /dev/null

node --input-type=module -e "
import { prisma } from './src/db.config.js';
const store = await prisma.stores.findUnique({
  where: { id: 1 }, select: { rating_avg: true, review_count: true },
});
const agg = await prisma.reviews.aggregate({
  where: { store_id: 1, deleted_at: null },
  _avg: { rating: true }, _count: { _all: true },
});
console.log('stores 저장값:', store.rating_avg.toString(), '/', store.review_count, '건');
console.log('reviews 집계:', Number(agg._avg.rating).toFixed(1), '/', agg._count._all, '건');
await prisma.\$disconnect();
"
```

---

## 8. DB 연결 확인

```bash
npm run db:check
```

기대: `연결 성공` 과 모델별 row 수 목록.
MODEL_NAMES에 적힌 모델을 Prisma로 `count()` 하므로, 원시 SQL 없이 연결과 스키마를 함께 확인한다.

---

## 9. 원시 SQL이 남아 있는지 확인

DB 접근은 전부 Prisma Client API로만 한다.

```bash
grep -rn "queryRaw\|executeRaw" src --include="*.js"
```

기대: 아무것도 출력되지 않음.
