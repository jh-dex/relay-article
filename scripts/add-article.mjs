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

function warnKickers(body) {
  const bad = [];
  for (const b of body) {
    if (!b || !b.kicker) continue;
    const m = String(b.kicker).match(/^(.*) · (\d+월.*)$/);
    if (!m) { bad.push(`${b.kicker}  (형식은 "<분류> · M월 D일")`); continue; }
    if (!KICKER_VOCAB.includes(m[1])) bad.push(`${b.kicker}  ("${m[1]}" 는 고정 어휘 밖)`);
  }
  if (!bad.length) return;
  console.warn('\n⚠ kicker 분류 확인 필요:');
  for (const s of bad) console.warn('   - ' + s);
  console.warn('   허용: ' + KICKER_VOCAB.join(' / ') + '\n');
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

  warnKickers(post.body);

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
  index.posts.unshift(meta);

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');

  console.log(`추가 완료: [${post.category}] ${post.title}`);
  console.log(`  본문 → data/posts/${post.id}.json`);
  console.log(`  목록 → data/index.json (총 ${index.posts.length}개)`);
}

main().catch(e => { console.error(e); process.exit(1); });
