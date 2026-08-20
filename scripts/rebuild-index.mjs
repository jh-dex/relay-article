// RELAY — data/index.json 전체 재생성
// 사용법:  node scripts/rebuild-index.mjs
//
// data/posts/*.json 을 전부 읽어 목록 메타(+ 그날의 항목)를 다시 만든다.
// 평소에는 add-article.mjs 가 발행할 때마다 한 편씩 앞에 붙이므로 이 스크립트는 필요 없다.
// 목록 스키마가 바뀌었을 때(예: topics 추가)나 index.json 이 본문과 어긋났을 때 쓴다.
//
// 멱등하다. 몇 번을 돌려도 결과가 같다.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { topicsOf } from './topics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const INDEX_PATH = resolve(ROOT, 'data/index.json');
const POSTS_DIR = resolve(ROOT, 'data/posts');

const META = ['id', 'category', 'title', 'source', 'date', 'read', 'summary'];

async function main() {
  const files = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.json'));
  if (!files.length) {
    console.error(`글이 없습니다: ${POSTS_DIR}`);
    process.exit(1);
  }

  const posts = [];
  for (const f of files) {
    const post = JSON.parse(await readFile(resolve(POSTS_DIR, f), 'utf8'));
    const meta = {};
    for (const k of META) if (post[k] !== undefined) meta[k] = post[k];
    meta.topics = topicsOf(post.body);
    if (!meta.topics.length) console.warn(`⚠ 항목(h3)이 없습니다: ${f}`);
    posts.push(meta);
  }

  // 최신 글이 위로. 날짜가 같으면 id 로 안정 정렬한다.
  posts.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));

  const prev = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
  const index = {
    site: prev.site || { name: 'RELAY', tagline: 'Automated Reading Archive', categories: [] },
    posts,
  };
  index.site.categories = [...new Set(posts.map(p => p.category).filter(Boolean))];

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');

  const items = posts.reduce((n, p) => n + p.topics.length, 0);
  console.log(`index.json 재생성 완료 — 글 ${posts.length}편 / 항목 ${items}건`);
}

main().catch(e => { console.error(e); process.exit(1); });
