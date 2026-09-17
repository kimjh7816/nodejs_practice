// MySQL의 BIGINT 컬럼은 Prisma에서 JS BigInt로 돌아오는데,
// JSON.stringify는 BigInt를 직렬화하지 못하고 TypeError를 던진다.
// ("Do not know how to serialize a BigInt")
//
// 이 프로젝트의 id는 모두 AUTO_INCREMENT라 Number.MAX_SAFE_INTEGER(2^53-1) 안에 들어오므로,
// 응답으로 나갈 때 숫자로 바꿔주면 기존 mysql2 시절과 같은 JSON 모양이 유지된다.
// (id가 2^53을 넘길 수 있는 서비스라면 문자열로 내려야 한다.)
BigInt.prototype.toJSON = function () {
  const asNumber = Number(this);
  return Number.isSafeInteger(asNumber) ? asNumber : this.toString();
};
