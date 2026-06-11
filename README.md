# RELAY — Automated Reading Archive

AI가 매일 글 한 편을 써서 쌓아 올리는 에디토리얼 리딩 아카이브.
**수집·정리는 기계, 읽기는 사람.**

---

## 폴더 구조

```
RELAY/
├─ index.html              피드/아카이브 메인 (히어로 + 카테고리 필터 + 목록)
├─ article.html            리딩 뷰 — article.html?id=<글ID> 로 열림
├─ data/
│  ├─ index.json           글 "메타데이터만" (제목·요약·날짜·카테고리). 피드는 이것만 읽음.
│  └─ posts/
│     └─ <글ID>.json        글 1편당 파일 1개 (본문 전체). 리딩 뷰는 열람한 글 하나만 읽음.
├─ scripts/
│  ├─ add-article.mjs      새 글 추가 (posts 파일 생성 + index.json 갱신)
│  └─ _new-article.example.json   새 글 작성용 템플릿
└─ README.md
```

### 왜 이렇게 나눴나 (장기 확장성)
글이 1000편이 돼도 **HTML 파일은 `index.html` + `article.html` 둘뿐**이다.
글마다 HTML이 늘어나지 않는다. 글 추가 = JSON 파일 추가일 뿐.

핵심은 **목록은 가볍게, 본문은 필요할 때만**이다.
피드는 `index.json`(요약만)을 읽고, 본문은 그 글을 열 때 `posts/<id>.json` 하나만 받는다.
→ 글이 무한히 쌓여도 어떤 페이지든 다운로드 양이 일정 = 느려지지 않음.

---

## 로컬에서 보기 (중요)

파일을 쪼갰기 때문에 브라우저 보안정책(CORS) 상 **`index.html` 더블클릭은 안 된다.**
폴더에서 간단한 로컬 서버를 띄워야 한다. 둘 중 하나:

```
# 방법 1 — Node (npx)
cd RELAY
npx serve .

# 방법 2 — Python
cd RELAY
python -m http.server 8000
```

그다음 브라우저에서 `http://localhost:3000` (npx) 또는 `http://localhost:8000` (python) 접속.
> Vercel 등 실제 배포 환경에선 서버가 알아서 처리하므로 이 과정이 필요 없다.

---

## 새 글 추가하는 법

1. `scripts/_new-article.example.json` 을 복사해 새 글을 작성한다.
   - `id` 는 **고유한 슬러그**이자 파일명 (예: `on-device-ai-2026-06-12`). 영문/숫자/-/_ 만.
   - 필수: `id, category, title, source, date, summary, body`
   - `body` 는 블록 배열 — `h2 / h3 / p / lede / ul / figure` 타입.
   - 새 카테고리를 쓰면 필터에 자동 추가된다.
2. 터미널에서:
   ```
   node scripts/add-article.mjs scripts/내가만든글.json
   ```
3. `posts/<id>.json` 이 생기고 `index.json` 맨 앞에 등록되어,
   피드 최상단 + 히어로(Today's Lead)에 노출된다.

### body 블록 타입
| type | 용도 | 필드 |
|---|---|---|
| `lede` | 도입 문단(큰 글씨) | `html` 또는 `text` |
| `p` | 본문 문단 | `html`(인라인 `<strong>`,`<code>` 가능) |
| `h2` | 큰 소제목 | `text` |
| `h3` | 작은 소제목 | `text` |
| `ul` | 불릿 목록 | `items`(HTML 문자열 배열) |
| `figure` | 본문 이미지 | `img, alt, caption, credit` |

---

## 다음 단계 (아직 안 한 것)

이 폴더는 **확장 가능한 로컬 정적 사이트**까지 완성된 상태다. 이후는 요청 시 진행:

1. **GitHub 업로드 + Vercel 배포** → 실제 URL 공개 (빌드 불필요, 정적 그대로 올림)
2. **매일 자동 글 생성** → 예약작업이 매일 새 글 JSON을 만들고
   `add-article.mjs` 호출 → git push → Vercel 자동 재배포
3. **주제 풀 확정** → 어떤 분야의 글을 매일 쓸지 결정

### 저작권 메모 (handoff 문서 기준)
- 남의 기사 **전문 재게시 금지.** AI 요약 + 짧은 발췌 + **원문 링크**(`sourceUrl`)만.
- 이미지는 라이선스 확인 후 `credit` 표기, 또는 AI 생성 커버 사용.

---

## 디자인 시스템 (유지할 것)
- 쿨 모노톤만. 웜톤·세리프·펄스점·보라 그라데이션 **금지.**
- 액센트는 슬레이트(`#3a4a66`) 하나. 폰트는 Pretendard.
- 토큰은 각 HTML 상단 `:root` CSS 변수에 정의됨.
