import { AuthRequiredError } from "./errors.js";

// 로그인한 사용자만 접근할 수 있는 라우트에 건다.
// passport.session()이 세션에서 복원한 req.user가 없으면 여기서 막는다.
export const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return next(new AuthRequiredError());
  }
  next();
};

// 세션에 저장된 사용자 id를 꺼낸다.
//
// users.id는 DB에서 BigInt로 오지만, 세션에 담길 때 JSON으로 직렬화되면서
// (utils/bigint.js의 toJSON 패치) 숫자로 바뀌어 저장된다.
// 그래서 세션에서 되살아난 값은 BigInt가 아니라 number이며, 여기서 형을 한 번 못박아둔다.
export const currentUserId = (req) => Number(req.user.id);
