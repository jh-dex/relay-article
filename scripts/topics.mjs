// RELAY — 목록(index.json)이 쓰는 "그날의 항목" 추출기
//
// 글 제목이 매일 "AI 이미지·영상 생성 동향 · 8월 N일" 로 같기 때문에,
// 아카이브 목록에서 하루를 구별하는 정보는 제목이 아니라 그날 다룬 항목들이다.
// 본문 h3 블록(=항목)의 제목과 kicker 분류를 뽑아 목록용 메타로 올린다.
//
// add-article.mjs(새 글 발행)와 rebuild-index.mjs(전체 재생성)가 같이 쓴다.

// 본문 kicker 분류(11개)를 목록 필터용 4갈래로 묶는다.
// 기준은 "그 항목으로 독자가 무엇을 하느냐" 하나다.
//   모델 = 받아서 돌릴 가중치 / 도구 = 돌리는 방법
//   연구 = 아직 코드가 아닌 것 / 업계 = 읽고 알아둘 소식
//
// add-article.mjs 의 CAT_TO_GROUP 과는 축이 다르다. 그쪽은 "본문 안에서 절을 어떻게 묶을까"이고,
// 이쪽은 "아카이브 목록에서 어떻게 걸러 볼까"다. 둘을 하나로 합치면 목록에서 모델과 도구가 섞인다.
export const GROUPS = ['모델', '도구', '연구', '업계'];

const CAT_TO_INDEX_GROUP = {
  '오픈 웨이트': '모델',
  '상용 모델': '모델',

  '도구 · 노드': '도구',
  '커뮤니티': '도구',
  '제작 사례': '도구',
  '하드웨어': '도구',

  '연구': '연구',

  '서비스 · 플랫폼': '업계',
  '투자 · M&A': '업계',
  '정책 · 저작권': '업계',
  '산업 동향': '업계',
};

// kicker 는 "<분류> · M월 D일" 형식이다. 분류 자체에 " · " 가 들어가므로(예: "도구 · 노드")
// 뒤쪽 날짜 부분을 기준으로 잘라야 한다.
const catOf = kicker => {
  const m = String(kicker ?? '').match(/^(.*) · (\d+월.*)$/);
  return m ? m[1] : null;
};

// 고정 어휘를 벗어난 분류가 와도 발행을 막지 않는다 — 업계로 떨어뜨리고 경고는 add-article 쪽에서 한다.
export const groupOf = kicker => CAT_TO_INDEX_GROUP[catOf(kicker)] || '업계';

// 본문 → [{ g: 목록 필터용 갈래, t: 항목 제목 }]
export function topicsOf(body) {
  return (Array.isArray(body) ? body : [])
    .filter(b => b && b.type === 'h3' && b.text)
    .map(b => ({ g: groupOf(b.kicker), t: b.text }));
}
