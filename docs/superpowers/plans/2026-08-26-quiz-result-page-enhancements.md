# 경제적 잠재력 테스트 결과 페이지 미구현 사항 구현 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `QuizResult.jsx`에 그룹 일러스트, 이동 버튼 3종, 공유 버튼 3종을 추가하고 `QuizPlay.jsx`에 진행바를 추가한다.

**Architecture:** 순수 프론트엔드 변경. `QuizResult.jsx`는 상단 히어로(그룹색+일러스트)와 하단 바텀시트 카드(기존 정보+신규 버튼)로 재구성한다. `QuizPlay.jsx`는 기존 `currentStepNumber`/`TOTAL_STEPS` 계산을 재사용해 진행바 폭을 계산한다. 링크/일러스트 경로는 `quizData.js`에 상수로 추가한다.

**Tech Stack:** React (Vite), CSS Modules, Vitest + Testing Library. 백엔드/DB 변경 없음.

**참고 스펙:** `docs/superpowers/specs/2026-08-26-quiz-result-page-enhancements-design.md`

---

### Task 1: `quizData.js`에 링크/일러스트 상수 추가

**Files:**
- Modify: `src/constants/quizData.js`
- Test: `src/constants/quizData.test.js` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/constants/quizData.test.js` 새로 생성:

```js
import { describe, it, expect } from 'vitest'
import { RESULT_GROUPS, GROUP_DETAIL_URLS } from './quizData'

describe('quizData', () => {
  it('모든 결과 그룹에 대해 일러스트 경로와 상세보기 링크가 존재한다', () => {
    Object.keys(RESULT_GROUPS).forEach(groupName => {
      expect(RESULT_GROUPS[groupName].illustration).toMatch(/^\/groups\/.+\.png$/)
      expect(GROUP_DETAIL_URLS[groupName]).toMatch(/^https:\/\//)
    })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/constants/quizData.test.js`
Expected: FAIL — `RESULT_GROUPS[groupName].illustration` is `undefined`, `GROUP_DETAIL_URLS` is not exported.

- [ ] **Step 3: `quizData.js`에 상수 추가**

`src/constants/quizData.js`의 `AXIS_LABELS` 정의 바로 다음(73번째 줄, `export const RESULT_GROUPS = {` 앞)에 삽입:

```js
export const NAVER_REVIEW_URL = 'https://m.place.naver.com/my/checkin'
export const ECONOMIC_TYPES_URL = 'https://m.blog.naver.com/kodkod79/224205817036'

export const GROUP_DETAIL_URLS = {
  'Orange Group': 'https://blog.naver.com/kodkod79/224229258314',
  'Blue Group': 'https://blog.naver.com/kodkod79/224229266592',
  'Green Group': 'https://blog.naver.com/kodkod79/224229264370',
  'Red Group': 'https://blog.naver.com/kodkod79/224229254511',
}
```

기존 `RESULT_GROUPS` 각 항목에 `illustration` 필드를 추가(파일 전체를 아래 내용으로 교체):

```js
export const RESULT_GROUPS = {
  'Green Group': {
    color: '#4CAF7D',
    tagline: '오늘을 가꾸며 안정을 추구하는 그룹',
    description: '오늘의 일상을 소중히 가꾸고 편안하게 지켜가는 힘이 보여요',
    animals: ['판다', '캥거루', '고양이', '펭귄'],
    illustration: '/groups/green.png',
  },
  'Red Group': {
    color: '#F26D6D',
    tagline: '지금 이 순간, 도전을 즐기는 그룹',
    description: '지금 이 순간을 즐기며 용감하게 움직이는 힘이 보여요',
    animals: ['강아지', '여우', '원숭이', '호랑이'],
    illustration: '/groups/red.png',
  },
  'Orange Group': {
    color: '#F2A65A',
    tagline: '내일을 준비하며 안전을 지키는 그룹',
    description: '차분하게 준비하고 안정적으로 선택하는 힘이 보여요',
    animals: ['개미', '부엉이', '다람쥐', '수달'],
    illustration: '/groups/orange.png',
  },
  'Blue Group': {
    color: '#5B8DEF',
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
git commit -m "feat: add quiz group illustration and external link constants"
```

---

### Task 2: `QuizPlay.jsx` 진행바 추가

**Files:**
- Modify: `src/pages/QuizPlay.jsx:73-79`
- Modify: `src/pages/QuizPlay.module.css`
- Test: `src/pages/QuizPlay.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizPlay.test.jsx`의 `describe('QuizPlay', ...)` 블록 안, 마지막 `it(...)` 다음에 추가:

```jsx
  it('진행바가 현재 단계에 맞는 너비로 표시된다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    const fill = screen.getByTestId('quiz-progress-fill')
    expect(parseFloat(fill.style.width)).toBeCloseTo((1 / 9) * 100, 5)

    fireEvent.click(screen.getByText('다음 문제'))
    expect(parseFloat(fill.style.width)).toBeCloseTo((2 / 9) * 100, 5)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/QuizPlay.test.jsx`
Expected: FAIL — `Unable to find an element by: [data-testid="quiz-progress-fill"]`

- [ ] **Step 3: `QuizPlay.jsx` 헤더에 진행바 추가**

`src/pages/QuizPlay.jsx:73-79`의 기존 블록:

```jsx
  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>우리 아이 경제 잠재력 테스트</h1>
        <p className={styles.subtitle}>{step === STEP_ERROR ? '문제가 발생했어요' : `${currentStepNumber}/${TOTAL_STEPS}`}</p>
      </div>
```

를 다음으로 교체:

```jsx
  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>우리 아이 경제 잠재력 테스트</h1>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            data-testid="quiz-progress-fill"
            style={{ width: `${(currentStepNumber / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <p className={styles.subtitle}>{step === STEP_ERROR ? '문제가 발생했어요' : `${currentStepNumber}/${TOTAL_STEPS}`}</p>
      </div>
```

- [ ] **Step 4: `QuizPlay.module.css`에 진행바 스타일 추가**

`src/pages/QuizPlay.module.css`의 `.subtitle` 규칙(26~30번째 줄) 다음에 추가:

```css
.progressTrack {
  width: 100%;
  height: 8px;
  background: var(--blue-10);
  border-radius: 999px;
  overflow: hidden;
  margin: 12px 0 8px;
}

.progressFill {
  height: 100%;
  background: var(--blue-100);
  border-radius: 999px;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/QuizPlay.test.jsx`
Expected: PASS (기존 3개 + 신규 1개 = 4개 테스트 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/QuizPlay.jsx src/pages/QuizPlay.module.css src/pages/QuizPlay.test.jsx
git commit -m "feat: add progress bar to quiz play screen"
```

---

### Task 3: Kakao SDK 스크립트 및 환경변수 자리표시자

**Files:**
- Modify: `index.html`
- Modify: `.env` (git에 커밋되지 않음 — `.gitignore`에 포함됨)

- [ ] **Step 1: `index.html`에 Kakao SDK 스크립트 추가**

`index.html`의 `<head>` 블록:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Money Village</title>
```

을 다음으로 교체:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Money Village</title>
    <script src="https://developers.kakao.com/sdk/js/kakao.js"></script>
```

- [ ] **Step 2: `.env`에 Kakao 키 자리표시자 추가**

`.env` 파일에 한 줄 추가(값은 비워둠, 나중에 실제 키 전달받으면 채움):

```
VITE_KAKAO_JS_KEY=
```

- [ ] **Step 3: 스크립트 태그가 로드되는지 확인**

Run: `npm run dev` (백그라운드 실행 후) 브라우저에서 `http://localhost:5173` 접속, 개발자 도구 콘솔에서 `window.Kakao` 가 `undefined`가 아닌 객체로 존재하는지 확인. 확인 후 dev 서버 종료.

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: load Kakao JS SDK for quiz result sharing"
```

`.env`는 gitignore 대상이므로 커밋하지 않는다.

---

### Task 4: `QuizResult.jsx` 레이아웃 재구성 + 이동/공유 버튼

**Files:**
- Modify: `src/pages/QuizResult.jsx`
- Modify: `src/pages/QuizResult.module.css`
- Modify: `src/pages/QuizResult.test.jsx`

- [ ] **Step 1: 기존 테스트를 새 버튼 문구/구조에 맞게 재작성 (실패 상태로)**

`src/pages/QuizResult.test.jsx` 전체를 아래 내용으로 교체:

```jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GROUP_DETAIL_URLS, ECONOMIC_TYPES_URL, NAVER_REVIEW_URL, RESULT_GROUPS } from '../constants/quizData'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizResult from './QuizResult'

function renderResult(id = 'result-1') {
  return render(
    <MemoryRouter initialEntries={[`/quiz/result/${id}`]}>
      <Routes>
        <Route path="/quiz/result/:resultId" element={<QuizResult />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('QuizResult', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'result-1', child_name: '철수', result_group: 'Green Group',
        axis_today_tomorrow: 'today', axis_safety_adventure: 'safety',
      }),
    })
    global.navigator.clipboard = { writeText: vi.fn() }
    delete window.Kakao
  })

  it('결과 그룹명과 태그라인을 렌더링한다', async () => {
    renderResult()
    await waitFor(() => expect(screen.getByText('Green Group')).toBeInTheDocument())
    expect(screen.getByText('[오늘을 가꾸며 안정을 추구하는 그룹]')).toBeInTheDocument()
  })

  it('링크 공유하기를 누르면 현재 URL을 클립보드에 복사하고 안내 문구를 보여준다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('링크 공유하기'))
    expect(global.navigator.clipboard.writeText).toHaveBeenCalled()
    expect(screen.getByText('링크가 복사됐어요')).toBeInTheDocument()
  })

  it('다시 하기를 누르면 /quiz로 이동한다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('다시 하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz')
  })

  it('이동 버튼 3개가 올바른 링크로 새 탭에 열린다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))

    const detailLink = screen.getByText('우리 아이 경제 그룹 자세히 보기')
    expect(detailLink).toHaveAttribute('href', GROUP_DETAIL_URLS['Green Group'])
    expect(detailLink).toHaveAttribute('target', '_blank')

    const typesLink = screen.getByText('다양한 경제 유형 알아보기')
    expect(typesLink).toHaveAttribute('href', ECONOMIC_TYPES_URL)
    expect(typesLink).toHaveAttribute('target', '_blank')

    const reviewLink = screen.getByText('네이버 리뷰 작성하기')
    expect(reviewLink).toHaveAttribute('href', NAVER_REVIEW_URL)
    expect(reviewLink).toHaveAttribute('target', '_blank')
  })

  it('사진 공유하기는 그룹 일러스트를 다운로드하는 링크다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    const photoLink = screen.getByText('사진 공유하기')
    expect(photoLink).toHaveAttribute('href', RESULT_GROUPS['Green Group'].illustration)
    expect(photoLink).toHaveAttribute('download')
  })

  it('카카오 키가 없으면 카카오톡 공유하기 클릭 시 준비 중 안내를 보여준다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('카카오톡 공유하기'))
    expect(screen.getByText('카카오톡 공유는 준비 중이에요')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: FAIL — "링크 공유하기" 텍스트를 찾을 수 없음(기존 컴포넌트는 "결과 공유하기"), 이동/사진/카카오 버튼도 존재하지 않음.

- [ ] **Step 3: `QuizResult.jsx` 전체 재작성**

`src/pages/QuizResult.jsx` 전체를 아래 내용으로 교체:

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
import styles from './QuizResult.module.css'

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export default function QuizResult() {
  const { resultId } = useParams()
  const navigate = useNavigate()
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
        <p className={styles.eyebrow}>결과를 불러오지 못했어요.</p>
        <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>다시 하기</button>
      </div>
    )
  }

  if (!result) return null

  const group = RESULT_GROUPS[result.result_group]

  return (
    <div className={styles.page}>
      <div className={styles.hero} style={{ background: group.color }}>
        {group.illustration && (
          <img className={styles.illustration} src={group.illustration} alt={result.result_group} />
        )}
      </div>

      <div className={styles.card}>
        <p className={styles.eyebrow}>우리 아이의 경제적 잠재력은</p>
        <h1 className={styles.groupName}>{result.result_group}</h1>
        <p className={styles.tagline}>[{group.tagline}]</p>
        <p className={styles.description}>✅ {group.description}</p>

        {group.animals.length > 0 && (
          <p className={styles.animals}>{group.animals.join(' · ')}</p>
        )}

        <div className={styles.axisRow}>
          <span className={result.axis_today_tomorrow === AXIS_LABELS.axisTodayTomorrow.leftValue ? styles.axisActive : ''}>
            {AXIS_LABELS.axisTodayTomorrow.left}
          </span>
          <span className={result.axis_today_tomorrow === AXIS_LABELS.axisTodayTomorrow.rightValue ? styles.axisActive : ''}>
            {AXIS_LABELS.axisTodayTomorrow.right}
          </span>
        </div>
        <div className={styles.axisRow}>
          <span className={result.axis_safety_adventure === AXIS_LABELS.axisSafetyAdventure.leftValue ? styles.axisActive : ''}>
            {AXIS_LABELS.axisSafetyAdventure.left}
          </span>
          <span className={result.axis_safety_adventure === AXIS_LABELS.axisSafetyAdventure.rightValue ? styles.axisActive : ''}>
            {AXIS_LABELS.axisSafetyAdventure.right}
          </span>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>더 알아보기</p>
          <a className={styles.outlineBtn} href={GROUP_DETAIL_URLS[result.result_group]} target="_blank" rel="noopener noreferrer">
            우리 아이 경제 그룹 자세히 보기
          </a>
          <a className={styles.outlineBtn} href={ECONOMIC_TYPES_URL} target="_blank" rel="noopener noreferrer">
            다양한 경제 유형 알아보기
          </a>
          <a className={styles.outlineBtn} href={NAVER_REVIEW_URL} target="_blank" rel="noopener noreferrer">
            네이버 리뷰 작성하기
          </a>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>공유하기</p>
          <button className={styles.kakaoBtn} onClick={() => handleKakaoShare(group, result.result_group)}>
            카카오톡 공유하기
          </button>
          <button className={styles.shareBtn} onClick={handleCopyLink}>
            링크 공유하기
          </button>
          <a className={styles.outlineBtn} href={group.illustration} download={group.illustration.split('/').pop()}>
            사진 공유하기
          </a>
          {notice && <p className={styles.notice}>{notice}</p>}
        </div>

        <button className={styles.retryLink} onClick={() => navigate('/quiz')}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `QuizResult.module.css` 전체 재작성**

`src/pages/QuizResult.module.css` 전체를 아래 내용으로 교체:

```css
.page {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
  overflow-y: auto;
}

.hero {
  flex: 0 0 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.illustration {
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.card {
  flex: 1;
  background: var(--white);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  margin-top: -24px;
  padding: 32px clamp(24px, 9vw, 40px) 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.eyebrow {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
}

.groupName {
  font-size: 28px;
  font-weight: 900;
  color: var(--ink);
}

.tagline {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}

.description {
  font-size: 15px;
  font-weight: 600;
  max-width: 360px;
  color: var(--ink-2);
}

.animals {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  margin-top: 4px;
}

.axisRow {
  display: flex;
  gap: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}

.axisActive {
  color: var(--blue-100);
  font-weight: 900;
  text-decoration: underline;
}

.section {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.sectionLabel {
  font-size: 12px;
  font-weight: 900;
  color: var(--ink-2);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  text-align: left;
}

.outlineBtn {
  height: 56px;
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 700;
  background: var(--white);
  color: var(--blue-100);
  border: 2px solid var(--blue-75);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.kakaoBtn {
  height: 56px;
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 700;
  background: #FEE500;
  color: #191919;
}

.shareBtn {
  height: 56px;
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 700;
  background: var(--white);
  color: var(--ink);
  border: 2px solid var(--blue-10);
}

.notice {
  font-size: 13px;
  font-weight: 700;
  color: var(--blue-100);
}

.retryLink {
  margin-top: 20px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  text-decoration: underline;
  background: none;
  border: none;
}

.retryBtn {
  height: 56px;
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 700;
  background: transparent;
  color: var(--ink);
  border: 2px solid var(--ink);
}
```

(`.retryBtn`은 에러 상태 화면에서 계속 사용되므로 유지한다.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: PASS (6개 테스트 모두 통과)

- [ ] **Step 6: 전체 테스트 스위트 회귀 확인**

Run: `npx vitest run`
Expected: PASS (모든 기존 테스트 포함, 회귀 없음)

- [ ] **Step 7: 커밋**

```bash
git add src/pages/QuizResult.jsx src/pages/QuizResult.module.css src/pages/QuizResult.test.jsx
git commit -m "feat: redesign quiz result page with illustration, nav links, and share buttons"
```

---

### Task 5: 브라우저 수동 확인

**Files:** 없음 (수동 QA)

- [ ] **Step 1: 개발 서버 실행**

Run: `npm run dev` (백그라운드)

- [ ] **Step 2: 퀴즈 전체 플로우 확인**

브라우저에서 `http://localhost:5173/quiz` 접속 → 안내/이름/나이/6문항 응답 → 결과 페이지 도달까지 진행하며 다음을 확인한다:
- `QuizPlay` 헤더의 파란 진행바가 단계마다 채워지는지 (`1/9` ~ `9/9` 근처까지 폭이 증가).
- 결과 페이지 상단 그룹색 히어로 영역에 해당 그룹 일러스트(`public/groups/*.png`)가 보이는지.
- 흰 카드가 히어로 위로 겹치며 올라오는 바텀시트 모양인지.
- "더 알아보기" 3개 버튼 클릭 시 새 탭으로 올바른 URL이 열리는지.
- "카카오톡 공유하기" 클릭 시(키가 아직 없으므로) "카카오톡 공유는 준비 중이에요" 안내가 잠깐 보이는지.
- "링크 공유하기" 클릭 시 "링크가 복사됐어요" 안내가 보이는지(클립보드 권한이 필요할 수 있음).
- "사진 공유하기" 클릭 시 그룹 이미지가 다운로드되는지.
- "다시 하기" 클릭 시 `/quiz`로 이동하는지.

- [ ] **Step 3: 문제 발견 시 수정 후 해당 Task로 돌아가 재검증**

문제가 없으면 dev 서버를 종료한다.

---

## Self-Review 결과

- **스펙 커버리지:** 스펙의 3~7장(레이아웃, 데이터, 버튼 동작, 진행바, 테스트) 모두 Task 1~4에 매핑됨. 8장(범위 제외)은 그대로 반영(Kakao 키 실제 발급 없음, 이미지 합성 없음).
- **플레이스홀더 스캔:** "TBD"/"추후 구현" 등 없음. Kakao 키 미보유 상태는 스펙대로 안내 문구 분기로 명시적으로 처리.
- **타입/네이밍 일관성:** `RESULT_GROUPS[...].illustration`, `GROUP_DETAIL_URLS`, `ECONOMIC_TYPES_URL`, `NAVER_REVIEW_URL` 명칭이 Task 1(정의)과 Task 4(사용) 사이에 동일하게 유지됨. `data-testid="quiz-progress-fill"`도 Task 2의 테스트/구현 간 일치.
