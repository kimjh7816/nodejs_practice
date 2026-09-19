import { responseFromUser } from "../dtos/dto.js";
import {
  DuplicateUserEmailError,
  FoodCategoryNotFoundError,
  NoRegisteredUserError,
  UserNotFoundError,
} from "../errors.js";
import { findFoodCategoryById } from "../repositories/store.repository.js";
import { violatedUniqueConstraint } from "../utils/prisma-error.js";
import {
  addUser,
  findFirstUserId,
  findUserById,
  getUser,
  getUserPreferencesByUserId,
  setPreference,
} from "../repositories/user.repository.js";

// 아직 로그인 기능이 없으므로 요청한 user_id를 쓰고, 없으면 DB의 첫 번째 사용자로 가정한다.
export const resolveCurrentUserId = async (userId) => {
  if (userId === undefined || userId === null) {
    const firstUserId = await findFirstUserId();
    if (firstUserId === null) {
      throw new NoRegisteredUserError();
    }
    return firstUserId;
  }

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