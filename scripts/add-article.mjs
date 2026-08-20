// RELAY — 새 아티클 추가 스크립트
// 사용법:  node scripts/add-article.mjs scripts/_new-article.example.json
//
// 하는 일:
//  1) 넘겨준 JSON(새 글 1개)을 읽어 유효성 검사
//  2) data/posts/<id>.json  으로 본문 파일을 저장
//  3) data/index.json 의 posts 배열 맨 앞에 "메타데이터만" 추가(최신 글이 위로)
//
// 구조: 목록(index.json)은 가볍게, 본문(posts/<id>.json)은 열람 시에만 로드.
// 매일 자동화 시에도 이 스크립트 하나만 호출하면 된다.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { topicsOf } from './topics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const INDEX_PATH = resolve(ROOT, 'data/index.json');
const POSTS_DIR = resolve(ROOT, 'data/posts');

const META = ['id', 'category', 'title', 'source', 'date', 'read', 'summary'];
const REQUIRED = ['id', 'category', 'title', 'source', 'date', 'summary', 'body'];

// kicker 분류 고정 어휘 — 축은 "사건 유형" 하나. 매체 종류·지역은 분류로 쓰지 않는다.
// 어긋나도 발행은 막지 않고 경고만 한다(무인 실행이 분류 하나로 통째로 실패하면 손해가 크다).
const KICKER_VOCAB = [
  '오픈 웨이트', '상용 모델', '도구 · 노드', '연구', '서비스 · 플랫폼',
  '투자 · M&A', '정책 · 저작권', '제작 사례', '하드웨어', '산업 동향', '커뮤니티',
];

// 그룹은 kicker 분류에서 기계적으로 결정된다. 시점(신규/기존)으로 나누지 않는다.
const GROUP_ORDER = ['로컬 모델 · 도구', '연구', '업계 · 시장'];
const CAT_TO_GROUP = {
  '오픈 웨이트': '로컬 모델 · 도구', '도구 · 노드': '로컬 모델 · 도구', '커뮤니티': '로컬 모델 · 도구',
  '연구': '연구',
  '상용 모델': '업계 · 시장', '서비스 · 플랫폼': '업계 · 시장', '투자 · M&A': '업계 · 시장',
  '정책 · 저작권': '업계 · 시장', '제작 사례': '업계 · 시장', '하드웨어': '업계 · 시장',
  '산업 동향': '업계 · 시장',
};

const catOf = kicker => {
  const m = String(kicker).match(/^(.*) · (\d+월.*)$/);
  return m ? m[1] : null;
};

function warnStructure(body) {
  const bad = [];

  // 1) kicker 어휘·형식
  for (const b of body) {
    if (!b || !b.kicker) continue;
    const cat = catOf(b.kicker);
    if (!cat) { bad.push(`kicker 형식: "${b.kicker}" — "<분류> · M월 D일" 이어야 함`); continue; }
    if (!KICKER_VOCAB.includes(cat)) bad.push(`kicker 어휘: "${b.kicker}" — "${cat}" 는 고정 어휘 밖`);
  }

  // 2) 항목은 전부 h3, 본문에 h2 직접 사용 금지
  for (const b of body) {
    if (b && b.type === 'h2') bad.push(`h2 블록 사용: "${b.text || ''}" — 항목은 전부 h3 (그룹만 상위 절)`);
  }

  // 3) 그룹 구조 — 첫 블록이 group, 순서 준수, 항목이 올바른 그룹에 소속
  const firstHeading = body.find(b => b && (b.type === 'group' || b.kicker));
  if (firstHeading && firstHeading.type !== 'group') bad.push('그룹 밖 항목: 본문 첫 블록이 group 라벨이 아님');

  let seen = -1, curGroup = null;
  for (const b of body) {
    if (!b) continue;
    if (b.type === 'group') {
      const i = GROUP_ORDER.indexOf(b.text);
      if (i < 0) { bad.push(`그룹 라벨: "${b.text}" — 허용: ${GROUP_ORDER.join(' / ')}`); curGroup = null; continue; }
      if (i <= seen) bad.push(`그룹 순서: "${b.text}" 가 앞 그룹보다 먼저이거나 중복`);
      seen = i; curGroup = b.text;
      continue;
    }
    if (!b.kicker) continue;
    const want = CAT_TO_GROUP[catOf(b.kicker)];
    if (want && curGroup && want !== curGroup)
      bad.push(`그룹 편성: "${b.kicker}" 는 "${want}" 소속인데 "${curGroup}" 아래 있음`);
  }

  if (!bad.length) return;
  console.warn('\n⚠ 구조 확인 필요:');
  for (const s of bad) console.warn('   - ' + s);
  console.warn('');
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('사용법: node scripts/add-article.mjs <새글.json>');
    process.exit(1);
  }

  const post = JSON.parse(await readFile(resolve(process.cwd(), inputPath), 'utf8'));

  for (const k of REQUIRED) {
    if (post[k] === undefined || post[k] === null || post[k] === '') {
      console.error(`필수 필드 누락: "${k}"`);
      process.exit(1);
    }
  }
  if (!Array.isArray(post.body)) {
    console.error('"body" 는 블록 배열이어야 합니다.');
    process.exit(1);
  }
  if (!/^[a-z0-9._-]+$/i.test(post.id)) {
    console.error(`id 는 영문/숫자/-/_ 만 사용하세요 (파일명이 됨): "${post.id}"`);
    process.exit(1);
  }

  warnStructure(post.body);

  const index = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
  index.posts = index.posts || [];
  index.site = index.site || { name: 'RELAY', tagline: 'Automated Reading Archive', categories: [] };
  index.site.categories = index.site.categories || [];

  if (index.posts.some(p => p.id === post.id)) {
    console.error(`이미 존재하는 id 입니다: "${post.id}"  — id를 바꾸세요.`);
    process.exit(1);
  }

  if (!index.site.categories.includes(post.category)) {
    index.site.categories.push(post.category);
  }

  await mkdir(POSTS_DIR, { recursive: true });
  await writeFile(resolve(POSTS_DIR, post.id + '.json'), JSON.stringify(post, null, 2) + '\n', 'utf8');

  const meta = {};
  for (const k of META) meta[k] = post[k];
  // 목록은 제목만으로 하루를 구별할 수 없다(매일 같은 제목). 본문 항목을 같이 올린다.
  meta.topics = topicsOf(post.body);
  index.posts.unshift(meta);

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');

  console.log(`추가 완료: [${post.category}] ${post.title}`);
  console.log(`  본문 → data/posts/${post.id}.json`);
  console.log(`  목록 → data/index.json (총 ${index.posts.length}개)`);
}

main().catch(e => { console.error(e); process.exit(1); });
