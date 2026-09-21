import { responseFromUser } from "../dtos/dto.js";
import {
  DuplicateUserEmailError,
  DuplicateUserNicknameError,
  FoodCategoryNotFoundError,
  RegionNotFoundError,
  UserNotFoundError,
} from "../errors.js";
import {
  findFoodCategoryById,
  findRegionById,
} from "../repositories/store.repository.js";
import { violatedUniqueConstraint } from "../utils/prisma-error.js";
import {
  addUser,
  findUserById,
  getUser,
  getUserPreferencesByUserId,
  replacePreferences,
  setPreference,
  updateUser,
} from "../repositories/user.repository.js";

// 로그인한 사용자의 id는 세션에서 오지만, 그 사용자가 지금도 DB에 있는지는 보장되지 않는다.
// 세션이 7일 동안 유지되는 사이에 탈퇴/삭제된 계정의 세션이 남아 있을 수 있어 여기서 한 번 확인한다.
export const resolveCurrentUserId = async (userId) => {
  if (!(await findUserById(userId))) {
    throw new UserNotFoundError({ userId });
  }
  return userId;
};

export const userSignUp = async (data) => {
  // 없는 카테고리를 보내면 선호 카테고리 저장 단계에서 FK 제약에 걸리는데,
  // 그때는 이미 사용자 row가 만들어져 있어 되돌릴 수 없다. 그래서 가입 전에 먼저 확인한다.
  for (const preference of data.preferences) {
    if (!(await findFoodCategoryById(preference))) {
      throw new FoodCategoryNotFoundError({ categoryId: preference });
    }
  }

  let joinUserId;
  try {
    joinUserId = await addUser({
      email: data.email,
      name: data.name,
      gender: data.gender,
      birth: data.birth,
      address: data.address,
      detailAddress: data.detailAddress,
      phoneNumber: data.phoneNumber,
    });
  } catch (err) {
    // 같은 이메일로 거의 동시에 가입 요청이 들어오면 addUser의 사전 조회를 둘 다 통과한 뒤
    // DB의 uk_users_email 제약에서 걸린다. 이 경우도 같은 중복 오류로 응답한다.
    if (violatedUniqueConstraint(err) === "uk_users_email") {
      throw new DuplicateUserEmailError(data);
    }
    throw err;
  }

  if (joinUserId === null) {
    throw new DuplicateUserEmailError(data);
  }

  for (const preference of data.preferences) {
    await setPreference(joinUserId, preference);
  }

  const user = await getUser(joinUserId);
  const preferences = await getUserPreferencesByUserId(joinUserId);

  return responseFromUser({ user, preferences });
};
// 내 정보 조회
export const getMyProfile = async (userId) => {
  const user = await getUser(userId);
  if (!user) {
    throw new UserNotFoundError({ userId });
  }

  const preferences = await getUserPreferencesByUserId(userId);
  return responseFromUser({ user, preferences });
};

// 내 정보 수정
//
// 소셜 로그인으로 가입한 사용자는 이메일과 이름만 채워진 상태라 나머지를 여기서 채운다.
// 보내지 않은 항목은 그대로 두고, 보낸 항목만 바꾼다. (이메일은 계정 식별 기준이라 바꿀 수 없다)
export const updateMyProfile = async (userId, data) => {
  if (!(await findUserById(userId))) {
    throw new UserNotFoundError({ userId });
  }

  // FK 제약에 걸려 500이 나기 전에 먼저 확인한다.
  if (data.regionId) {
    if (!(await findRegionById(data.regionId))) {
      throw new RegionNotFoundError({ regionId: data.regionId });
    }
  }
  if (data.preferences) {
    for (const preference of data.preferences) {
      if (!(await findFoodCategoryById(preference))) {
        throw new FoodCategoryNotFoundError({ categoryId: preference });
      }
    }
  }

  // DTO의 이름(birth, address, ...)을 컬럼 이름으로 바꾼다.
  // 값이 오지 않은 항목은 아예 넣지 않아야 기존 값이 유지된다.
  const columns = {};
  const rename = {
    name: "name",
    nickname: "nickname",
    gender: "gender",
    birth: "birth_date",
    address: "address1",
    detailAddress: "address2",
    phoneNumber: "phone",
    regionId: "region_id",
  };
  for (const [field, column] of Object.entries(rename)) {
    if (data[field] !== undefined) {
      columns[column] = data[field];
    }
  }

  if (Object.keys(columns).length > 0) {
    try {
      await updateUser(userId, columns);
    } catch (err) {
      // 닉네임은 uk_users_nickname 유니크 제약이 걸려 있다.
      if (violatedUniqueConstraint(err) === "uk_users_nickname") {
        throw new DuplicateUserNicknameError({ nickname: data.nickname });
      }
      throw err;
    }
  }

  if (data.preferences) {
    await replacePreferences(userId, data.preferences);
  }

  const user = await getUser(userId);
  const preferences = await getUserPreferencesByUserId(userId);
  return responseFromUser({ user, preferences });
};
