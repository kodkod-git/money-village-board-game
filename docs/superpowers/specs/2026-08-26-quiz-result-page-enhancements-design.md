# 경제적 잠재력 테스트 결과 페이지 미구현 사항 구현 — 설계 스펙 (2026-08-26)

> 기반 문서: `proposal/20260826_survey_design.md`
> 대상 기능: `src/pages/QuizResult.jsx`, `src/pages/QuizPlay.jsx` (스모어 대체 자체 구현 퀴즈, [[2026-08-24-smore-quiz-design]] 후속)

## 1. 목적

`2026-08-24-smore-quiz-design`으로 구현된 "우리 아이 경제 잠재력 테스트"에서 아직 빠진 4가지를 채운다.

1. 결과 페이지에 그룹별 일러스트(`public/groups/*.png`) 삽입
2. 이동 버튼 3종(네이버 리뷰, 그룹 자세히 보기, 경제 유형 알아보기)
3. 공유 버튼 3종(카카오톡, 링크, 사진)
4. `QuizPlay` 진행바(제목 밑, `n/9` 위, 파란색)

순수 프론트엔드 변경이며 백엔드/DB 스키마 변경은 없다.

## 2. 영향 파일

| 파일 | 변경 |
|---|---|
| `src/pages/QuizResult.jsx` | 레이아웃 재구성(히어로+바텀시트), 버튼 6개+다시하기 |
| `src/pages/QuizResult.module.css` | 히어로/카드/버튼 그룹 스타일 전면 추가 |
| `src/pages/QuizPlay.jsx` | 헤더에 진행바 엘리먼트 추가 |
| `src/pages/QuizPlay.module.css` | 진행바 스타일 추가 |
| `src/constants/quizData.js` | 그룹별 상세보기 URL, 공통 링크, 그룹별 `illustration` 경로 추가 |
| `src/pages/QuizResult.test.jsx` | 버튼 문구/신규 버튼 반영 |
| `index.html` | Kakao SDK `<script>` 태그 추가 |

## 3. 결과 페이지 레이아웃 (히어로 + 바텀시트)

```
┌─────────────────────────┐
│   group.color 배경       │  ← 히어로, 고정 높이(예: 220px)
│      [그룹 일러스트]       │
├─────────────────────────┤  ← 카드가 위로 겹치며 올라탐 (음수 margin-top, 상단만 둥근 모서리)
│  ╭─────────────────────╮ │
│  │ 우리 아이의 경제적...   │ │  eyebrow/groupName/tagline/description/animals/axisRow (기존 내용, 흰 배경 위 색상으로 전환)
│  │  ─────────────       │ │
│  │  더 알아보기            │ │
│  │  [그룹 자세히 보기]      │ │  outline
│  │  [경제유형 알아보기]     │ │  outline
│  │  [네이버 리뷰 작성하기]   │ │  outline
│  │  ─────────────       │ │
│  │  공유하기              │ │
│  │  [카카오톡 공유하기]     │ │  카카오 옐로우 bg
│  │  [링크 공유하기]        │ │  기존 shareBtn 스타일(흰 bg)
│  │  [사진 공유하기]        │ │  outline
│  │      다시 하기          │ │  텍스트 링크, 최하단
│  ╰─────────────────────╯ │
└─────────────────────────┘
```

- 배경색(`group.color`)은 히어로 영역에만 적용. 카드 내부는 `var(--white)`.
- 카드: `border-radius: var(--r-lg) var(--r-lg) 0 0`, 히어로 위로 살짝 겹침(bottom-sheet 스타일).
- 카드 안으로 들어오는 기존 텍스트 색은 `--white` → `--ink`/`--ink-2`로 전환(흰 배경 대비).
- 일러스트가 없는 그룹(매핑 실패)은 이미지 자체를 렌더링하지 않는다(깨진 이미지 아이콘 방지).

## 4. 데이터 (`quizData.js` 추가)

```js
export const GROUP_DETAIL_URLS = {
  'Orange Group': 'https://blog.naver.com/kodkod79/224229258314',
  'Blue Group':   'https://blog.naver.com/kodkod79/224229266592',
  'Green Group':  'https://blog.naver.com/kodkod79/224229264370',
  'Red Group':    'https://blog.naver.com/kodkod79/224229254511',
}
export const NAVER_REVIEW_URL = 'https://m.place.naver.com/my/checkin'
export const ECONOMIC_TYPES_URL = 'https://m.blog.naver.com/kodkod79/224205817036'
```

`RESULT_GROUPS`의 각 그룹 객체에 `illustration` 필드 추가(`/groups/green.png` 등, `result_group` → 파일명 매핑).

## 5. 버튼 동작

- **그룹 자세히 보기 / 경제유형 알아보기 / 네이버 리뷰 작성하기**: `<a href=... target="_blank" rel="noopener noreferrer">`, outline 버튼 스타일. 새 탭으로 열림(결과 화면 유지).
- **카카오톡 공유하기**: `window.Kakao`가 로드되고 `VITE_KAKAO_JS_KEY`가 설정돼 있으면 `Kakao.init(...)` 후 `Kakao.Share.sendDefault(...)` 호출(제목: 그룹명+태그라인, 이미지: 그룹 일러스트, 링크: 현재 결과 URL). 키가 없으면 버튼은 그대로 활성 상태로 보이되, 클릭 시 인라인 안내 문구("카카오톡 공유는 준비 중이에요")를 몇 초간 표시(`alert()` 사용 안 함).
- **링크 공유하기**: 기존 `navigator.clipboard.writeText(location.href)` 로직 유지, 버튼 문구만 "결과 공유하기" → "링크 공유하기"로 변경. 복사 후 "링크가 복사됐어요" 인라인 안내 표시.
- **사진 공유하기**: `group.illustration` 경로를 `<a download>`로 트리거해 `public/groups/*.png` 원본을 그대로 다운로드(가공/합성 없음).
- **다시 하기**: 기존과 동일하게 `/quiz`로 이동, 텍스트 링크 스타일로 최하단 배치.

### Kakao SDK 로딩

- `index.html`에 `<script src="https://developers.kakao.com/sdk/js/kakao.js"></script>` 추가.
- `QuizResult.jsx`에서 `window.Kakao && !window.Kakao.isInitialized() && import.meta.env.VITE_KAKAO_JS_KEY`일 때만 초기화. 키는 아직 없으므로 `.env`에 `VITE_KAKAO_JS_KEY=` placeholder만 추가하고, 실제 값은 추후 전달받는 대로 채운다.

## 6. `QuizPlay.jsx` 진행바

```
┌───────────────────────────┐
│  우리 아이 경제 잠재력 테스트   │  .title
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░  │  ← 신규 진행바
│         4/9              │  .subtitle (기존 유지)
└───────────────────────────┘
```

- 채움 비율 = `currentStepNumber / TOTAL_STEPS` (기존 계산 로직 재사용).
- 트랙: 옅은 회색(예: `--blue-10`), 높이 6~8px, `border-radius: 999px`.
- 채움 막대: `var(--blue-100)`, 동일 radius, **애니메이션/transition 없이 즉시 반영**.
- `STEP_ERROR` 상태에서도 마지막 진척도를 그대로 유지(별도 처리 불필요).

## 7. 테스트 영향

- `QuizResult.test.jsx`: "결과 공유하기" → "링크 공유하기" 문구 변경 반영. 신규 버튼(이동 3개, 카카오톡, 사진) 존재 및 `href`/`target`/`download` 속성 검증 테스트 추가.
- `QuizPlay.test.jsx`: 진행바 폭/스타일이 단계별로 갱신되는지 확인하는 테스트 추가(선택 사항, 필수는 아님).
- `quizScoring.js` 등 채점 로직 변경 없음 — 신규 유닛 테스트 불필요.

## 8. 범위 제외 (Out of scope)

- Kakao 앱 키 실제 발급/전달 — 키는 나중에 전달받아 `.env`에 채워 넣는다.
- 카카오톡 공유용 개인화 이미지 카드 생성(캔버스 합성) — `public/groups/*.png` 원본 그대로 사용.
- `2026-08-24-smore-quiz-design.md`에서 이미 범위 제외된 항목(관리자 통계 대시보드, EFTI 16유형 확장 등)은 이번에도 제외.
