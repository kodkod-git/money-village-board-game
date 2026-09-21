# 경제적 잠재력 테스트 Figma 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `QuizIntro`/`QuizPlay`/`QuizResult` 세 화면을 새 Figma 시안에 맞춰 컴포넌트 순서·문구·인터랙션을 다시 만들고, 다른 온보딩 화면과 같은 `onboarding-mode` + `--sx`/`--sy` vscale 반응형 방식으로 통일한다.

**Architecture:** 순수 프론트엔드 변경(백엔드/DB 스키마 변경 없음). 세 페이지 모두 `useBodyClass('quiz-mode')`를 `useBodyClass('onboarding-mode')`로 바꿔 834×1194 Figma 프레임 체계에 편입시킨다. `QuizPlay`는 성별/질문 단계를 "선택 후 다음 버튼" 2단계 구조로, 진행률 계산을 "이름부터 1로 세는" 방식으로 바꾼다. `QuizResult`는 히어로 크롭/페이드, 배지형 아이콘, 대표 동물 아바타 행, 핵심 가치 2×2 그리드를 추가한다.

**Tech Stack:** React (Vite), CSS Modules, Vitest + Testing Library. `color-mix()` CSS 함수(모던 브라우저, 이미 `dvh`/`cqw` 등 모던 CSS를 쓰는 코드베이스라 문제 없음).

**참고 스펙:** `docs/superpowers/specs/2026-09-21-quiz-figma-sync-design.md`
**참고(선행 작업):** `proposal/20260907_figma_responsive_sync_proposal.md` (`--sx`/`--sy` vscale 방식의 최초 정의), `docs/superpowers/plans/2026-08-26-quiz-result-page-enhancements.md` (현재 결과 화면 구조)

---

### Task 1: `quizData.js` — 문구/데이터 상수 갱신

**Files:**
- Modify: `src/constants/quizData.js` (전체 교체)
- Test: `src/constants/quizData.test.js` (전체 교체)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/constants/quizData.test.js`를 다음 내용으로 전체 교체:

```js
import { describe, it, expect } from 'vitest'
import { RESULT_GROUPS, GROUP_DETAIL_URLS, ANIMAL_EMOJIS, QUESTIONS, TOTAL_QUIZ_STEPS } from './quizData'

describe('quizData', () => {
  it('모든 결과 그룹에 대해 일러스트 경로와 상세보기 링크가 존재한다', () => {
    Object.keys(RESULT_GROUPS).forEach(groupName => {
      expect(RESULT_GROUPS[groupName].illustration).toMatch(/^\/groups\/.+\.png$/)
      expect(GROUP_DETAIL_URLS[groupName]).toMatch(/^https:\/\//)
    })
  })

  it('모든 그룹의 대표 동물에 이모지가 매핑돼 있다', () => {
    Object.values(RESULT_GROUPS).forEach(group => {
      group.animals.forEach(animal => {
        expect(ANIMAL_EMOJIS[animal]).toBeDefined()
      })
    })
  })

  it('TOTAL_QUIZ_STEPS는 이름·성별·나이 3단계 + 질문 개수와 같다', () => {
    expect(TOTAL_QUIZ_STEPS).toBe(QUESTIONS.length + 3)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/constants/quizData.test.js`
Expected: FAIL — `ANIMAL_EMOJIS`/`TOTAL_QUIZ_STEPS`가 export되지 않아 `undefined`.

- [ ] **Step 3: `quizData.js` 전체 교체**

`src/constants/quizData.js`를 다음 내용으로 전체 교체:

```js
export const GUIDE_TEXT = '우리 아이와 가까운 모습을 선택해주세요.\n정답은 없습니다.'

export const INTRO_TITLE_LINE1 = '우리 아이'
export const INTRO_TITLE_LINE2 = '경제 잠재력 테스트'
export const INTRO_SUBTITLE = '우리 아이의 경제 컬러는 무엇일까요?\n아이와 가까운 모습을 선택해주세요'
export const INTRO_SUBTITLE_EMPHASIS = '정답은 없습니다'
export const INTRO_META_TIME = '약 3분'
export const INTRO_META_ANALYSIS = '유형 분석'
export const INTRO_FOOTER = '© 2026 머니빌리지'

export const NAME_TITLE = '아이의 이름을\n알려주세요'
export const NAME_SUBTITLE = '결과 화면에 표시됩니다'
export const NAME_LABEL = '이름'
export const NAME_PLACEHOLDER = '예: 이준서'

export const GENDER_TITLE = '성별을\n선택해주세요'
// value는 survey.efti_test_responses.child_gender 컬럼에 저장된다.
export const GENDER_OPTIONS = [
  { value: 'male', label: '남자아이' },
  { value: 'female', label: '여자아이' },
]

export const AGE_SUBTITLE = '숫자를 입력해주세요'
export const AGE_LABEL = '숫자'
export const AGE_PLACEHOLDER = '예: 10'

export const QUESTION_SUBTITLE = '아이와 가까운 모습을 골라주세요'

// key는 survey.efti_test_responses 컬럼명과 1:1 대응한다.
// axis: 'A'는 오늘(today)/내일(tomorrow), 'B'는 안전(safety)/모험(adventure).
export const QUESTIONS = [
  {
    key: 'q_pocket_money',
    axis: 'A',
    prompt: '우리 아이는 용돈을 받으면 어떤 편인가요?',
    options: [
      { text: '바로 쓰며 기뻐하는 편이에요.', polarity: 'today' },
      { text: '모았다가 뜻있게 쓰는 편이에요.', polarity: 'tomorrow' },
    ],
  },
  {
    key: 'q_new_activity',
    axis: 'B',
    prompt: '우리 아이는 새로운 활동을 할 때 어떤 편인가요?',
    options: [
      { text: '익숙한 방법이 편한 편이에요.', polarity: 'safety' },
      { text: '새로운 방법도 즐겁게 해보는 편이에요.', polarity: 'adventure' },
    ],
  },
  {
    key: 'q_want_something',
    axis: 'A',
    prompt: '우리 아이는 갖고 싶은 것이 생기면 어떤 편인가요?',
    options: [
      { text: '빨리 갖고 싶어 하는 편이에요.', polarity: 'today' },
      { text: '기다렸다가 더 잘 고르는 편이에요.', polarity: 'tomorrow' },
    ],
  },
  {
    key: 'q_hard_task',
    axis: 'B',
    prompt: '우리 아이는 쉽지 않아 보이는 일 앞에서 어떤 편인가요?',
    options: [
      { text: '잘할 수 있는 방법을 먼저 고르는 편이에요.', polarity: 'safety' },
      { text: '해보면서 배워보려는 편이에요.', polarity: 'adventure' },
    ],
  },
  {
    key: 'q_choosing_item',
    axis: 'A',
    prompt: '우리 아이는 물건을 고를 때 어떤 편인가요?',
    options: [
      { text: '지금 마음에 드는 것을 고르는 편이에요.', polarity: 'today' },
      { text: '오래 쓸 수 있는 것을 생각하는 편이에요.', polarity: 'tomorrow' },
    ],
  },
  {
    key: 'q_problem_solving',
    axis: 'B',
    prompt: '우리 아이는 문제를 해결할 때 어떤 편인가요?',
    options: [
      { text: '실수 없는 방법을 고르는 편이에요.', polarity: 'safety' },
      { text: '여러 방법을 시도해보는 편이에요.', polarity: 'adventure' },
    ],
  },
]

// "안내" 슬라이드는 Figma 진행률에 포함되지 않는다 — 이름·성별·나이 3단계 + 질문 개수.
export const TOTAL_QUIZ_STEPS = QUESTIONS.length + 3

export const AXIS_LABELS = {
  axisTodayTomorrow: { left: '내일 꿈꾸기', leftValue: 'tomorrow', right: '오늘 가꾸기', rightValue: 'today' },
  axisSafetyAdventure: { left: '안전 지키기', leftValue: 'safety', right: '모험 즐기기', rightValue: 'adventure' },
}

export const NAVER_REVIEW_URL = 'https://m.place.naver.com/my/checkin'
export const ECONOMIC_TYPES_URL = 'https://m.blog.naver.com/kodkod79/224205817036'

export const GROUP_DETAIL_URLS = {
  'Orange Group': 'https://blog.naver.com/kodkod79/224229258314',
  'Blue Group': 'https://blog.naver.com/kodkod79/224229266592',
  'Green Group': 'https://blog.naver.com/kodkod79/224229264370',
  'Red Group': 'https://blog.naver.com/kodkod79/224229254511',
}

// 결과 화면 "대표 동물" 아바타에 쓰는 이모지. RESULT_GROUPS[].animals(이름 문자열)과
// 함께 참조해서 렌더링한다.
export const ANIMAL_EMOJIS = {
  판다: '🐼', 캥거루: '🦘', 고양이: '🐱', 펭귄: '🐧',
  강아지: '🐶', 여우: '🦊', 원숭이: '🐵', 호랑이: '🐯',
  개미: '🐜', 부엉이: '🦉', 다람쥐: '🐿️', 수달: '🦦',
  독수리: '🦅', 돌고래: '🐬', 사자: '🦁', 코끼리: '🐘',
}

// bgColor는 각 일러스트(/groups/*.png)의 배경색 평균값이다. 결과 화면 배경을
// 일러스트 배경과 맞춰 이음새가 보이지 않게 하려고 쓴다.
export const RESULT_GROUPS = {
  'Green Group': {
    color: '#4CAF7D',
    bgColor: '#99D8B0',
    tagline: '오늘을 가꾸며 안정을 추구하는 그룹',
    description: '오늘의 일상을 소중히 가꾸고 편안하게 지켜가는 힘이 보여요',
    animals: ['판다', '캥거루', '고양이', '펭귄'],
    illustration: '/groups/green.png',
  },
  'Red Group': {
    color: '#F26D6D',
    bgColor: '#F39E91',
    tagline: '지금 이 순간, 도전을 즐기는 그룹',
    description: '지금 이 순간을 즐기며 용감하게 움직이는 힘이 보여요',
    animals: ['강아지', '여우', '원숭이', '호랑이'],
    illustration: '/groups/red.png',
  },
  'Orange Group': {
    color: '#F2A65A',
    bgColor: '#F8AB66',
    tagline: '내일을 준비하며 안전을 지키는 그룹',
    description: '차분하게 준비하고 안정적으로 선택하는 힘이 보여요',
    animals: ['개미', '부엉이', '다람쥐', '수달'],
    illustration: '/groups/orange.png',
  },
  'Blue Group': {
    color: '#5B8DEF',
    bgColor: '#AACEF1',
    tagline: '미래에 과감히 투자하는 그룹',
    description: '미래를 바라보며 과감하게 도전하는 힘이 보여요',
    animals: ['독수리', '돌고래', '사자', '코끼리'],
    illustration: '/groups/blue.png',
  },
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/constants/quizData.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/constants/quizData.js src/constants/quizData.test.js
git commit -m "feat: update quiz copy constants and add animal emoji map for Figma sync"
```

---

### Task 2: 공통 인프라 — `quiz-mode` 폐기, `onboarding-mode`로 통합

**Files:**
- Modify: `src/pages/QuizIntro.jsx:8`
- Modify: `src/pages/QuizPlay.jsx:21`
- Modify: `src/pages/QuizResult.jsx:18`
- Modify: `src/index.css:177-204`

이 작업은 동작을 바꾸지 않는 순수 리팩터이므로(바디 클래스 이름만 교체) 신규 테스트 없이 기존 스위트가 계속 통과하는 것으로 검증한다.

- [ ] **Step 1: 세 페이지의 `useBodyClass` 호출 교체**

`src/pages/QuizIntro.jsx:8`에서:
```js
  useBodyClass('quiz-mode')
```
를
```js
  useBodyClass('onboarding-mode')
```
로 교체.

`src/pages/QuizPlay.jsx:21`에서 동일하게 `useBodyClass('quiz-mode')` → `useBodyClass('onboarding-mode')`.

`src/pages/QuizResult.jsx:18`에서 동일하게 `useBodyClass('quiz-mode')` → `useBodyClass('onboarding-mode')`.

- [ ] **Step 2: `index.css`에서 이제 쓰이지 않는 `body.quiz-mode` 블록 삭제**

`src/index.css:177-204`의 다음 블록을 통째로 삭제(바로 위 `input, button` 규칙과 바로 아래 `body.onboarding-mode` 주석 사이에 빈 줄 하나만 남긴다):

```css
/* 퀴즈 화면은 기기·화면 크기와 무관하게 모바일 폭 한 장으로 보여준다.
   공통 폰 프레임(#root의 둥근 테두리·그림자·고정 비율)을 벗어나고,
   세로 길이는 제한 없이 내용만큼 늘어난다. */
body.quiz-mode {
  padding: 0;
  align-items: flex-start;
  justify-content: center;
  background: var(--bluish-white);
}

body.quiz-mode::before,
body.quiz-mode::after {
  display: none;
}

body.quiz-mode #root {
  width: min(100vw, var(--app-max-width));
  height: auto;
  min-height: 100dvh;
  max-height: none;
  aspect-ratio: unset;
  border: none;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
  contain: none;
}
```

- [ ] **Step 3: 기존 스위트 통과 확인**

Run: `npx vitest run src/pages/QuizIntro.test.jsx src/pages/QuizResult.test.jsx`
Expected: PASS (아직 화면 내용을 바꾸지 않았으므로 기존 테스트 그대로 통과해야 한다)

`src/pages/QuizPlay.test.jsx`는 이 스텝에서 실행하지 않는다 — Task 1에서 `quizData.js`의 `GENDER_LABEL`을 제거하고 `NAME_PLACEHOLDER`/`AGE_PLACEHOLDER` 문구를 바꿨기 때문에, 아직 옛 버전인 `QuizPlay.jsx`/`QuizPlay.test.jsx`는 Task 1 이후 이미 몇 건 실패하는 상태다(예: `GENDER_LABEL`이 더 이상 export되지 않아 성별 안내 문구가 비고, placeholder 텍스트 불일치). 이는 Task 1→Task 4 사이의 의도된 전이 상태이며 Task 2의 변경(바디 클래스명 교체)과는 무관하다. Task 4가 `QuizPlay.jsx`/`QuizPlay.test.jsx`를 전체 교체하면서 해결되므로, 이 태스크에서는 손대지 않는다.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/QuizIntro.jsx src/pages/QuizPlay.jsx src/pages/QuizResult.jsx src/index.css
git commit -m "refactor: move quiz pages onto the shared onboarding-mode Figma frame"
```

---

### Task 3: `QuizIntro` 재구성

**Files:**
- Modify: `src/pages/QuizIntro.jsx`
- Modify: `src/pages/QuizIntro.module.css`
- Test: `src/pages/QuizIntro.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizIntro.test.jsx`를 다음 내용으로 전체 교체:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizIntro from './QuizIntro'
import { QUESTIONS } from '../constants/quizData'

describe('QuizIntro', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('제목과 시작 버튼을 렌더링한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(screen.getByText('우리 아이')).toBeInTheDocument()
    expect(screen.getByText('경제 잠재력 테스트')).toBeInTheDocument()
    expect(screen.getByText('테스트 시작하기')).toBeInTheDocument()
  })

  it('실제 질문 개수를 메타 정보에 표시한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(screen.getByText(`${QUESTIONS.length}가지 질문`)).toBeInTheDocument()
  })

  it('시작 버튼을 누르면 /quiz/play로 이동한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    fireEvent.click(screen.getByText('테스트 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz/play')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/QuizIntro.test.jsx`
Expected: FAIL — `getByText('우리 아이')`가 지금 제목 "우리 아이 경제 잠재력(색깔편)"과 정확히 일치하지 않아 실패(또는 여러 요소가 잡혀 실패).

- [ ] **Step 3: `QuizIntro.jsx` 전체 교체**

```jsx
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import useBodyClass from '../hooks/useBodyClass'
import {
  INTRO_TITLE_LINE1, INTRO_TITLE_LINE2, INTRO_SUBTITLE, INTRO_SUBTITLE_EMPHASIS,
  INTRO_META_TIME, INTRO_META_ANALYSIS, INTRO_FOOTER, QUESTIONS,
} from '../constants/quizData'
import styles from './QuizIntro.module.css'

export default function QuizIntro() {
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.center}>
        <h1 className={styles.title}>
          {INTRO_TITLE_LINE1}
          <span className={styles.titleAccent}>{INTRO_TITLE_LINE2}</span>
        </h1>
        <p className={styles.subtitle}>
          {INTRO_SUBTITLE}
          <br />
          <span className={styles.subtitleEmphasis}>{INTRO_SUBTITLE_EMPHASIS}</span>
        </p>
        <div className={styles.card}>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
                <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
              </svg>
              {QUESTIONS.length}가지 질문
            </span>
            <span className={styles.metaItem}>
              <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l3 2" />
                <path d="M9 2h6" />
              </svg>
              {INTRO_META_TIME}
            </span>
            <span className={styles.metaItem}>
              <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="5" r="2" />
                <circle cx="18" cy="10" r="2" />
                <circle cx="18" cy="19" r="2" />
                <path d="M6 7v6a2 2 0 0 0 2 2h1M9 15h7M18 12v5" />
              </svg>
              {INTRO_META_ANALYSIS}
            </span>
          </div>
          <button className={styles.startBtn} onClick={() => navigate('/quiz/play')}>
            테스트 시작하기
          </button>
        </div>
        <p className={styles.footer}>{INTRO_FOOTER}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `QuizIntro.module.css` 전체 교체**

```css
.page {
  --sx: calc(100cqw / 834px);
  --sy: calc(100cqh / 1194px);
  min-height: 100%;
  height: 100%;
  background: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 clamp(20px, calc(49px * var(--sx)), 49px);
  overflow: hidden;
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, calc(14px * var(--sy)), 14px);
  text-align: center;
  width: 100%;
  max-width: clamp(300px, calc(426px * min(var(--sx), var(--sy))), 426px);
}

.title {
  font-size: clamp(24px, calc(36px * min(var(--sx), var(--sy))), 36px);
  line-height: 1.22;
  font-weight: 900;
  color: var(--ink);
}

.titleAccent {
  display: block;
  color: var(--blue-100);
}

.subtitle {
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  line-height: 1.5;
  font-weight: 700;
  color: var(--ink-2);
}

.subtitleEmphasis {
  color: #374151;
}

.card {
  width: 100%;
  margin-top: clamp(8px, calc(12px * var(--sy)), 12px);
  background: var(--white);
  border: 2px solid var(--blue-75);
  border-radius: clamp(16px, calc(24px * var(--sy)), 24px);
  padding: clamp(16px, calc(24px * var(--sy)), 24px);
  display: flex;
  flex-direction: column;
  gap: clamp(12px, calc(16px * var(--sy)), 16px);
}

.metaRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(8px, calc(12px * var(--sx)), 12px);
}

.metaItem {
  display: flex;
  align-items: center;
  gap: clamp(4px, calc(6px * var(--sx)), 6px);
  font-size: clamp(11px, calc(14px * min(var(--sx), var(--sy))), 14px);
  color: var(--ink-2);
  white-space: nowrap;
}

.metaIcon {
  width: clamp(15px, calc(20px * min(var(--sx), var(--sy))), 20px);
  height: clamp(15px, calc(20px * min(var(--sx), var(--sy))), 20px);
  flex-shrink: 0;
}

.startBtn {
  width: 100%;
  height: clamp(46px, calc(56px * var(--sy)), 56px);
  background: var(--blue-100);
  color: var(--white);
  border-radius: clamp(12px, calc(16px * var(--sy)), 16px);
  font-size: clamp(16px, calc(20px * min(var(--sx), var(--sy))), 20px);
  font-weight: 700;
  box-shadow: var(--shadow-blue);
}

.footer {
  margin-top: clamp(8px, calc(12px * var(--sy)), 12px);
  font-size: clamp(10px, calc(12px * min(var(--sx), var(--sy))), 12px);
  color: var(--disabled);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/QuizIntro.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/QuizIntro.jsx src/pages/QuizIntro.module.css src/pages/QuizIntro.test.jsx
git commit -m "feat: rebuild quiz intro screen to match Figma layout"
```

---

### Task 4: `QuizPlay` — 진행률 재계산 + 선택 후 확정(select-then-confirm) 인터랙션

**Files:**
- Modify: `src/pages/QuizPlay.jsx` (전체 교체)
- Modify: `src/pages/QuizPlay.module.css` (전체 교체)
- Test: `src/pages/QuizPlay.test.jsx` (전체 교체)

이 태스크는 하나의 상태 머신 파일을 다루므로 진행률 계산 변경과 성별/질문 select-then-confirm 변경을 한 번에 적용한다(부분 교체 시 상태 불일치 위험이 커서 전체 교체가 더 안전함).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizPlay.test.jsx`를 다음 내용으로 전체 교체:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizPlay from './QuizPlay'
import { QUESTIONS } from '../constants/quizData'

function answerAllQuestions() {
  // 안내 슬라이드
  fireEvent.click(screen.getByText('다음 문제'))
  // 이름
  fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
  fireEvent.click(screen.getByText('다음'))
  // 성별 — 선택 후 다음 버튼으로 확정
  fireEvent.click(screen.getByRole('button', { name: /남자아이/ }))
  fireEvent.click(screen.getByText('다음'))
  // 나이
  fireEvent.change(screen.getByPlaceholderText('예: 10'), { target: { value: '7' } })
  fireEvent.click(screen.getByText('다음'))
  // 질문 N개 모두 첫 번째 선택지(today/safety 쪽)를 고르고 다음으로 확정 → Green Group
  for (let i = 0; i < QUESTIONS.length; i++) {
    const buttons = screen.getAllByRole('button').filter(b => b.dataset.quizOption)
    fireEvent.click(buttons[0])
    fireEvent.click(screen.getByText('다음'))
  }
}

describe('QuizPlay', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'result-1' }) })
  })

  it('안내 슬라이드를 먼저 보여주고 진행바는 표시하지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    expect(screen.getByText(/우리 아이와 가까운 모습을 선택해주세요/)).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-progress-fill')).not.toBeInTheDocument()
  })

  it('이름을 입력하지 않으면 다음으로 넘어가지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.click(screen.getByText('다음'))
    expect(screen.getByPlaceholderText('예: 이준서')).toBeInTheDocument()
  })

  it(`${QUESTIONS.length}문항을 모두 답하면 결과를 저장하고 결과 페이지로 이동한다`, async () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    answerAllQuestions()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/quiz/results', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/quiz/result/result-1'))

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.childName).toBe('철수')
    expect(body.childGender).toBe('male')
    expect(body.childAge).toBe(7)
    expect(body.resultGroup).toBe('Green Group')
  })

  it('성별을 선택하고 다음 버튼을 눌러야 나이 입력 단계로 넘어간다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음'))

    expect(screen.getByText(/성별을/)).toBeInTheDocument()
    const nextBtn = screen.getByText('다음')
    expect(nextBtn).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /여자아이/ }))
    expect(nextBtn).not.toBeDisabled()
    expect(screen.queryByPlaceholderText('예: 10')).not.toBeInTheDocument()

    fireEvent.click(nextBtn)
    expect(screen.getByPlaceholderText('예: 10')).toBeInTheDocument()
  })

  it('질문 단계에서도 선택 후 다음 버튼을 눌러야 다음 문항으로 넘어간다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음'))
    fireEvent.click(screen.getByRole('button', { name: /남자아이/ }))
    fireEvent.click(screen.getByText('다음'))
    fireEvent.change(screen.getByPlaceholderText('예: 10'), { target: { value: '7' } })
    fireEvent.click(screen.getByText('다음'))

    const firstQuestionText = QUESTIONS[0].prompt
    expect(screen.getByText(firstQuestionText)).toBeInTheDocument()
    const nextBtn = screen.getByText('다음')
    expect(nextBtn).toBeDisabled()

    const options = screen.getAllByRole('button').filter(b => b.dataset.quizOption)
    fireEvent.click(options[0])
    expect(nextBtn).not.toBeDisabled()
    expect(screen.getByText(firstQuestionText)).toBeInTheDocument() // 아직 다음 문항으로 넘어가지 않음

    fireEvent.click(nextBtn)
    expect(screen.getByText(QUESTIONS[1].prompt)).toBeInTheDocument()
  })

  it('진행바는 이름 단계부터 표시되며 "안내" 단계는 세지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    const total = QUESTIONS.length + 3

    fireEvent.click(screen.getByText('다음 문제')) // 이름 단계 = 1/total
    const fill = screen.getByTestId('quiz-progress-fill')
    expect(parseFloat(fill.style.width)).toBeCloseTo((1 / total) * 100, 5)

    fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음')) // 성별 단계 = 2/total
    expect(parseFloat(fill.style.width)).toBeCloseTo((2 / total) * 100, 5)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/QuizPlay.test.jsx`
Expected: FAIL — 여러 건(플레이스홀더 텍스트 불일치, "다음" 버튼 부재, `quiz-progress-fill`이 안내 단계에도 렌더링됨 등).

- [ ] **Step 3: `QuizPlay.jsx` 전체 교체**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import {
  GUIDE_TEXT, NAME_TITLE, NAME_SUBTITLE, NAME_LABEL, NAME_PLACEHOLDER,
  GENDER_TITLE, GENDER_OPTIONS, AGE_SUBTITLE, AGE_LABEL, AGE_PLACEHOLDER,
  QUESTION_SUBTITLE, QUESTIONS, TOTAL_QUIZ_STEPS,
} from '../constants/quizData'
import { calcQuizResult } from '../utils/quizScoring'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizPlay.module.css'

const STEP_GUIDE = 'guide'
const STEP_NAME = 'name'
const STEP_GENDER = 'gender'
const STEP_AGE = 'age'
const STEP_QUESTION = 'question'
const STEP_ANALYZING = 'analyzing'
const STEP_DONE = 'done'
const STEP_ERROR = 'error'

export default function QuizPlay() {
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')
  const [step, setStep] = useState(STEP_GUIDE)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [childName, setChildName] = useState('')
  const [childGender, setChildGender] = useState('')
  const [childAge, setChildAge] = useState('')
  const [answers, setAnswers] = useState({})
  const [polarities, setPolarities] = useState({})

  function submitResult() {
    setStep(STEP_ANALYZING)
    const { axisTodayTomorrow, axisSafetyAdventure, resultGroup } = calcQuizResult(polarities)

    fetch('/api/quiz/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName, childGender, childAge: Number(childAge), answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup,
      }),
    })
      .then(r => { if (!r.ok) throw new Error('save failed'); return r.json() })
      .then(data => {
        setStep(STEP_DONE)
        setTimeout(() => navigate(`/quiz/result/${data.id}`), 600)
      })
      .catch(() => setStep(STEP_ERROR))
  }

  function selectGender(value) {
    setChildGender(value)
  }

  function confirmGender() {
    setStep(STEP_AGE)
  }

  function selectAnswer(question, option) {
    setAnswers(prev => ({ ...prev, [question.key]: option.text }))
    setPolarities(prev => ({ ...prev, [question.key]: option.polarity }))
  }

  function confirmAnswer() {
    if (questionIndex + 1 < QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1)
    } else {
      submitResult()
    }
  }

  if (step === STEP_ANALYZING || step === STEP_DONE) {
    return (
      <div className={styles.page}>
        <div className={styles.statusWrap}>
          {step === STEP_ANALYZING && <div className={styles.spinner} />}
          <p className={styles.statusText}>{step === STEP_ANALYZING ? '결과 분석중' : '완료'}</p>
        </div>
      </div>
    )
  }

  const currentStepNumber =
    step === STEP_NAME ? 1
    : step === STEP_GENDER ? 2
    : step === STEP_AGE ? 3
    : step === STEP_QUESTION || step === STEP_ERROR ? 4 + questionIndex
    : 0 // STEP_GUIDE — Figma 진행률에 포함되지 않는 단계

  const currentQuestion = QUESTIONS[questionIndex]

  return (
    <div className={styles.page}>
      <BackButton />

      {currentStepNumber > 0 && (
        <div className={styles.progressHeader}>
          <div className={styles.progressMeta}>
            <span>{currentStepNumber}/{TOTAL_QUIZ_STEPS}</span>
            <span className={styles.progressPercent}>{Math.round((currentStepNumber / TOTAL_QUIZ_STEPS) * 100)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              data-testid="quiz-progress-fill"
              style={{ width: `${(currentStepNumber / TOTAL_QUIZ_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className={styles.center}>
        {step === STEP_ERROR && (
          <div className={styles.card}>
            <p className={styles.questionPrompt}>결과 저장에 실패했어요.</p>
            <button className={styles.gradBtn} onClick={submitResult}>다시 시도하기</button>
          </div>
        )}

        {step === STEP_GUIDE && (
          <div className={styles.card}>
            <p className={styles.guideText}>{GUIDE_TEXT}</p>
            <button className={styles.gradBtn} onClick={() => setStep(STEP_NAME)}>다음 문제</button>
          </div>
        )}

        {step === STEP_NAME && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{NAME_TITLE}</h1>
              <p className={styles.stepSubtitle}>{NAME_SUBTITLE}</p>
            </div>
            <div className={styles.card}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>{NAME_LABEL}</label>
                <input
                  className={styles.input}
                  placeholder={NAME_PLACEHOLDER}
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                />
              </div>
              <button className={styles.gradBtn} onClick={() => childName.trim() && setStep(STEP_GENDER)} disabled={!childName.trim()}>
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_GENDER && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{GENDER_TITLE}</h1>
            </div>
            <div className={styles.card}>
              <div className={styles.optionList}>
                {GENDER_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.choiceCard} ${option.value === childGender ? styles.choiceCardSelected : ''}`}
                    onClick={() => selectGender(option.value)}
                  >
                    <span>{option.label}</span>
                    {option.value === childGender && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <button className={styles.gradBtn} onClick={confirmGender} disabled={!childGender}>
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_AGE && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{childName}는 몇 살인가요?</h1>
              <p className={styles.stepSubtitle}>{AGE_SUBTITLE}</p>
            </div>
            <div className={styles.card}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>{AGE_LABEL}</label>
                <input
                  className={styles.input}
                  type="number"
                  placeholder={AGE_PLACEHOLDER}
                  value={childAge}
                  onChange={e => setChildAge(e.target.value)}
                />
              </div>
              <button className={styles.gradBtn} onClick={() => childAge && setStep(STEP_QUESTION)} disabled={!childAge}>
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_QUESTION && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{currentQuestion.prompt}</h1>
              <p className={styles.stepSubtitle}>{QUESTION_SUBTITLE}</p>
            </div>
            <div className={styles.card}>
              <div className={styles.optionList}>
                {currentQuestion.options.map(option => (
                  <button
                    key={option.text}
                    data-quiz-option="true"
                    type="button"
                    className={`${styles.choiceCard} ${answers[currentQuestion.key] === option.text ? styles.choiceCardSelected : ''}`}
                    onClick={() => selectAnswer(currentQuestion, option)}
                  >
                    <span>{option.text}</span>
                    {answers[currentQuestion.key] === option.text && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <button className={styles.gradBtn} onClick={confirmAnswer} disabled={!answers[currentQuestion.key]}>
                다음
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `QuizPlay.module.css` 전체 교체**

```css
.page {
  --sx: calc(100cqw / 834px);
  --sy: calc(100cqh / 1194px);
  min-height: 100%;
  height: 100%;
  background: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 clamp(20px, calc(49px * var(--sx)), 49px);
  overflow: hidden;
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
}

.progressHeader {
  position: absolute;
  top: clamp(70px, calc(112px * var(--sy)), 112px);
  left: clamp(20px, calc(49px * var(--sx)), 49px);
  right: clamp(20px, calc(49px * var(--sx)), 49px);
}

.progressMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: clamp(11px, calc(14px * min(var(--sx), var(--sy))), 14px);
  color: var(--disabled);
  margin-bottom: clamp(6px, calc(8px * var(--sy)), 8px);
}

.progressPercent {
  color: var(--blue-100);
}

.progressTrack {
  width: 100%;
  height: clamp(6px, calc(8px * var(--sy)), 8px);
  background: var(--blue-15);
  border-radius: 999px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--blue-100);
  border-radius: 999px;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(20px, calc(32px * var(--sy)), 32px);
  width: 100%;
  max-width: clamp(300px, calc(426px * min(var(--sx), var(--sy))), 426px);
  text-align: center;
}

.heading {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stepTitle {
  font-size: clamp(22px, calc(36px * min(var(--sx), var(--sy))), 36px);
  line-height: 1.22;
  font-weight: 900;
  color: var(--ink);
  white-space: pre-line;
}

.stepSubtitle {
  margin-top: clamp(6px, calc(8px * var(--sy)), 8px);
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  font-weight: 700;
  color: var(--ink-2);
}

.card {
  width: 100%;
  max-width: clamp(300px, calc(426px * min(var(--sx), var(--sy))), 426px);
  background: var(--white);
  border: 2px solid var(--blue-75);
  border-radius: clamp(16px, calc(24px * var(--sy)), 24px);
  padding: clamp(18px, calc(26px * var(--sy)), 26px);
  display: flex;
  flex-direction: column;
  gap: clamp(14px, calc(20px * var(--sy)), 20px);
}

.guideText,
.questionPrompt {
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  font-weight: 700;
  color: var(--ink);
  white-space: pre-line;
  text-align: center;
}

.inputGroup {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, calc(8px * var(--sy)), 8px);
  text-align: left;
}

.label {
  font-size: clamp(10px, calc(12px * min(var(--sx), var(--sy))), 12px);
  font-weight: 900;
  color: var(--ink-2);
  letter-spacing: calc(1.2px * var(--sx));
  text-transform: uppercase;
}

.input {
  height: clamp(46px, calc(56px * var(--sy)), 56px);
  border-radius: clamp(14px, calc(20px * var(--sy)), 20px);
  border: 2px solid var(--blue-50);
  background: var(--blue-15);
  padding: 0 clamp(14px, calc(20px * var(--sx)), 20px);
  font-size: clamp(14px, calc(16px * min(var(--sx), var(--sy))), 16px);
  color: var(--ink);
  outline: none;
}

.input::placeholder { color: var(--disabled); }
.input:focus { border-color: var(--blue-75); }

.input::-webkit-outer-spin-button,
.input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.input[type='number'] { -moz-appearance: textfield; }

.gradBtn {
  height: clamp(46px, calc(56px * var(--sy)), 56px);
  background: var(--blue-100);
  color: var(--white);
  font-size: clamp(16px, calc(20px * min(var(--sx), var(--sy))), 20px);
  font-weight: 700;
  border-radius: clamp(14px, calc(20px * var(--sy)), 20px);
  box-shadow: var(--shadow-blue);
}

.gradBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.optionList {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, calc(12px * var(--sy)), 12px);
}

.choiceCard {
  height: clamp(50px, calc(68px * var(--sy)), 68px);
  border-radius: clamp(12px, calc(16px * var(--sy)), 16px);
  padding: 0 clamp(14px, calc(20px * var(--sx)), 20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  font-weight: 700;
  background: var(--white);
  color: #374151;
  border: 2px solid var(--blue-10);
  text-align: left;
}

.choiceCardSelected {
  background: var(--blue-50);
  border-color: var(--blue-75);
  color: var(--blue-100);
}

.statusWrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--blue-75);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.statusText {
  color: var(--ink);
  font-weight: 800;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/QuizPlay.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/QuizPlay.jsx src/pages/QuizPlay.module.css src/pages/QuizPlay.test.jsx
git commit -m "feat: rebuild quiz play steps with select-then-confirm and Figma-accurate progress"
```

---

### Task 5: `QuizResult` — 히어로 크롭/페이드, 배지, 설명 박스, 다시 하기 색상

**Files:**
- Modify: `src/pages/QuizResult.jsx`
- Modify: `src/pages/QuizResult.module.css`
- Test: `src/pages/QuizResult.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizResult.test.jsx`의 `it('결과 그룹명과 태그라인을 렌더링한다', ...)` 테스트를 다음으로 교체(대괄호 제거):

```jsx
  it('결과 그룹명과 태그라인을 렌더링한다', async () => {
    renderResult()
    await waitFor(() => expect(screen.getByText('Green Group')).toBeInTheDocument())
    expect(screen.getByText('오늘을 가꾸며 안정을 추구하는 그룹')).toBeInTheDocument()
  })
```

같은 파일 마지막 `it(...)` 다음에 추가:

```jsx
  it('다시 하기 버튼은 그룹 색상과 무관하게 항상 파란색이다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    const retryBtn = screen.getByText('다시 하기')
    expect(retryBtn).not.toHaveAttribute('style')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: FAIL — 대괄호가 없는 텍스트를 찾지 못하고, `다시 하기` 버튼에 여전히 `style` 속성이 있음.

- [ ] **Step 3: `QuizResult.jsx` 전체 교체**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  RESULT_GROUPS,
  AXIS_LABELS,
  GROUP_DETAIL_URLS,
  NAVER_REVIEW_URL,
  ECONOMIC_TYPES_URL,
} from '../constants/quizData'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizResult.module.css'

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export default function QuizResult() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    fetch(`/api/quiz/results/${resultId}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then(setResult)
      .catch(() => setError(true))
  }, [resultId])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [notice])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    setNotice('링크가 복사됐어요')
  }, [])

  const handleKakaoShare = useCallback((group, resultGroupName) => {
    const kakao = window.Kakao
    if (!KAKAO_JS_KEY || !kakao) {
      setNotice('카카오톡 공유는 준비 중이에요')
      return
    }
    if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY)
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${resultGroupName} - 우리 아이 경제 잠재력 테스트`,
        description: group.tagline,
        imageUrl: `${window.location.origin}${group.illustration}`,
        link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
      },
    })
  }, [])

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <p className={styles.errorText}>결과를 불러오지 못했어요.</p>
          <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>다시 하기</button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const group = RESULT_GROUPS[result.result_group]

  const isTodayTomorrowLeftActive = result.axis_today_tomorrow === AXIS_LABELS.axisTodayTomorrow.leftValue
  const isSafetyAdventureLeftActive = result.axis_safety_adventure === AXIS_LABELS.axisSafetyAdventure.leftValue
  const navBtnStyle = { background: group.color, borderColor: group.color }
  const tintStyle = {
    backgroundColor: `color-mix(in srgb, ${group.color} 12%, white)`,
    borderColor: `color-mix(in srgb, ${group.color} 35%, white)`,
  }
  const pillStyle = { backgroundColor: `color-mix(in srgb, ${group.color} 14%, white)`, color: group.color }
  const iconBtnStyle = { background: group.color, borderColor: group.color, color: 'var(--white)' }

  return (
    <div className={styles.page}>
      <div className={styles.hero} style={{ backgroundColor: group.bgColor || group.color }}>
        {group.illustration && (
          <img className={styles.illustration} src={group.illustration} alt={result.result_group} />
        )}
        <div className={styles.heroFade} />
      </div>

      <div className={styles.card}>
        <span className={styles.eyebrow} style={pillStyle}>우리 아이의 경제적 잠재력은</span>
        <h1 className={styles.groupName} style={{ color: group.color }}>{result.result_group}</h1>
        <p className={styles.tagline}>{group.tagline}</p>

        <div className={styles.descriptionBox} style={tintStyle}>
          <svg className={styles.checkIcon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={group.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 12.5l3 3 7-7" />
          </svg>
          <p className={styles.description}>{group.description}</p>
        </div>

        {group.animals.length > 0 && (
          <p className={styles.animals}>{group.animals.join(' · ')}</p>
        )}

        <div className={styles.axisRow}>
          <span className={isTodayTomorrowLeftActive ? styles.axisActive : ''} style={isTodayTomorrowLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisTodayTomorrow.left}
          </span>
          <span className={!isTodayTomorrowLeftActive ? styles.axisActive : ''} style={!isTodayTomorrowLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisTodayTomorrow.right}
          </span>
        </div>
        <div className={styles.axisRow}>
          <span className={isSafetyAdventureLeftActive ? styles.axisActive : ''} style={isSafetyAdventureLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisSafetyAdventure.left}
          </span>
          <span className={!isSafetyAdventureLeftActive ? styles.axisActive : ''} style={!isSafetyAdventureLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisSafetyAdventure.right}
          </span>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>더 알아보기</p>
          <a className={styles.navBtn} style={navBtnStyle} href={GROUP_DETAIL_URLS[result.result_group]} target="_blank" rel="noopener noreferrer">
            우리 아이 경제 그룹 자세히 보기
          </a>
          <a className={styles.navBtn} style={navBtnStyle} href={ECONOMIC_TYPES_URL} target="_blank" rel="noopener noreferrer">
            다양한 경제 유형 알아보기
          </a>
          <a className={styles.navBtn} style={navBtnStyle} href={NAVER_REVIEW_URL} target="_blank" rel="noopener noreferrer">
            네이버 리뷰 작성하기
          </a>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>공유하기</p>
          <div className={styles.shareRow}>
            <button
              className={`${styles.iconBtn} ${styles.kakaoIconBtn}`}
              onClick={() => handleKakaoShare(group, result.result_group)}
              aria-label="카카오톡 공유하기"
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.79 1.83 5.24 4.6 6.66-.2.75-.73 2.72-.84 3.15-.13.53.2.52.42.38.17-.11 2.7-1.83 3.8-2.58.65.09 1.32.14 2.02.14 5.52 0 10-3.58 10-8s-4.48-8-10-8Z" />
              </svg>
            </button>
            <button className={styles.iconBtn} style={iconBtnStyle} onClick={handleCopyLink} aria-label="링크 공유하기">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="12" height="12" rx="2.5" />
                <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <a className={styles.iconBtn} style={iconBtnStyle} href={group.illustration} download={group.illustration.split('/').pop()} aria-label="사진 공유하기">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M4 19h16" />
              </svg>
            </a>
          </div>
          {notice && <p className={styles.notice} style={{ color: group.color }}>{notice}</p>}
        </div>

        <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `QuizResult.module.css` 전체 교체**

```css
.page {
  --sx: calc(100cqw / 834px);
  --sy: calc(100cqh / 1194px);
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--white);
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.page::-webkit-scrollbar {
  display: none;
}

.errorWrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  padding: var(--space-2xl);
}

.errorText {
  color: var(--ink-2);
  font-weight: 700;
}

.hero {
  position: relative;
  width: 100%;
  height: clamp(200px, calc(360px * var(--sy)), 360px);
  overflow: hidden;
  flex-shrink: 0;
}

.illustration {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 116%;
  object-fit: cover;
  object-position: top;
}

.heroFade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(50px, calc(96px * var(--sy)), 96px);
  background: linear-gradient(0deg, var(--white) 0%, rgba(255, 255, 255, 0) 100%);
}

.card {
  position: relative;
  margin-top: clamp(-32px, calc(-50px * var(--sy)), -50px);
  background: var(--white);
  border-radius: clamp(20px, calc(32px * var(--sy)), 32px) clamp(20px, calc(32px * var(--sy)), 32px) 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  padding: clamp(20px, calc(28px * var(--sy)), 28px) clamp(16px, calc(20px * var(--sx)), 20px) clamp(32px, calc(48px * var(--sy)), 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(16px, calc(24px * var(--sy)), 24px);
  text-align: center;
}

.eyebrow {
  display: inline-flex;
  padding: clamp(3px, calc(4px * var(--sy)), 4px) clamp(12px, calc(16px * var(--sx)), 16px);
  border-radius: 999px;
  font-size: clamp(12px, calc(14px * min(var(--sx), var(--sy))), 14px);
  font-weight: 700;
}

.groupName {
  font-size: clamp(24px, calc(36px * min(var(--sx), var(--sy))), 36px);
  font-weight: 900;
}

.tagline {
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  font-weight: 400;
  color: var(--ink-2);
}

/* .animals/.axisRow/.axisActive는 Task 6에서 대표 동물 아바타 행 +
   핵심 가치 2x2 그리드로 교체되고 삭제된다. 그 전까지 기존 마크업이
   깨지지 않도록 임시로 유지한다. */
.animals {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.axisRow {
  display: flex;
  gap: var(--space-lg);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}

.axisActive {
  font-weight: 900;
  text-decoration: underline;
}

.descriptionBox {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, calc(12px * var(--sx)), 12px);
  border: 2px solid;
  border-radius: clamp(12px, calc(16px * var(--sy)), 16px);
  padding: clamp(12px, calc(16px * var(--sy)), 16px) clamp(14px, calc(20px * var(--sx)), 20px);
}

.checkIcon {
  flex-shrink: 0;
}

.description {
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  font-weight: 600;
  color: #374151;
  text-align: left;
}

.section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, calc(12px * var(--sy)), 12px);
}

.sectionLabel {
  font-size: clamp(10px, calc(12px * min(var(--sx), var(--sy))), 12px);
  font-weight: 900;
  color: var(--ink-2);
  letter-spacing: calc(1.2px * var(--sx));
  text-transform: uppercase;
  text-align: left;
}

.navBtn {
  height: clamp(46px, calc(56px * var(--sy)), 56px);
  border-radius: clamp(12px, calc(16px * var(--sy)), 16px);
  font-size: clamp(16px, calc(20px * min(var(--sx), var(--sy))), 20px);
  font-weight: 700;
  color: var(--white);
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.shareRow {
  display: flex;
  justify-content: center;
  gap: clamp(16px, calc(24px * var(--sx)), 24px);
}

.iconBtn {
  width: clamp(50px, calc(68px * min(var(--sx), var(--sy))), 68px);
  height: clamp(50px, calc(68px * min(var(--sx), var(--sy))), 68px);
  border-radius: var(--r-pill);
  background: var(--white);
  color: var(--blue-100);
  border: 2px solid var(--blue-75);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.kakaoIconBtn {
  background: #FEE500;
  color: #191919;
  border-color: #FEE500;
}

.notice {
  font-size: clamp(11px, calc(13px * min(var(--sx), var(--sy))), 13px);
  font-weight: 700;
  text-align: center;
}

.retryBtn {
  width: 100%;
  height: clamp(46px, calc(56px * var(--sy)), 56px);
  border-radius: clamp(12px, calc(16px * var(--sy)), 16px);
  font-size: clamp(16px, calc(20px * min(var(--sx), var(--sy))), 20px);
  font-weight: 700;
  color: var(--white);
  background: var(--blue-100);
  border: none;
}
```

이 스텝에서는 아직 `.animalRow`/`.animalItem`/`.animalAvatar`/`.animalName`/`.valueGrid`/`.valueChip` 클래스를 추가하지 않는다(Task 6에서 추가) — JSX가 참조하는 클래스가 CSS 모듈에 없어도 빌드는 깨지지 않고 해당 요소에 스타일이 안 붙을 뿐이므로, 이 스텝의 테스트는 마크업/텍스트만 검증한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/QuizResult.jsx src/pages/QuizResult.module.css src/pages/QuizResult.test.jsx
git commit -m "feat: rebuild quiz result hero, badge and description box per Figma"
```

---

### Task 6: `QuizResult` — 대표 동물 아바타 + 핵심 가치 2×2 그리드

**Files:**
- Modify: `src/pages/QuizResult.jsx`
- Modify: `src/pages/QuizResult.module.css`
- Test: `src/pages/QuizResult.test.jsx`

Task 5는 동물 목록을 여전히 `group.animals.join(' · ')` 평문으로, 축 정보를 `.axisRow` 밑줄 텍스트로 렌더링한다(원래 코드 그대로 유지). 이 태스크에서 그 두 블록을 원형 아바타 행 + "핵심 가치" 2×2 그리드로 교체한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizResult.test.jsx` 상단 import를 다음으로 교체:

```jsx
import { GROUP_DETAIL_URLS, ECONOMIC_TYPES_URL, NAVER_REVIEW_URL, RESULT_GROUPS, ANIMAL_EMOJIS, AXIS_LABELS } from '../constants/quizData'
```

마지막 `it(...)` 다음에 추가:

```jsx
  it('"대표 동물" 레이블과 각 동물의 이모지·이름이 개별 항목으로 표시된다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    expect(screen.getByText('대표 동물')).toBeInTheDocument()
    RESULT_GROUPS['Green Group'].animals.forEach(animal => {
      expect(screen.getByText(animal)).toBeInTheDocument()
    })
    expect(screen.getByText(ANIMAL_EMOJIS['판다'])).toBeInTheDocument()
  })

  it('"핵심 가치" 레이블과 함께 실제 결과와 일치하는 축이 그룹 색상으로 강조된다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    expect(screen.getByText('핵심 가치')).toBeInTheDocument()
    // fixture: axis_today_tomorrow: 'today' → leftValue('tomorrow')가 아니므로 오른쪽('오늘 가꾸기')이 활성
    const activeChip = screen.getByText(AXIS_LABELS.axisTodayTomorrow.right)
    const inactiveChip = screen.getByText(AXIS_LABELS.axisTodayTomorrow.left)
    expect(activeChip).toHaveStyle({ color: RESULT_GROUPS['Green Group'].color })
    expect(inactiveChip).not.toHaveStyle({ color: RESULT_GROUPS['Green Group'].color })
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: FAIL — `대표 동물`/`핵심 가치` 레이블이 아직 없고, 동물 이름은 `"판다 · 캥거루 · 고양이 · 펭귄"` 한 덩어리 텍스트라 `getByText('판다')`가 정확히 일치하는 노드를 찾지 못해 실패.

- [ ] **Step 3: `QuizResult.jsx`에서 동물 목록 + 축 정보 블록을 아바타 행 + 그리드로 교체**

`src/pages/QuizResult.jsx`에서 `ANIMAL_EMOJIS`를 import에 추가:

```jsx
import {
  RESULT_GROUPS,
  ANIMAL_EMOJIS,
  AXIS_LABELS,
  GROUP_DETAIL_URLS,
  NAVER_REVIEW_URL,
  ECONOMIC_TYPES_URL,
} from '../constants/quizData'
```

`iconBtnStyle` 선언 바로 다음에 `activeValueStyle`을 추가:

```jsx
  const iconBtnStyle = { background: group.color, borderColor: group.color, color: 'var(--white)' }
  const activeValueStyle = { ...tintStyle, color: group.color }
```

다음 블록(Task 5에서 그대로 남겨둔 동물 평문 + 축 2행):

```jsx
        {group.animals.length > 0 && (
          <p className={styles.animals}>{group.animals.join(' · ')}</p>
        )}

        <div className={styles.axisRow}>
          <span className={isTodayTomorrowLeftActive ? styles.axisActive : ''} style={isTodayTomorrowLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisTodayTomorrow.left}
          </span>
          <span className={!isTodayTomorrowLeftActive ? styles.axisActive : ''} style={!isTodayTomorrowLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisTodayTomorrow.right}
          </span>
        </div>
        <div className={styles.axisRow}>
          <span className={isSafetyAdventureLeftActive ? styles.axisActive : ''} style={isSafetyAdventureLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisSafetyAdventure.left}
          </span>
          <span className={!isSafetyAdventureLeftActive ? styles.axisActive : ''} style={!isSafetyAdventureLeftActive ? { color: group.color } : undefined}>
            {AXIS_LABELS.axisSafetyAdventure.right}
          </span>
        </div>
```

를 다음으로 교체:

```jsx
        {group.animals.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>대표 동물</p>
            <div className={styles.animalRow}>
              {group.animals.map(animal => (
                <div key={animal} className={styles.animalItem}>
                  <span className={styles.animalAvatar} style={tintStyle}>{ANIMAL_EMOJIS[animal] ?? '🐾'}</span>
                  <span className={styles.animalName}>{animal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionLabel}>핵심 가치</p>
          <div className={styles.valueGrid}>
            <span className={styles.valueChip} style={isTodayTomorrowLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisTodayTomorrow.left}
            </span>
            <span className={styles.valueChip} style={!isTodayTomorrowLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisTodayTomorrow.right}
            </span>
            <span className={styles.valueChip} style={isSafetyAdventureLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisSafetyAdventure.left}
            </span>
            <span className={styles.valueChip} style={!isSafetyAdventureLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisSafetyAdventure.right}
            </span>
          </div>
        </div>
```

- [ ] **Step 4: `QuizResult.module.css`에서 옛 클래스를 그리드/아바타 스타일로 교체**

`src/pages/QuizResult.module.css`의 `.animals`/`.axisRow`/`.axisActive` 블록(및 그 위 주석)을 통째로 삭제:

```css
/* .animals/.axisRow/.axisActive는 Task 6에서 대표 동물 아바타 행 +
   핵심 가치 2x2 그리드로 교체되고 삭제된다. 그 전까지 기존 마크업이
   깨지지 않도록 임시로 유지한다. */
.animals {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.axisRow {
  display: flex;
  gap: var(--space-lg);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}

.axisActive {
  font-weight: 900;
  text-decoration: underline;
}
```

그 자리에 다음을 삽입:

```css
.animalRow {
  display: flex;
  justify-content: center;
  gap: clamp(8px, calc(12px * var(--sx)), 12px);
}

.animalItem {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, calc(8px * var(--sy)), 8px);
}

.animalAvatar {
  width: clamp(60px, calc(100px * min(var(--sx), var(--sy))), 100px);
  height: clamp(60px, calc(100px * min(var(--sx), var(--sy))), 100px);
  border-radius: 999px;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(28px, calc(50px * min(var(--sx), var(--sy))), 50px);
}

.animalName {
  font-size: clamp(10px, calc(12px * min(var(--sx), var(--sy))), 12px);
  color: var(--ink-2);
  font-weight: 500;
}

.valueGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(8px, calc(12px * var(--sx)), 12px);
}

.valueChip {
  height: clamp(46px, calc(60px * var(--sy)), 60px);
  border-radius: clamp(12px, calc(16px * var(--sy)), 16px);
  border: 2px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(13px, calc(16px * min(var(--sx), var(--sy))), 16px);
  font-weight: 700;
  color: var(--ink-2);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/QuizResult.jsx src/pages/QuizResult.module.css src/pages/QuizResult.test.jsx
git commit -m "feat: add animal avatar row and 2x2 core value grid to quiz result"
```

---

### Task 7: 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 모든 테스트 PASS (특히 `QuizIntro.test.jsx`, `QuizPlay.test.jsx`, `QuizResult.test.jsx`, `quizData.test.js`).

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공(새 CSS의 `color-mix()`/`clamp()`/컨테이너 쿼리 문법 오류 여부 포함해 확인).

- [ ] **Step 3: 수동 시각 확인 (브라우저)**

Run: `npm run dev`

브라우저에서 다음을 834×1194 비율(예: iPad 세로 시뮬레이션)과 375px 좁은 폭 두 가지로 확인한다:
- `/quiz` (시작화면): 제목 2줄, 메타 정보 3개, 카드, footer 순서 확인.
- `/quiz/play`: 안내 → 이름 → 성별(선택 후 다음) → 나이 → 질문(선택 후 다음) 흐름과 진행바가 이름 단계부터 나타나는지 확인.
- `/quiz/result/:id` (아무 그룹으로 한 번 완주): 히어로 크롭/페이드, 배지, 설명 박스, 대표 동물, 핵심 가치 그리드, 다시 하기 버튼이 파란색으로 고정되는지 확인.

- [ ] **Step 4: 최종 커밋(있는 경우)**

수동 확인 중 발견한 사소한 수정 사항이 있다면 반영 후:

```bash
git add -A
git commit -m "fix: adjust quiz Figma sync details found during manual QA"
```

발견된 문제가 없다면 이 스텝은 생략한다.
