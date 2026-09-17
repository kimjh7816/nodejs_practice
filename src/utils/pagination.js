// 커서 기반 페이지네이션 공통 설정
// 목록 조회는 id가 cursor보다 큰 row를 id 오름차순으로 PAGE_SIZE개씩 내려준다.
export const PAGE_SIZE = 5;

// 한 개를 더 조회해서, 그 한 개가 있으면 다음 페이지가 있다고 판단한다.
export const PAGE_FETCH_SIZE = PAGE_SIZE + 1;

// PAGE_FETCH_SIZE만큼 조회한 rows를 응답 형태({ data, pagination })로 바꾼다.
// 다음 페이지가 있을 때만 마지막 row의 id를 다음 요청의 cursor로 내려준다.
// (마지막 페이지에서도 cursor를 내려주면 클라이언트가 빈 목록을 받으려고 한 번 더 요청하게 된다)
export const toCursorPage = (rows, toItem) => {
  const hasNext = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  return {
    data: pageRows.map(toItem),
    pagination: {
      cursor: hasNext ? pageRows[pageRows.length - 1].id : null,
      hasNext,
    },
  };
};
