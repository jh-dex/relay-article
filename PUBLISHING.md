# RELAY — 발행 운영 가이드 (인수인계)

> **이 문서 하나면, 다른 대화에서도 컨텍스트 끊김 없이 "이 웹에 글 올려줘" 작업을 이어갈 수 있다.**
> RELAY 폴더(바탕화면)에 대한 접근 권한만 주면, 새 대화의 Claude가 이 문서를 읽고 그대로 발행을 이어가면 된다.

---

## 1. 한 줄 요약 / 현재 상태

RELAY는 **AI가 웹에서 소식을 검색·요약해 한 편씩 쌓아 올리는 에디토리얼 리딩 사이트**다.
**수집·정리는 기계, 읽기는 사람**이라는 컨셉.

현재 상태: **로컬 폴더 + GitHub + Vercel 자동배포 + 발행 파이프라인까지 전부 가동 중.**
요청 한 줄("○○ 주제로 글 올려줘")이면 작성부터 라이브까지 한 큐로 처리된다.

---

## 2. 인프라 지도

| 구성 | 위치 / 내용 |
|---|---|
| **로컬 폴더** | 바탕화면 `RELAY/` — 작업 사본 (편집·검증용) |
| **GitHub** | `github.com/jh-dex/relay-article` — `main` 브랜치가 **라이브 소스** |
| **배포** | **Vercel** — `main`에 push되면 **자동 재배포** (빌드 없는 순수 정적, 설정 0) |
| **GitHub 연결** | Claude 데스크톱 앱 설정(`claude_desktop_config.json`)에 **GitHub MCP 커넥터**가 붙어 있음. 개인 액세스 토큰(**Contents: Read and write** 권한)으로 인증. 이게 있어야 Claude가 레포에 직접 push 가능. |

> ⚠️ 새 대화에서 GitHub 도구(`mcp__GitHub__*`)가 안 보이면, 앱을 완전 종료(Quit) 후 재시작하거나 새 대화를 열면 로드된다.

---

## 3. 글 하나 올리는 법 (가장 중요)

**사용자가 할 일:** 그냥 이렇게 말한다 →
> "**○○ 주제로 글 하나 올려줘**" (필요하면 카테고리·길이·톤도 같이)

**Claude가 자동으로 하는 일 (한 큐):**

```
1. 웹검색(WebSearch)으로 최신 자료 수집
2. RELAY 블록 포맷 JSON으로 글 작성
3. GitHub에서 현재 data/index.json 읽기 (get_file_contents)
4. 두 파일을 main에 push:
   - data/posts/<id>.json   ← 새 글 본문
   - data/index.json        ← 맨 앞에 메타데이터 한 줄 추가 (sha 필요)
5. Vercel이 자동 재배포 → 몇 분 뒤 라이브 사이트 첫 줄 + 히어로에 노출
```

별도 명령·예약 불필요. 요청 → 발행 → 확인까지 Claude가 처리한다.

**발행 시 도구:** `mcp__GitHub__create_or_update_file`(파일 1개+sha) 또는 `mcp__GitHub__push_files`(여러 파일 한 커밋).
index.json 갱신은 기존 파일 수정이므로 **현재 sha를 먼저 받아야** 한다.

---

## 4. 데이터 구조 & 글 스키마

```
data/
├─ index.json          글 "메타데이터만" (피드가 읽음, 가벼움)
└─ posts/<id>.json      글 1편 본문 (리딩 뷰가 그 글만 읽음)
```
> 목록은 가볍게, 본문은 필요할 때만 → 글이 무한히 쌓여도 안 느려지는 구조.

**글 JSON 스키마 (posts/<id>.json):**

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✅ | 고유 슬러그 = 파일명. 영문/숫자/`-`/`_`만 (예: `topic-2026-06-11`) |
| `category` | ✅ | Technology / Culture / Business / Science (새 값 쓰면 필터에 자동 추가) |
| `title` | ✅ | 제목 |
| `source` | ✅ | 출처 표기 (웹검색 요약이면 `RELAY Briefing` 등) |
| `sourceUrl` |  | 원문 링크 ("원문 보기 ↗"에 연결) |
| `date` | ✅ | `YYYY.MM.DD` |
| `read` |  | 예: `6분` |
| `summary` | ✅ | AI 한 줄 요약 (2~3문장) |
| `lede` |  | 도입부 (HTML inline 가능) |
| `cover` |  | `{img, alt, caption, credit}` 커버 이미지 |
| `body` | ✅ | **블록 배열** (아래) |

**body 블록 타입:**

| type | 필드 | 용도 |
|---|---|---|
| `lede` | `html`/`text` | 도입 문단(큰 글씨) |
| `p` | `html` | 본문 문단 (`<strong>`,`<code>` inline 가능) |
| `h2` | `text` | 큰 소제목 |
| `h3` | `text` | 작은 소제목 |
| `ul` | `items[]` | 불릿 목록 (HTML 문자열 배열) |
| `figure` | `img,alt,caption,credit` | 본문 이미지 |

**index.json의 posts[] 항목**은 본문(`body`,`lede`,`cover`) 없이 메타만:
`id, category, title, source, date, read, summary` — **항상 배열 맨 앞에** 새 글을 넣는다(최신이 위).

> 로컬에서 작업할 땐 `node scripts/add-article.mjs <글.json>`이 posts 파일 생성 + index 갱신을 한 번에 해준다. (GitHub 직접 발행 시엔 Claude가 동일 로직을 커넥터로 수행)

---

## 5. 디자인 시스템 (반드시 유지)

- **쿨 모노톤만.** 웜톤(베이지·테라코타)·세리프·펄스점(깜빡이는 dot)·보라 그라데이션 **금지** (사용자 거부 항목).
- 액센트는 **슬레이트 하나** (`--accent:#3a4a66`). 폰트는 **Pretendard**.
- 토큰은 `index.html` / `article.html` 상단 `:root` CSS 변수에 정의.
- 위계는 세리프 대신 **굵기(700)+자간**으로.

---

## 6. 자동화 (선택 — 아직 미설정)

매일 정해진 시각 **자동 발행**을 원하면 예약작업(scheduled task)으로 걸 수 있다:
정해진 시각 → Claude 자동 실행 → 웹검색·작성·push → Vercel 배포.

**제약:** 이 예약작업은 **데스크톱 앱이 그 시각에 켜져 있어야** 실행된다(상시 서버 아님). 컴퓨터를 꺼놔도 도는 완전 무인은 **GitHub Actions 크론 + AI API**로 별도 구축해야 한다.
→ 현재는 "요청 시 발행"으로 운영 중. 주제 풀이 정해지면 그때 예약을 걸면 된다.

---

## 7. 운영 메모 / 겪은 함정 (재발 방지)

- **토큰 권한:** 발행이 `403 Resource not accessible`이면 토큰이 읽기 전용인 것. GitHub 토큰의 **Repository access = "Only select repositories"(relay-article)** + **Contents: Read and write**여야 한다. "Public repositories"로 두면 무조건 읽기 전용 → push 실패.
- **홈 링크:** 내부 "홈" 링크는 `index.html`이 아니라 **`/`**로. (주소창에 `index.html`이 노출되지 않게)
- **로컬 git 불안정:** 바탕화면 폴더는 마운트 특성상 `.git` 직접 조작이 불안정했음 → **push는 GitHub 커넥터로** 하는 게 안전.
- **저작권:** 남의 기사 **전문 재게시 금지.** AI 요약 + 짧은 발췌 + **원문 링크(`sourceUrl`)**만. 이미지는 라이선스 확인 후 `credit` 표기, 또는 AI 생성 커버.

---

## 8. 빠른 참조

- 폰트 CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css`
- 위키미디어 이미지 패턴: `https://commons.wikimedia.org/wiki/Special:FilePath/<파일명>?width=1600`
- 사이트명: **RELAY** / 부제: "Automated Reading Archive"
- 카테고리: Technology / Culture / Business / Science
- 레포: `github.com/jh-dex/relay-article` (배포: Vercel, main 자동)
- 첫 발행 예시 글 id: `comfyui-latest-models-2026-06`

---

## 9. 새 대화에서 이어가는 법 (체크리스트)

1. 바탕화면 `RELAY/` 폴더 접근 권한을 준다.
2. 이 `PUBLISHING.md`를 읽게 한다.
3. GitHub 도구(`mcp__GitHub__*`)가 로드돼 있는지 확인 (없으면 앱 재시작/새 대화).
4. "○○ 주제로 글 올려줘" → 3장 절차대로 발행.
