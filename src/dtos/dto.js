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

export const bodyToUser = (body) => {
  const birth = body.birth ? new Date(body.birth) : null;

  return {
    email: body.email,
    name: body.name,
    gender: normalizeGender(body.gender),
    birth,
    address: body.address || "",
    detailAddress: body.detailAddress || "",
    phoneNumber: body.phoneNumber,
    preferences: body.preferences ?? [],
  };
};

// DB 조회 결과(user, preferences)를 클라이언트에 내려줄 응답 형태로 변환
export const responseFromUser = ({ user, preferences }) => {
  // getUser는 SELECT 결과 배열을 반환하므로 첫 번째 row를 꺼낸다.
  const userInfo = user[0];

  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    gender: userInfo.gender,
    birth: userInfo.birth_date,
    address: userInfo.address1,
    detailAddress: userInfo.address2,
    phoneNumber: userInfo.phone,
    // 선호 카테고리는 JOIN으로 가져온 카테고리 이름만 배열로 내려준다.
    preferCategory: preferences.map((preference) => preference.name),
  };
};