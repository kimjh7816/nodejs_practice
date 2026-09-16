import { responseFromUser } from "../dtos/dto.js";
import { NotFoundError } from "../errors.js";
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
      throw new NotFoundError("등록된 사용자가 없습니다.");
    }
    return firstUserId;
  }

  if (!(await findUserById(userId))) {
    throw new NotFoundError("존재하지 않는 사용자입니다.");
  }
  return userId;
};

export const userSignUp = async (data) => {
  const joinUserId = await addUser({
    email: data.email,
    name: data.name,
    gender: data.gender,
    birth: data.birth,
    address: data.address,
    detailAddress: data.detailAddress,
    phoneNumber: data.phoneNumber,
  });

  if (joinUserId === null) {
    throw new Error("이미 존재하는 이메일입니다.");
  }

  for (const preference of data.preferences) {
    await setPreference(joinUserId, preference);
  }

  const user = await getUser(joinUserId);
  const preferences = await getUserPreferencesByUserId(joinUserId);

  return responseFromUser({ user, preferences });
};