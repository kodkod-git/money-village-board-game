# 우리 아이 경제 잠재력 테스트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스모어(smore.im)의 "우리 아이 경제 잠재력(색깔편)" 퀴즈를 머니빌리지 자체 기능(`/quiz`, `/quiz/play`, `/quiz/result/:resultId`)으로 구현하고, 결과를 기존 `survey.efti_test_responses` 테이블에 저장한다.

**Architecture:** 프론트는 `QuizIntro` → `QuizPlay`(내부 step state로 안내·이름·나이·6문항·분석 연출 처리) → `QuizResult` 3개 페이지. 백엔드는 `server/supabaseSurvey.js`(survey 스키마 클라이언트)와 `server/quiz.js`(저장/조회 로직)를 추가하고 `server/index.js`에 라우트 2개를 등록한다. 채점은 `src/utils/quizScoring.js`의 순수 함수로 처리한다.

**Tech Stack:** React + react-router-dom, Express, Supabase(survey 스키마), Vitest + Testing Library.

**콘텐츠 출처:** 문항·안내 문구·Green Group 결과 카피는 smore.im/quiz/JFWXFqyQVv를 브라우저로 직접 실행해 원문 그대로 전사했다(콘텐츠 저작권은 머니빌리지 소유 — `docs/superpowers/specs/2026-08-24-smore-quiz-design.md` 참고). Red/Orange/Blue Group은 최초 구현 시점에는 브라우저 자동화로 확보하지 못해 인터림 텍스트로 두었으나, 사용자가 `temp/red_group.md`·`temp/orange_group.md`·`temp/blue_group.md`(스모어 결과 화면 원문 붙여넣기)를 전달해 Task 12에서 실제 카피로 교체 완료했다. 대표 동물 일러스트는 사용자가 추후 전달할 예정이므로, 그때까지는 그룹별 색상 배경(`RESULT_GROUPS[...].color`)으로만 표시한다.

---

### Task 1: DB 마이그레이션 (survey 스키마)

**Files:**
- Create: `supabase/migrations/2026-08-24-add-quiz-axis-columns.sql` (이미 생성됨)

- [x] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/2026-08-24-add-quiz-axis-columns.sql`에 다음 내용으로 이미 작성되어 있다:

```sql
ALTER TABLE survey.efti_test_responses
  ADD COLUMN axis_today_tomorrow   text CHECK (axis_today_tomorrow IN ('today', 'tomorrow')),
  ADD COLUMN axis_safety_adventure text CHECK (axis_safety_adventure IN ('safety', 'adventure')),
  ADD COLUMN source text NOT NULL DEFAULT 'app';

UPDATE survey.efti_test_responses
SET source = 'smore_import'
WHERE smore_token IS NOT NULL;

UPDATE survey.efti_test_responses
SET
  axis_today_tomorrow = CASE
    WHEN result_group IN ('Green Group', 'Red Group')   THEN 'today'
    WHEN result_group IN ('Orange Group', 'Blue Group') THEN 'tomorrow'
  END,
  axis_safety_adventure = CASE
    WHEN result_group IN ('Green Group', 'Orange Group') THEN 'safety'
    WHEN result_group IN ('Red Group', 'Blue Group')     THEN 'adventure'
  END
WHERE result_group IS NOT NULL;

ALTER TABLE survey.efti_test_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read efti_test_responses"
  ON survey.efti_test_responses FOR SELECT USING (true);

CREATE POLICY "Service insert efti_test_responses"
  ON survey.efti_test_responses FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Supabase SQL editor에서 실행 (수동, 사용자 작업)**

이 리포에는 자동 마이그레이션 실행기가 없다(`supabase/migrations/`의 기존 파일들도 모두 수동 실행 이력). 실행 전 아래 쿼리로 RLS 정책이 이미 있는지 확인:

```sql
SELECT policyname FROM pg_policies WHERE schemaname = 'survey' AND tablename = 'efti_test_responses';
```

정책이 이미 있다면 마이그레이션 파일의 `CREATE POLICY` 두 문장은 제외하고 나머지만 실행한다.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-08-24-add-quiz-axis-columns.sql
git commit -m "feat: add quiz axis columns migration for survey.efti_test_responses"
```

---

### Task 2: `server/supabaseSurvey.js` — survey 스키마 클라이언트

**Files:**
- Create: `server/supabaseSurvey.js`

- [ ] **Step 1: 파일 작성**

```js
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
}

// boardgame과 같은 Supabase 프로젝트를 survey 스키마로 분리해 사용한다 (server/supabase.js 참고)
export const supabaseSurvey = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'survey' },
})
```

- [ ] **Step 2: Commit**

```bash
git add server/supabaseSurvey.js
git commit -m "feat: add survey schema supabase client"
```

---

### Task 3: `server/quiz.js` — 결과 저장/조회 로직 + 테스트

**Files:**
- Create: `server/quiz.js`
- Test: `server/quiz.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/quiz.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(result) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return builder
}

const mockFrom = vi.fn()

vi.mock('./supabaseSurvey.js', () => ({
  supabaseSurvey: { from: (...args) => mockFrom(...args) },
}))

import { saveQuizResult, getQuizResult } from './quiz.js'

describe('saveQuizResult', () => {
  it('efti_test_responses에 결과를 저장하고 id를 반환한다', async () => {
    const builder = makeQueryBuilder({ data: { id: 'result-1' }, error: null })
    mockFrom.mockReturnValue(builder)

    const id = await saveQuizResult({
      childName: '철수',
      childAge: 7,
      answers: {
        q_pocket_money: '바로 쓰며 기뻐하는 편이에요.',
        q_new_activity: '익숙한 방법이 편한 편이에요.',
        q_want_something: '빨리 갖고 싶어 하는 편이에요.',
        q_hard_task: '잘할 수 있는 방법을 먼저 고르는 편이에요.',
        q_choosing_item: '지금 마음에 드는 것을 고르는 편이에요.',
        q_problem_solving: '실수 없는 방법을 고르는 편이에요.',
      },
      axisTodayTomorrow: 'today',
      axisSafetyAdventure: 'safety',
      resultGroup: 'Green Group',
    })

    expect(id).toBe('result-1')
    expect(mockFrom).toHaveBeenCalledWith('efti_test_responses')
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      child_name: '철수',
      child_age: 7,
      q_pocket_money: '바로 쓰며 기뻐하는 편이에요.',
      axis_today_tomorrow: 'today',
      axis_safety_adventure: 'safety',
      result_group: 'Green Group',
      source: 'app',
    }))
  })

  it('insert 에러가 나면 예외를 던진다', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('insert failed') })
    mockFrom.mockReturnValue(builder)

    await expect(saveQuizResult({
      childName: '철수', childAge: 7, answers: {}, axisTodayTomorrow: 'today',
      axisSafetyAdventure: 'safety', resultGroup: 'Green Group',
    })).rejects.toThrow('insert failed')
  })
})

describe('getQuizResult', () => {
  it('id로 결과를 조회한다', async () => {
    const row = { id: 'result-1', child_name: '철수', result_group: 'Green Group' }
    const builder = makeQueryBuilder({ data: row, error: null })
    mockFrom.mockReturnValue(builder)

    const result = await getQuizResult('result-1')

    expect(result).toEqual(row)
    expect(builder.eq).toHaveBeenCalledWith('id', 'result-1')
  })

  it('조회 에러가 나면 예외를 던진다', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('not found') })
    mockFrom.mockReturnValue(builder)

    await expect(getQuizResult('missing')).rejects.toThrow('not found')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run server/quiz.test.js`
Expected: FAIL — `Cannot find module './quiz.js'`

- [ ] **Step 3: 구현 작성**

`server/quiz.js`:

```js
import { supabaseSurvey } from './supabaseSurvey.js'

export async function saveQuizResult({
  childName, childAge, answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup,
}) {
  const { data, error } = await supabaseSurvey
    .from('efti_test_responses')
    .insert({
      child_name: childName,
      child_age: childAge,
      q_pocket_money: answers.q_pocket_money,
      q_new_activity: answers.q_new_activity,
      q_want_something: answers.q_want_something,
      q_hard_task: answers.q_hard_task,
      q_choosing_item: answers.q_choosing_item,
      q_problem_solving: answers.q_problem_solving,
      axis_today_tomorrow: axisTodayTomorrow,
      axis_safety_adventure: axisSafetyAdventure,
      result_group: resultGroup,
      source: 'app',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function getQuizResult(id) {
  const { data, error } = await supabaseSurvey
    .from('efti_test_responses')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run server/quiz.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/quiz.js server/quiz.test.js
git commit -m "feat: add quiz result save/get logic"
```

---

### Task 4: `server/index.js` — 라우트 등록

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: import 추가**

`server/index.js` 최상단 import 블록(파일 9번째 줄, `db.js` import 다음)에 추가:

```js
import { saveQuizResult, getQuizResult } from './quiz.js'
```

- [ ] **Step 2: 라우트 추가**

`server/index.js`의 `/api/rankings` 라우트(58번째 줄 근처) 바로 다음에 추가:

```js
app.post('/api/quiz/results', async (req, res) => {
  const { childName, childAge, answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup } = req.body ?? {}
  if (!childName?.trim() || !childAge || !answers || !axisTodayTomorrow || !axisSafetyAdventure || !resultGroup) {
    return res.status(400).json({ error: 'childName, childAge, answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup이 필요합니다' })
  }
  try {
    const id = await saveQuizResult({
      childName: childName.trim(), childAge, answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup,
    })
    res.json({ id })
  } catch (err) {
    console.error('quiz save error:', err)
    res.status(500).json({ error: 'Failed to save quiz result' })
  }
})

app.get('/api/quiz/results/:id', async (req, res) => {
  try {
    const result = await getQuizResult(req.params.id)
    res.json(result)
  } catch (err) {
    res.status(404).json({ error: 'Result not found' })
  }
})
```

- [ ] **Step 3: 서버 기동 확인**

Run: `node server/index.js` (환경변수 `.env`에 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 필요)
Expected: `Server running on port 3001` 출력, 에러 없음. `Ctrl+C`로 종료.

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: wire up quiz result routes"
```

---

### Task 5: `src/utils/quizScoring.js` — 채점 로직 + 테스트

**Files:**
- Create: `src/utils/quizScoring.js`
- Test: `src/utils/quizScoring.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/utils/quizScoring.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { calcQuizResult } from './quizScoring'

describe('calcQuizResult', () => {
  it('축 A 3개 모두 today면 today, 축 B 3개 모두 safety면 safety → Green Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'today', q_want_something: 'today', q_choosing_item: 'today',
      q_new_activity: 'safety', q_hard_task: 'safety', q_problem_solving: 'safety',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'today', axisSafetyAdventure: 'safety', resultGroup: 'Green Group' })
  })

  it('축 A 2/3이 today, 축 B 2/3이 adventure → Red Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'today', q_want_something: 'today', q_choosing_item: 'tomorrow',
      q_new_activity: 'adventure', q_hard_task: 'adventure', q_problem_solving: 'safety',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'today', axisSafetyAdventure: 'adventure', resultGroup: 'Red Group' })
  })

  it('축 A 1/3만 today(=2/3 tomorrow), 축 B 1/3만 adventure(=2/3 safety) → Orange Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'today', q_want_something: 'tomorrow', q_choosing_item: 'tomorrow',
      q_new_activity: 'adventure', q_hard_task: 'safety', q_problem_solving: 'safety',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'tomorrow', axisSafetyAdventure: 'safety', resultGroup: 'Orange Group' })
  })

  it('축 A 0/3이 today, 축 B 3/3이 adventure → Blue Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'tomorrow', q_want_something: 'tomorrow', q_choosing_item: 'tomorrow',
      q_new_activity: 'adventure', q_hard_task: 'adventure', q_problem_solving: 'adventure',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'tomorrow', axisSafetyAdventure: 'adventure', resultGroup: 'Blue Group' })
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run src/utils/quizScoring.test.js`
Expected: FAIL — `Failed to resolve import "./quizScoring"`

- [ ] **Step 3: 구현 작성**

`src/utils/quizScoring.js`:

```js
const AXIS_A_KEYS = ['q_pocket_money', 'q_want_something', 'q_choosing_item']
const AXIS_B_KEYS = ['q_new_activity', 'q_hard_task', 'q_problem_solving']

const RESULT_GROUP = {
  today_safety: 'Green Group',
  today_adventure: 'Red Group',
  tomorrow_safety: 'Orange Group',
  tomorrow_adventure: 'Blue Group',
}

export function calcQuizResult(poles) {
  const todayCount = AXIS_A_KEYS.filter(k => poles[k] === 'today').length
  const adventureCount = AXIS_B_KEYS.filter(k => poles[k] === 'adventure').length

  const axisTodayTomorrow = todayCount >= 2 ? 'today' : 'tomorrow'
  const axisSafetyAdventure = adventureCount >= 2 ? 'adventure' : 'safety'
  const resultGroup = RESULT_GROUP[`${axisTodayTomorrow}_${axisSafetyAdventure}`]

  return { axisTodayTomorrow, axisSafetyAdventure, resultGroup }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run src/utils/quizScoring.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/quizScoring.js src/utils/quizScoring.test.js
git commit -m "feat: add quiz scoring logic"
```

---

### Task 6: `src/constants/quizData.js` — 문항·결과 콘텐츠

**Files:**
- Create: `src/constants/quizData.js`

콘텐츠는 smore.im/quiz/JFWXFqyQVv 원문 전사다. Green Group은 브라우저 자동화로 직접 확인, Red/Orange/Blue Group은 사용자가 `temp/red_group.md`·`temp/orange_group.md`·`temp/blue_group.md`로 전달한 원문(모두 실제 결과 화면 텍스트)을 반영했다.

- [ ] **Step 1: 파일 작성**

```js
export const GUIDE_TEXT = '우리 아이와 가까운 모습을 선택해주세요.\n정답은 없습니다.'

export const NAME_LABEL = '우리 아이의 이름을 입력해주세요.'
export const NAME_PLACEHOLDER = '텍스트를 입력해 주세요.'

export const AGE_LABEL = '우리 아이의 나이를 입력해주세요.'
export const AGE_PLACEHOLDER = '숫자를 입력해 주세요.'

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

export const AXIS_LABELS = {
  axisTodayTomorrow: { left: '내일 꿈꾸기', leftValue: 'tomorrow', right: '오늘 가꾸기', rightValue: 'today' },
  axisSafetyAdventure: { left: '안전 지키기', leftValue: 'safety', right: '모험 즐기기', rightValue: 'adventure' },
}

export const RESULT_GROUPS = {
  'Green Group': {
    color: '#4CAF7D',
    tagline: '오늘을 가꾸며 안정을 추구하는 그룹',
    description: '오늘의 일상을 소중히 가꾸고 편안하게 지켜가는 힘이 보여요',
    animals: ['판다', '캥거루', '고양이', '펭귄'],
  },
  'Red Group': {
    color: '#F26D6D',
    tagline: '지금 이 순간, 도전을 즐기는 그룹',
    description: '지금 이 순간을 즐기며 용감하게 움직이는 힘이 보여요',
    animals: ['강아지', '여우', '원숭이', '호랑이'],
  },
  'Orange Group': {
    color: '#F2A65A',
    tagline: '내일을 준비하며 안전을 지키는 그룹',
    description: '차분하게 준비하고 안정적으로 선택하는 힘이 보여요',
    animals: ['개미', '부엉이', '다람쥐', '수달'],
  },
  'Blue Group': {
    color: '#5B8DEF',
    tagline: '미래에 과감히 투자하는 그룹',
    description: '미래를 바라보며 과감하게 도전하는 힘이 보여요',
    animals: ['독수리', '돌고래', '사자', '코끼리'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/quizData.js
git commit -m "feat: add quiz question and result content"
```

---

### Task 7: `src/pages/QuizIntro.jsx`

**Files:**
- Create: `src/pages/QuizIntro.jsx`
- Create: `src/pages/QuizIntro.module.css`
- Test: `src/pages/QuizIntro.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizIntro.test.jsx`:

```js
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizIntro from './QuizIntro'

describe('QuizIntro', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('제목과 시작 버튼을 렌더링한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(screen.getByText('우리 아이 경제 잠재력(색깔편)')).toBeInTheDocument()
    expect(screen.getByText('테스트 시작하기')).toBeInTheDocument()
  })

  it('시작 버튼을 누르면 /quiz/play로 이동한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    fireEvent.click(screen.getByText('테스트 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz/play')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run src/pages/QuizIntro.test.jsx`
Expected: FAIL — `Failed to resolve import "./QuizIntro"`

- [ ] **Step 3: 구현 작성**

`src/pages/QuizIntro.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import styles from './QuizIntro.module.css'

export default function QuizIntro() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>우리 아이 경제 잠재력(색깔편)</h1>
        <p className={styles.subtitle}>재미로보는 우리 아이의 경제 컬러는?</p>
        <button className={styles.startBtn} onClick={() => navigate('/quiz/play')}>
          테스트 시작하기
        </button>
      </div>
    </div>
  )
}
```

`src/pages/QuizIntro.module.css`:

```css
.page {
  min-height: 100%;
  height: 100%;
  background: var(--grad-page);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 clamp(24px, 9vw, 49px);
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
}

.card {
  width: 100%;
  max-width: 420px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 32px;
  font-weight: 900;
  color: var(--white);
}

.subtitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 28px;
}

.startBtn {
  width: 100%;
  height: 64px;
  background: var(--white);
  color: var(--blue-100);
  border-radius: var(--r-sm);
  font-size: 20px;
  font-weight: 800;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run src/pages/QuizIntro.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/QuizIntro.jsx src/pages/QuizIntro.module.css src/pages/QuizIntro.test.jsx
git commit -m "feat: add quiz intro screen"
```

---

### Task 8: `src/pages/QuizPlay.jsx`

**Files:**
- Create: `src/pages/QuizPlay.jsx`
- Create: `src/pages/QuizPlay.module.css`
- Test: `src/pages/QuizPlay.test.jsx`

내부 `step` state로 안내(1) → 이름(2) → 나이(3) → 문항 6개(4~9) → 분석 연출을 진행하고, 마지막에 `POST /api/quiz/results`로 저장한 뒤 `/quiz/result/:id`로 이동한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizPlay.test.jsx`:

```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizPlay from './QuizPlay'

function answerAllQuestions() {
  // 안내 슬라이드
  fireEvent.click(screen.getByText('다음 문제'))
  // 이름
  fireEvent.change(screen.getByPlaceholderText('텍스트를 입력해 주세요.'), { target: { value: '철수' } })
  fireEvent.click(screen.getByText('다음 문제'))
  // 나이
  fireEvent.change(screen.getByPlaceholderText('숫자를 입력해 주세요.'), { target: { value: '7' } })
  fireEvent.click(screen.getByText('다음 문제'))
  // 6문항 모두 첫 번째 선택지(today/safety 쪽)를 고른다 → Green Group
  for (let i = 0; i < 6; i++) {
    const buttons = screen.getAllByRole('button').filter(b => b.dataset.quizOption)
    fireEvent.click(buttons[0])
  }
}

describe('QuizPlay', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'result-1' }) })
  })

  it('안내 슬라이드를 먼저 보여준다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    expect(screen.getByText(/우리 아이와 가까운 모습을 선택해주세요/)).toBeInTheDocument()
  })

  it('이름을 입력하지 않으면 다음으로 넘어가지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.click(screen.getByText('다음 문제'))
    expect(screen.getByPlaceholderText('텍스트를 입력해 주세요.')).toBeInTheDocument()
  })

  it('6문항을 모두 답하면 결과를 저장하고 결과 페이지로 이동한다', async () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    answerAllQuestions()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/quiz/results', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/quiz/result/result-1'))

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.childName).toBe('철수')
    expect(body.childAge).toBe(7)
    expect(body.resultGroup).toBe('Green Group')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run src/pages/QuizPlay.test.jsx`
Expected: FAIL — `Failed to resolve import "./QuizPlay"`

- [ ] **Step 3: 구현 작성**

`src/pages/QuizPlay.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GUIDE_TEXT, NAME_LABEL, NAME_PLACEHOLDER, AGE_LABEL, AGE_PLACEHOLDER, QUESTIONS } from '../constants/quizData'
import { calcQuizResult } from '../utils/quizScoring'
import styles from './QuizPlay.module.css'

const STEP_GUIDE = 'guide'
const STEP_NAME = 'name'
const STEP_AGE = 'age'
const STEP_ANALYZING = 'analyzing'
const STEP_DONE = 'done'
const TOTAL_STEPS = 3 + QUESTIONS.length // 안내 + 이름 + 나이 + 문항 수

export default function QuizPlay() {
  const navigate = useNavigate()
  const [step, setStep] = useState(STEP_GUIDE)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [answers, setAnswers] = useState({})
  const [polarities, setPolarities] = useState({})

  function submitResult(finalPolarities) {
    setStep(STEP_ANALYZING)
    const { axisTodayTomorrow, axisSafetyAdventure, resultGroup } = calcQuizResult(finalPolarities)

    fetch('/api/quiz/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName, childAge: Number(childAge), answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setStep(STEP_DONE)
        setTimeout(() => navigate(`/quiz/result/${data.id}`), 600)
      })
  }

  function handleAnswer(question, option) {
    const nextAnswers = { ...answers, [question.key]: option.text }
    const nextPolarities = { ...polarities, [question.key]: option.polarity }
    setAnswers(nextAnswers)
    setPolarities(nextPolarities)

    if (questionIndex + 1 < QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1)
    } else {
      submitResult(nextPolarities)
    }
  }

  if (step === STEP_ANALYZING) {
    return (
      <div className={styles.page}>
        <div className={styles.spinner} />
        <p className={styles.statusText}>결과 분석중</p>
      </div>
    )
  }

  if (step === STEP_DONE) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>완료</p>
      </div>
    )
  }

  const currentStepNumber = step === STEP_GUIDE ? 1 : step === STEP_NAME ? 2 : step === STEP_AGE ? 3 : 4 + questionIndex

  return (
    <div className={styles.page}>
      <div className={styles.progress}>{currentStepNumber}/{TOTAL_STEPS}</div>

      {step === STEP_GUIDE && (
        <div className={styles.card}>
          <p className={styles.guideText}>{GUIDE_TEXT}</p>
          <button className={styles.nextBtn} onClick={() => setStep(STEP_NAME)}>다음 문제</button>
        </div>
      )}

      {step === STEP_NAME && (
        <div className={styles.card}>
          <p className={styles.label}>{NAME_LABEL}</p>
          <input
            className={styles.input}
            placeholder={NAME_PLACEHOLDER}
            value={childName}
            onChange={e => setChildName(e.target.value)}
          />
          <button className={styles.nextBtn} onClick={() => childName.trim() && setStep(STEP_AGE)} disabled={!childName.trim()}>
            다음 문제
          </button>
        </div>
      )}

      {step === STEP_AGE && (
        <div className={styles.card}>
          <p className={styles.label}>{AGE_LABEL}</p>
          <input
            className={styles.input}
            type="number"
            placeholder={AGE_PLACEHOLDER}
            value={childAge}
            onChange={e => setChildAge(e.target.value)}
          />
          <button
            className={styles.nextBtn}
            onClick={() => childAge && setStep(QUESTIONS[0] ? 'q0' : STEP_ANALYZING)}
            disabled={!childAge}
          >
            다음 문제
          </button>
        </div>
      )}

      {step !== STEP_GUIDE && step !== STEP_NAME && step !== STEP_AGE && (
        <div className={styles.card}>
          <p className={styles.label}>{QUESTIONS[questionIndex].prompt}</p>
          {QUESTIONS[questionIndex].options.map(option => (
            <button
              key={option.text}
              data-quiz-option="true"
              className={styles.optionBtn}
              onClick={() => handleAnswer(QUESTIONS[questionIndex], option)}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

이 초안은 `STEP_AGE`의 다음 버튼에서 `'q0'`라는 존재하지 않는 step으로 전환하는 실수를 담고 있다. 문항 단계는 별도 문자열 없이 "6개 상수 단계 이후"라는 하나의 조건으로만 판별해야 하므로, `STEP_AGE`의 버튼 핸들러를 아래처럼 고쳐서 작성한다(위 코드 대신 이 버전을 사용):

```jsx
          <button
            className={styles.nextBtn}
            onClick={() => childAge && setStep('question')}
            disabled={!childAge}
          >
            다음 문제
          </button>
```

그리고 렌더링 분기도 `step !== STEP_GUIDE && step !== STEP_NAME && step !== STEP_AGE` 대신 `step === 'question'`으로 명시한다:

```jsx
      {step === 'question' && (
        <div className={styles.card}>
          <p className={styles.label}>{QUESTIONS[questionIndex].prompt}</p>
          {QUESTIONS[questionIndex].options.map(option => (
            <button
              key={option.text}
              data-quiz-option="true"
              className={styles.optionBtn}
              onClick={() => handleAnswer(QUESTIONS[questionIndex], option)}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
```

`src/pages/QuizPlay.module.css`:

```css
.page {
  min-height: 100%;
  height: 100%;
  background: var(--grad-page);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 0 clamp(24px, 9vw, 49px);
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
}

.progress {
  position: absolute;
  top: 24px;
  right: 24px;
  color: var(--white);
  font-size: 13px;
  font-weight: 700;
}

.card {
  width: 100%;
  max-width: 420px;
  background: var(--white);
  border-radius: var(--r-lg);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guideText,
.label {
  font-size: 18px;
  font-weight: 800;
  color: var(--ink);
  white-space: pre-line;
  text-align: center;
}

.input {
  height: 56px;
  border-radius: var(--r-sm);
  border: 2px solid rgba(190, 219, 255, 0.5);
  background: rgba(112, 166, 254, 0.15);
  padding: 0 22px;
  font-size: 16px;
  color: var(--ink);
  outline: none;
}

.input::placeholder { color: var(--disabled); }
.input:focus { border-color: var(--blue-75); }

.nextBtn,
.optionBtn {
  height: 56px;
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 700;
}

.nextBtn {
  background: var(--blue-100);
  color: var(--white);
}

.nextBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.optionBtn {
  background: var(--white);
  color: var(--blue-100);
  border: 2px solid var(--blue-75);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--white);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.statusText {
  color: var(--white);
  font-weight: 800;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run src/pages/QuizPlay.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/QuizPlay.jsx src/pages/QuizPlay.module.css src/pages/QuizPlay.test.jsx
git commit -m "feat: add quiz play flow (name, age, 6 questions, save)"
```

---

### Task 9: `src/pages/QuizResult.jsx`

**Files:**
- Create: `src/pages/QuizResult.jsx`
- Create: `src/pages/QuizResult.module.css`
- Test: `src/pages/QuizResult.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/QuizResult.test.jsx`:

```js
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  })

  it('결과 그룹명과 태그라인을 렌더링한다', async () => {
    renderResult()
    await waitFor(() => expect(screen.getByText('Green Group')).toBeInTheDocument())
    expect(screen.getByText('오늘을 가꾸며 안정을 추구하는 그룹')).toBeInTheDocument()
  })

  it('공유하기를 누르면 현재 URL을 클립보드에 복사한다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('결과 공유하기'))
    expect(global.navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('다시 하기를 누르면 /quiz로 이동한다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('다시 하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: FAIL — `Failed to resolve import "./QuizResult"`

- [ ] **Step 3: 구현 작성**

`src/pages/QuizResult.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RESULT_GROUPS, AXIS_LABELS } from '../constants/quizData'
import styles from './QuizResult.module.css'

export default function QuizResult() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch(`/api/quiz/results/${resultId}`)
      .then(r => r.json())
      .then(setResult)
  }, [resultId])

  if (!result) return null

  const group = RESULT_GROUPS[result.result_group]

  return (
    <div className={styles.page} style={{ background: group.color }}>
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

      <div className={styles.actions}>
        <button className={styles.shareBtn} onClick={() => navigator.clipboard.writeText(window.location.href)}>
          결과 공유하기
        </button>
        <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
```

`src/pages/QuizResult.module.css`:

```css
.page {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px clamp(24px, 9vw, 49px);
  text-align: center;
  font-family: 'PretendardVariable', 'Pretendard', system-ui, sans-serif;
  color: var(--white);
}

.eyebrow {
  font-size: 14px;
  font-weight: 700;
  opacity: 0.85;
}

.groupName {
  font-size: 32px;
  font-weight: 900;
}

.tagline {
  font-size: 16px;
  font-weight: 700;
}

.description {
  font-size: 15px;
  font-weight: 600;
  max-width: 360px;
}

.animals {
  font-size: 15px;
  font-weight: 700;
  margin-top: 8px;
}

.axisRow {
  display: flex;
  gap: 16px;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.7;
}

.axisActive {
  opacity: 1;
  font-weight: 900;
  text-decoration: underline;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 360px;
  margin-top: 24px;
}

.shareBtn,
.retryBtn {
  height: 56px;
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 700;
}

.shareBtn {
  background: var(--white);
  color: var(--ink);
}

.retryBtn {
  background: transparent;
  color: var(--white);
  border: 2px solid var(--white);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run src/pages/QuizResult.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/QuizResult.jsx src/pages/QuizResult.module.css src/pages/QuizResult.test.jsx
git commit -m "feat: add quiz result screen"
```

---

### Task 10: 라우트 등록 및 랜딩 페이지 진입점

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/LandingPage.jsx`
- Modify: `src/pages/LandingPage.module.css`

- [ ] **Step 1: `App.jsx`에 라우트 추가**

`src/App.jsx` import 블록에 추가:

```js
import QuizIntro from './pages/QuizIntro'
import QuizPlay from './pages/QuizPlay'
import QuizResult from './pages/QuizResult'
```

`<Routes>` 안, `<Route path="/admin" .../>` 다음에 추가:

```jsx
      <Route path="/quiz" element={<QuizIntro />} />
      <Route path="/quiz/play" element={<QuizPlay />} />
      <Route path="/quiz/result/:resultId" element={<QuizResult />} />
```

- [ ] **Step 2: `LandingPage.jsx`에 진입 버튼 추가**

`src/pages/LandingPage.jsx`의 `.buttons` 블록(랭킹 보기 버튼 다음)에 추가:

```jsx
        <button className={styles.quizBtn} onClick={() => navigate('/quiz')}>
          우리 아이 경제 잠재력 테스트
        </button>
```

- [ ] **Step 3: `LandingPage.module.css`에 스타일 추가**

`.secondaryBtn` 규칙 다음에 추가:

```css
.quizBtn {
  background: transparent;
  color: var(--ink-2);
  border: none;
  height: 40px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: underline;
}
```

- [ ] **Step 4: 기존 LandingPage 테스트 확인**

Run: `npx vitest run src/pages/LandingPage.test.jsx`
Expected: PASS (기존 테스트가 새 버튼 때문에 깨지지 않는지 확인)

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/pages/LandingPage.jsx src/pages/LandingPage.module.css
git commit -m "feat: wire up quiz routes and landing page entry point"
```

---

### Task 11: 전체 테스트 실행 및 수동 확인

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npm test -- --run`
Expected: 모든 테스트 PASS (기존 테스트 포함, 회귀 없음)

- [ ] **Step 2: 개발 서버로 수동 확인**

Run: `npm run dev`
브라우저에서 `http://localhost:5173` → "우리 아이 경제 잠재력 테스트" 클릭 → 인트로 → 안내 → 이름/나이 입력 → 6문항 → 결과 화면까지 끝까지 진행해 확인한다. 결과 화면에서 "결과 공유하기" 클릭 시 URL이 클립보드에 복사되는지, "다시 하기" 클릭 시 `/quiz`로 돌아가는지 확인한다.

---

### Task 12 (완료): Red/Orange/Blue Group 실제 카피 반영

사용자가 smore.im/quiz/JFWXFqyQVv에서 직접 3개 그룹 결과 화면까지 진행해 원문을 `temp/red_group.md`, `temp/orange_group.md`, `temp/blue_group.md`로 전달했다. `src/constants/quizData.js`의 `RESULT_GROUPS['Red Group']`, `['Orange Group']`, `['Blue Group']`을 실제 tagline·description·animals로 교체 완료(Green Group도 `temp/green_group.md`로 교차 확인해 기존 값과 100% 일치 확인).

대표 동물 일러스트는 사용자가 추후 전달 예정이므로, 그때까지 결과 화면은 `RESULT_GROUPS[...].color`의 단색 배경으로만 표시한다(현재 구현 상태 유지, 추가 작업 불필요).
