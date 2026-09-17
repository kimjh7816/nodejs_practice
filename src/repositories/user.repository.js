import { prisma } from "../db.config.js";

// 목록/단건 조회에서 공통으로 내려주는 컬럼들
const USER_SUMMARY_SELECT = {
  id: true,
  email: true,
  name: true,
  nickname: true,
  gender: true,
  region_id: true,
  point_balance: true,
  status: true,
  created_at: true,
};

// User 데이터 삽입 (이미 가입된 이메일이면 null)
export const addUser = async (data) => {
  const existing = await prisma.users.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    return null;
  }

  const user = await prisma.users.create({
    data: {
      email: data.email,
      name: data.name,
      gender: data.gender,
      birth_date: data.birth,
      address1: data.address,
      address2: data.detailAddress,
      phone: data.phoneNumber,
    },
    select: { id: true },
  });

  return user.id;
};

// 사용자 정보 얻기
export const getUser = async (userId) =>
  prisma.users.findUnique({ where: { id: userId } });

// 음식 선호 카테고리 매핑
export const setPreference = async (userId, foodCategoryId) => {
  await prisma.user_food_preferences.create({
    data: { user_id: userId, category_id: foodCategoryId },
  });
};

// 사용자 목록 조회 (페이징)
export const findAllUsers = async ({ limit, offset }) =>
  prisma.users.findMany({
    select: USER_SUMMARY_SELECT,
    orderBy: { id: "asc" },
    take: limit,
    skip: offset,
  });

// 사용자 단건 조회
export const findUserById = async (id) =>
  prisma.users.findUnique({ where: { id }, select: USER_SUMMARY_SELECT });

// 인증 기능이 생기기 전까지 "현재 로그인한 사용자"로 쓸 첫 번째 사용자 id
export const findFirstUserId = async () => {
  const user = await prisma.users.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });

  return user?.id ?? null;
};

// 사용자 생성
export const createUser = async ({ email, name, nickname, gender, regionId }) => {
  const user = await prisma.users.create({
    data: {
      email,
      name,
      nickname,
      gender: gender ?? "NONE",
      region_id: regionId ?? null,
    },
    select: { id: true },
  });

  return user.id;
};

// 사용자 선호 카테고리 반환
// JOIN은 관계 필드(food_categories)를 include/select 하면 Prisma가 알아서 만들어준다.
export const getUserPreferencesByUserId = async (userId) => {
  const preferences = await prisma.user_food_preferences.findMany({
    where: { user_id: userId },
    select: {
      user_id: true,
      category_id: true,
      food_categories: { select: { name: true } },
    },
    orderBy: { category_id: "asc" },
  });

  // 기존 SQL과 같은 평평한 모양(food_category_id, user_id, name)으로 맞춰서 돌려준다.
  return preferences.map((preference) => ({
    food_category_id: preference.category_id,
    user_id: preference.user_id,
    name: preference.food_categories.name,
  }));
};
