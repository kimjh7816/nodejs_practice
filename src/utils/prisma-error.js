// Prisma가 던지는 오류 중, 우리가 커스텀 오류로 바꿔서 응답해야 하는 것들을 알아보기 위한 헬퍼.
//
// 존재 여부를 미리 조회해서 검사해도, 그 조회와 INSERT 사이에 같은 요청이 한 번 더 들어오면
// DB의 유니크 제약에서 걸린다. 이때 Prisma는 P2002를 던지는데, 그대로 두면 500으로 나가므로
// 어떤 제약에 걸렸는지 확인해서 알맞은 커스텀 오류로 바꿔 던진다.

// 유니크 제약 위반이면 위반된 제약(인덱스) 이름을, 아니면 null을 돌려준다.
export const violatedUniqueConstraint = (err) => {
  if (err?.code !== "P2002") {
    return null;
  }

  // driver adapter를 쓰면 실제 제약 이름이 여기에 담겨 온다.
  const index = err.meta?.driverAdapterError?.cause?.constraint?.index;
  if (index) {
    return index;
  }

  // adapter 없이 쓰는 경우엔 meta.target에 컬럼 목록이나 제약 이름이 담긴다.
  const target = err.meta?.target;
  return Array.isArray(target) ? target.join(",") : (target ?? null);
};
