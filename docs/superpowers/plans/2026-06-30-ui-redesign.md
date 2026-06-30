# UI 전면 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 머니빌리지 앱의 전체 UI를 다크→라이트 테마로 전환하고, IndividualPage를 StepBar 기반 5단계 전체화면 입력 UI로 재구성한다.

**Architecture:** 1단계에서 CSS 변수+공통 컴포넌트를 먼저 구축하고, 인트로 화면→Lobby→IndividualPage 순으로 진행한다. IndividualPage는 대시보드+팝업 구조를 제거하고 `step` 상태(0~4)로 5단계 화면을 전환하며, 소켓 emit 로직은 그대로 보존한다. 진입점은 Lobby "프로필 설정" 버튼이며, 기존 데이터가 있으면 `completedUpTo=4`로 모든 탭이 즉시 클릭 가능하다.

**Tech Stack:** React 18, React Router v6, CSS Modules, Vitest + @testing-library/react, Nunito (Google Fonts)

---

## 파일 구조

**신규 생성:**
- `src/components/StepBar.jsx` + `StepBar.module.css` + `StepBar.test.jsx`
- `src/components/QuantitySelector.jsx` + `QuantitySelector.module.css` + `QuantitySelector.test.jsx`
- `src/components/AssetRow.jsx` + `AssetRow.module.css` + `AssetRow.test.jsx`

**수정:**
- `src/index.css` — Nunito + 라이트 테마 + CSS 변수
- `src/components/BackButton.jsx` / `.module.css` / `.test.jsx`
- `src/components/PlayerSlot.jsx` / `.module.css` / `.test.jsx`
- `src/pages/LandingPage.jsx` / `.module.css`
- `src/pages/NameInput.jsx` / `.module.css`
- `src/pages/CharacterSelect.jsx` / `.module.css`
- `src/pages/Home.jsx` / `.module.css`
- `src/pages/Lobby.jsx` / `.module.css`
- `src/pages/IndividualPage.jsx` / `.module.css`

**범위 외 (현행 유지):** `RankingPage`, `ResultPage`

---

### Task 1: CSS 변수 + 라이트 테마

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: index.css 전면 교체**

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;700;800;900&display=swap');

:root {
  --purple:      #6c7de5;
  --purple-ink:  #5b7cf0;
  --violet:      #9b5fd4;
  --blue-accent: #70a6fe;
  --blob:        #a3b3ff;
  --grad-page:   linear-gradient(160deg, #6ea6fd 0%, #949dfe 50%, #9191fb 100%);
  --grad-btn:    linear-gradient(90deg, #5b7cf0 0%, #9b5fd4 100%);
  --ink:         #111111;
  --ink-2:       #888888;
  --muted:       #99a1af;
  --disabled:    #bbbbbb;
  --ghost:       #cccccc;
  --white:       #ffffff;
  --slot-empty:  #f9f9f9;
  --line:        #e0e0e0;
  --divider:     #ededed;
  --r-sm:        16px;
  --r-md:        20px;
  --r-lg:        24px;
  --r-pill:      999px;
  --shadow-card: 0 4px 6px -4px rgba(0,0,0,.10), 0 10px 15px -3px rgba(0,0,0,.10);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Nunito', system-ui, sans-serif;
  background: #ffffff;
  color: #111111;
  min-height: 100vh;
}

input, button { font-family: inherit; }
button { cursor: pointer; border: none; }
```

- [ ] **Step 2: 기존 테스트 전부 통과 확인**

```bash
npm test -- --run
```

Expected: 전체 테스트 PASS (CSS 변경은 기능 테스트에 영향 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/index.css
git commit -m "style: light theme + Nunito + CSS variables"
```

---

### Task 2: BackButton 재구성

**Files:**
- Modify: `src/components/BackButton.jsx`
- Modify: `src/components/BackButton.module.css`
- Modify: `src/components/BackButton.test.jsx`

- [ ] **Step 1: BackButton.jsx 수정 — variant prop 추가**

```jsx
import { useNavigate } from 'react-router-dom'
import styles from './BackButton.module.css'

export default function BackButton({ variant = 'body' }) {
  const navigate = useNavigate()
  return (
    <button
      className={`${styles.btn} ${variant === 'intro' ? styles.intro : styles.body}`}
      onClick={() => navigate(-1)}
      aria-label="뒤로 가기"
    >
      ‹ 뒤로
    </button>
  )
}
```

- [ ] **Step 2: BackButton.module.css 수정**

```css
.btn {
  position: absolute;
  top: 32px;
  left: 49px;
  z-index: 100;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
}

.body { color: #888888; }
.intro { color: #ffffff; }
```

- [ ] **Step 3: BackButton.test.jsx 업데이트**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import BackButton from './BackButton'

describe('BackButton', () => {
  it('뒤로 버튼을 렌더링한다', () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument()
  })

  it('클릭 시 navigate(-1)을 호출한다', async () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('variant=intro는 intro 클래스를 적용한다', () => {
    render(<MemoryRouter><BackButton variant="intro" /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' }).className).toMatch(/intro/)
  })

  it('기본 variant는 body이다', () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' }).className).toMatch(/body/)
  })
})
```

- [ ] **Step 4: 테스트 실행**

```bash
npm test -- --run src/components/BackButton.test.jsx
```

Expected: 4개 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/BackButton.jsx src/components/BackButton.module.css src/components/BackButton.test.jsx
git commit -m "feat: redesign BackButton with variant prop (intro/body)"
```

---

### Task 3: StepBar 컴포넌트

**Files:**
- Create: `src/components/StepBar.jsx`
- Create: `src/components/StepBar.module.css`
- Create: `src/components/StepBar.test.jsx`

- [ ] **Step 1: StepBar.test.jsx 작성 (실패 먼저)**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StepBar from './StepBar'

const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']

describe('StepBar', () => {
  it('5개 스텝 라벨을 모두 렌더링한다', () => {
    render(<StepBar steps={STEPS} currentStep={0} completedUpTo={-1} />)
    STEPS.forEach(label => expect(screen.getByText(label)).toBeInTheDocument())
  })

  it('currentStep의 버튼에 stepActive 클래스가 적용된다', () => {
    render(<StepBar steps={STEPS} currentStep={2} completedUpTo={1} />)
    expect(screen.getByText('부동산').closest('button').className).toMatch(/stepActive/)
  })

  it('onStepClick이 없으면 모든 버튼이 disabled이다', () => {
    render(<StepBar steps={STEPS} currentStep={0} completedUpTo={-1} />)
    STEPS.forEach(label => {
      expect(screen.getByText(label).closest('button')).toBeDisabled()
    })
  })

  it('onStepClick이 있고 completedUpTo 이하 스텝은 클릭 가능하다', async () => {
    const onStepClick = vi.fn()
    render(<StepBar steps={STEPS} currentStep={2} completedUpTo={4} onStepClick={onStepClick} />)
    await userEvent.click(screen.getByText('직업').closest('button'))
    expect(onStepClick).toHaveBeenCalledWith(0)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- --run src/components/StepBar.test.jsx
```

Expected: FAIL (파일 없음)

- [ ] **Step 3: StepBar.jsx 구현**

```jsx
import styles from './StepBar.module.css'

export default function StepBar({ steps, currentStep, completedUpTo = -1, onStepClick }) {
  return (
    <div className={styles.container}>
      {steps.map((label, i) => {
        const isActiveOrDone = i <= currentStep || i <= completedUpTo
        const isClickable = onStepClick != null && i <= completedUpTo
        return (
          <button
            key={label}
            className={`${styles.step} ${isActiveOrDone ? styles.stepActive : styles.stepInactive}`}
            onClick={isClickable ? () => onStepClick(i) : undefined}
            disabled={!isClickable}
          >
            <div className={`${styles.line} ${isActiveOrDone ? styles.lineActive : ''}`} />
            <span className={styles.label}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: StepBar.module.css 작성**

```css
.container {
  display: flex;
  gap: 12px;
  padding: 20px 49px 0;
}

.step {
  flex: 1;
  background: none;
  border: none;
  padding: 0;
  cursor: default;
  text-align: left;
}

.step:not(:disabled) { cursor: pointer; }

.line {
  height: 3px;
  border-radius: var(--r-pill);
  background: var(--line);
  margin-bottom: 6px;
}

.lineActive { background: var(--ink); }

.label {
  font-size: 10px;
  font-weight: 700;
  color: var(--disabled);
}

.stepActive .label { color: var(--ink); }
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npm test -- --run src/components/StepBar.test.jsx
```

Expected: 4개 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/StepBar.jsx src/components/StepBar.module.css src/components/StepBar.test.jsx
git commit -m "feat: add StepBar component"
```

---

### Task 4: QuantitySelector 컴포넌트

**Files:**
- Create: `src/components/QuantitySelector.jsx`
- Create: `src/components/QuantitySelector.module.css`
- Create: `src/components/QuantitySelector.test.jsx`

- [ ] **Step 1: QuantitySelector.test.jsx 작성**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import QuantitySelector from './QuantitySelector'

describe('QuantitySelector', () => {
  it('1~10 버튼 10개를 렌더링한다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} />)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument()
    }
  })

  it('버튼 클릭 시 onChange에 해당 숫자를 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={0} onChange={onChange} />)
    await userEvent.click(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('이미 선택된 버튼을 클릭하면 onChange에 0을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} />)
    await userEvent.click(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('value 이하의 버튼에 selected 클래스가 적용된다', () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} />)
    expect(screen.getByText('1').closest('button').className).toMatch(/selected/)
    expect(screen.getByText('4').closest('button').className).not.toMatch(/selected/)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- --run src/components/QuantitySelector.test.jsx
```

Expected: FAIL

- [ ] **Step 3: QuantitySelector.jsx 구현**

```jsx
import styles from './QuantitySelector.module.css'

export default function QuantitySelector({ value, onChange }) {
  return (
    <div className={styles.container}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1
        const selected = n <= value
        return (
          <button
            key={n}
            className={`${styles.btn} ${selected ? styles.selected : styles.empty}`}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: QuantitySelector.module.css 작성**

```css
.container {
  display: flex;
  gap: 4px;
}

.btn {
  width: 38px;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.selected {
  background: var(--ink);
  color: var(--white);
  border: none;
}

.empty {
  background: var(--white);
  color: var(--disabled);
  border: 1px solid #eeeeee;
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npm test -- --run src/components/QuantitySelector.test.jsx
```

Expected: 4개 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/QuantitySelector.jsx src/components/QuantitySelector.module.css src/components/QuantitySelector.test.jsx
git commit -m "feat: add QuantitySelector component"
```

---

### Task 5: AssetRow 컴포넌트

**Files:**
- Create: `src/components/AssetRow.jsx`
- Create: `src/components/AssetRow.module.css`
- Create: `src/components/AssetRow.test.jsx`

- [ ] **Step 1: AssetRow.test.jsx 작성**

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AssetRow from './AssetRow'

describe('AssetRow', () => {
  it('명칭과 가격을 렌더링한다', () => {
    render(
      <AssetRow
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('단독 가온개미')).toBeInTheDocument()
    expect(screen.getByText('2만원')).toBeInTheDocument()
  })

  it('합계 "3개"를 렌더링한다', () => {
    render(
      <AssetRow
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('3개')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- --run src/components/AssetRow.test.jsx
```

Expected: FAIL

- [ ] **Step 3: AssetRow.jsx 구현**

```jsx
import QuantitySelector from './QuantitySelector'
import styles from './AssetRow.module.css'

export default function AssetRow({ image, label, price, value, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.left}>
        <img src={image} alt={label} className={styles.img} />
        <div className={styles.info}>
          <span className={styles.label}>{label}</span>
          <span className={styles.price}>{price}</span>
        </div>
      </div>
      <QuantitySelector value={value} onChange={onChange} />
      <span className={styles.total}>{value}개</span>
    </div>
  )
}
```

- [ ] **Step 4: AssetRow.module.css 작성**

```css
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--white);
  border-radius: var(--r-sm);
  padding: 0 16px;
  height: 74px;
  box-shadow: var(--shadow-card);
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;
}

.img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.info {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.price {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-2);
}

.total {
  font-size: 14px;
  font-weight: 900;
  color: var(--ink);
  min-width: 28px;
  text-align: right;
  margin-left: auto;
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npm test -- --run src/components/AssetRow.test.jsx
```

Expected: 2개 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/AssetRow.jsx src/components/AssetRow.module.css src/components/AssetRow.test.jsx
git commit -m "feat: add AssetRow component"
```

---

### Task 6: PlayerSlot 재구성

**Files:**
- Modify: `src/components/PlayerSlot.jsx`
- Modify: `src/components/PlayerSlot.module.css`
- Modify: `src/components/PlayerSlot.test.jsx`

`onNavigate` prop을 제거한다. 네비게이션은 이제 Lobby의 "프로필 설정" 버튼이 담당한다.

- [ ] **Step 1: PlayerSlot.jsx 수정**

```jsx
import styles from './PlayerSlot.module.css'

export default function PlayerSlot({ player, onKick }) {
  if (!player) {
    return (
      <div className={styles.slot}>
        <div className={styles.emptyAvatar}>?</div>
        <span className={styles.emptyLabel}>대기중</span>
      </div>
    )
  }
  return (
    <div className={styles.slot}>
      <img
        src={`/characters/${player.character}.png`}
        alt={player.character}
        className={styles.img}
      />
      <span className={styles.name}>{player.name}</span>
      {player.isHost && <span className={styles.host}>방장 ★</span>}
      {player.gameState?.isCompleted && <span className={styles.completed}>입력완료</span>}
      {onKick && (
        <button
          className={styles.kickBtn}
          onClick={e => { e.stopPropagation(); onKick() }}
          aria-label="추방"
        >
          ✕
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: PlayerSlot.module.css 재구성**

```css
.slot {
  position: relative;
  width: 175px;
  height: 175px;
  background: var(--white);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.img {
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.name {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.host {
  font-size: 11px;
  font-weight: 700;
  color: var(--purple);
}

.completed {
  font-size: 11px;
  font-weight: 700;
  color: #4caf50;
}

.emptyAvatar {
  font-size: 20px;
  font-weight: 400;
  color: var(--ghost);
}

.emptyLabel {
  font-size: 12px;
  font-weight: 700;
  color: var(--ghost);
}

.kickBtn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e53935;
  color: white;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}
```

- [ ] **Step 3: PlayerSlot.test.jsx 업데이트 — "대기중" 텍스트 반영**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PlayerSlot from './PlayerSlot'

describe('PlayerSlot', () => {
  it('참가한 플레이어의 이름과 캐릭터를 표시한다', () => {
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: true }} />)
    expect(screen.getByText('철수')).toBeInTheDocument()
    expect(screen.getByText('방장 ★')).toBeInTheDocument()
    expect(screen.getByAltText('ptsc')).toBeInTheDocument()
  })

  it('player가 null이면 대기중을 표시한다', () => {
    render(<PlayerSlot player={null} />)
    expect(screen.getByText('대기중')).toBeInTheDocument()
  })

  it('isHost가 false이고 미완료면 상태 뱃지가 없다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false }} />)
    expect(screen.getByText('영희')).toBeInTheDocument()
    expect(screen.queryByText('참가완료')).toBeNull()
  })

  it('입력완료 시 입력완료 뱃지를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, gameState: { isCompleted: true } }} />)
    expect(screen.getByText('입력완료')).toBeInTheDocument()
  })

  it('onKick이 전달되면 추방 버튼을 표시한다', () => {
    const onKick = vi.fn()
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: false }} onKick={onKick} />)
    expect(screen.getByRole('button', { name: '추방' })).toBeInTheDocument()
  })

  it('onKick이 없으면 추방 버튼을 표시하지 않는다', () => {
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: false }} />)
    expect(screen.queryByRole('button', { name: '추방' })).toBeNull()
  })

  it('추방 버튼 클릭 시 onKick을 호출한다', async () => {
    const onKick = vi.fn()
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: false }} onKick={onKick} />)
    await userEvent.click(screen.getByRole('button', { name: '추방' }))
    expect(onKick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test -- --run src/components/PlayerSlot.test.jsx
```

Expected: 7개 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/PlayerSlot.jsx src/components/PlayerSlot.module.css src/components/PlayerSlot.test.jsx
git commit -m "feat: redesign PlayerSlot for light theme, remove onNavigate prop"
```

---

### Task 7: LandingPage 재구성

**Files:**
- Modify: `src/pages/LandingPage.jsx`
- Modify: `src/pages/LandingPage.module.css`

- [ ] **Step 1: LandingPage.jsx 재구성**

```jsx
import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.blob} />
      <div className={styles.center}>
        <div className={styles.iconBox}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path d="M8 28L32 8L56 28V56H40V40H24V56H8V28Z" fill="white" />
          </svg>
        </div>
        <h1 className={styles.title}>머니빌리지</h1>
        <p className={styles.subtitle}>게임 결과를 기록해요!</p>
      </div>
      <div className={styles.buttons}>
        <button className={styles.primaryBtn} onClick={() => navigate('/join')}>
          참여하기
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/ranking')}>
          랭킹 보기
        </button>
      </div>
      <footer className={styles.footer}>© 2026 머니빌리지</footer>
    </div>
  )
}
```

- [ ] **Step 2: LandingPage.module.css 재구성**

```css
.page {
  min-height: 100vh;
  background: var(--grad-page);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 0 49px;
}

.blob {
  position: absolute;
  bottom: -60px;
  right: -60px;
  width: 224px;
  height: 224px;
  border-radius: var(--r-pill);
  background: var(--blob);
  opacity: 0.5;
  filter: blur(40px);
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 48px;
}

.iconBox {
  width: 144px;
  height: 144px;
  border-radius: 45px;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 56px;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: -1.8px;
}

.subtitle {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 384px;
}

.primaryBtn {
  background: #ffffff;
  color: var(--purple);
  border-radius: var(--r-sm);
  height: 76px;
  font-size: 26px;
  font-weight: 800;
  box-shadow: var(--shadow-card);
}

.secondaryBtn {
  background: var(--grad-btn);
  color: #ffffff;
  border-radius: var(--r-sm);
  height: 76px;
  font-size: 26px;
  font-weight: 800;
  box-shadow: var(--shadow-card);
}

.footer {
  position: absolute;
  bottom: 24px;
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/pages/LandingPage.jsx src/pages/LandingPage.module.css
git commit -m "feat: redesign LandingPage with gradient background"
```

---

### Task 8: NameInput 재구성

**Files:**
- Modify: `src/pages/NameInput.jsx`
- Modify: `src/pages/NameInput.module.css`

기존 NameInput.jsx를 먼저 읽어 state 이름, localStorage key, navigate 경로를 확인한 뒤 아래 구조로 교체한다. 검증 로직과 라우팅은 현행과 동일하게 유지한다.

- [ ] **Step 1: 현재 NameInput.jsx를 읽어 보존할 로직 파악**

`Read src/pages/NameInput.jsx` 실행 후 다음을 확인:
- `affiliation` / `name` state 변수명
- localStorage key (`player_profile` 또는 다른 키)
- navigate 대상 경로
- `?code=` 쿼리 파라미터 처리 여부

- [ ] **Step 2: NameInput.jsx 재구성 — 기존 로직 보존**

현행 state/navigate/localStorage 로직을 그대로 유지하면서 JSX 구조만 교체:

```jsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // ↓ 기존 NameInput.jsx의 state/로직을 그대로 복사
  const [affiliation, setAffiliation] = useState('')
  const [name, setName] = useState('')

  function handleNext() {
    // ↓ 기존 검증 + localStorage 저장 + navigate 로직 그대로 복사
    if (!affiliation.trim() || !name.trim()) return
    const code = searchParams.get('code') || ''
    localStorage.setItem('player_profile', JSON.stringify({ affiliation, name, code }))
    navigate(`/select${code ? `?code=${code}` : ''}`)
  }

  return (
    <div className={styles.page}>
      <BackButton variant="intro" />
      <div className={styles.header}>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
      </div>
      <div className={styles.card}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>소속을 입력하세요</label>
          <input
            className={styles.input}
            placeholder="예: 경영학과"
            value={affiliation}
            onChange={e => setAffiliation(e.target.value)}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>이름을 입력하세요</label>
          <input
            className={styles.input}
            placeholder="예: 홍길동"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <button
          className={styles.gradBtn}
          onClick={handleNext}
          disabled={!affiliation.trim() || !name.trim()}
        >
          다음 →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: NameInput.module.css 재구성**

```css
.page {
  min-height: 100vh;
  background: var(--grad-page);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 49px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.title {
  font-size: 36px;
  font-weight: 900;
  color: #ffffff;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.card {
  width: 100%;
  max-width: 448px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 12px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

.input {
  height: 58px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.85);
  padding: 0 22px;
  font-size: 16px;
  color: var(--ink);
  outline: none;
}

.input::placeholder { color: var(--muted); }
.input:focus { border-color: var(--blue-accent); }

.gradBtn {
  height: 56px;
  background: var(--grad-btn);
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
}

.gradBtn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 4: 기존 테스트 실행**

```bash
npm test -- --run src/pages/NameInput.test.jsx
```

Expected: 기존 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/NameInput.jsx src/pages/NameInput.module.css
git commit -m "feat: redesign NameInput with gradient + glass card"
```

---

### Task 9: CharacterSelect 재구성

**Files:**
- Modify: `src/pages/CharacterSelect.jsx`
- Modify: `src/pages/CharacterSelect.module.css`

- [ ] **Step 1: 현재 CharacterSelect.jsx를 읽어 CHARACTERS import 경로, 선택 저장 로직 확인**

`Read src/pages/CharacterSelect.jsx` 실행 후 navigate 경로와 localStorage 처리 방식 파악.

- [ ] **Step 2: CharacterSelect.jsx 재구성**

```jsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { CHARACTERS } from '../constants/characters'
import styles from './CharacterSelect.module.css'

export default function CharacterSelect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState(null)

  function handleStart() {
    if (!selected) return
    const stored = JSON.parse(localStorage.getItem('player_profile') || '{}')
    localStorage.setItem('player_profile', JSON.stringify({ ...stored, character: selected }))
    const code = searchParams.get('code') || ''
    navigate(`/team${code ? `?code=${code}` : ''}`)
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h2 className={styles.title}>캐릭터 선택</h2>
        <p className={styles.subtitle}>나를 대표할 동물 캐릭터를 골라보세요</p>
      </div>
      <hr className={styles.divider} />
      <div className={styles.grid}>
        {CHARACTERS.map(char => (
          <button
            key={char.id}
            className={`${styles.tile} ${selected === char.id ? styles.tileSelected : ''}`}
            onClick={() => setSelected(char.id)}
          >
            <img src={`/characters/${char.id}.png`} alt={char.name} className={styles.img} />
          </button>
        ))}
      </div>
      <div className={styles.bottomBar}>
        <button className={styles.ctaBtn} onClick={handleStart} disabled={!selected}>
          이 캐릭터로 시작하기
        </button>
      </div>
    </div>
  )
}
```

기존 CharacterSelect.jsx의 navigate 경로, localStorage key가 다를 경우 그대로 맞춘다.

- [ ] **Step 3: CharacterSelect.module.css 재구성**

```css
.page {
  min-height: 100vh;
  background: var(--white);
  padding: 32px 49px 120px;
  position: relative;
}

.header { margin-top: 44px; }

.title {
  font-size: 30px;
  font-weight: 900;
  color: var(--ink);
}

.subtitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-2);
  margin-top: 4px;
}

.divider {
  border: none;
  border-top: 1px solid var(--divider);
  margin: 16px 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.tile {
  aspect-ratio: 1;
  background: var(--white);
  border-radius: var(--r-sm);
  border: 2px solid transparent;
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 12px;
}

.tileSelected {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(108, 125, 229, 0.25);
}

.img { width: 100%; height: 100%; object-fit: contain; }

.bottomBar {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
}

.ctaBtn {
  background: var(--ink);
  color: #ffffff;
  font-size: 18px;
  font-weight: 800;
  border-radius: var(--r-md);
  height: 70px;
  width: 307px;
  box-shadow: var(--shadow-card);
}

.ctaBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 4: 기존 테스트 실행**

```bash
npm test -- --run src/pages/CharacterSelect.test.jsx
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/CharacterSelect.jsx src/pages/CharacterSelect.module.css
git commit -m "feat: redesign CharacterSelect with light theme 4x4 grid"
```

---

### Task 10: Home 재구성

**Files:**
- Modify: `src/pages/Home.jsx`
- Modify: `src/pages/Home.module.css`

- [ ] **Step 1: 현재 Home.jsx를 읽어 handleCreate 구현 파악**

`Read src/pages/Home.jsx` 실행 후 fetch 경로, localStorage 처리, CodeModal 사용 방식 확인.

- [ ] **Step 2: Home.jsx 재구성 — handleCreate + CodeModal 보존**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CodeModal from '../components/CodeModal'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [showCodeModal, setShowCodeModal] = useState(false)

  // ↓ 기존 handleCreate 로직 그대로 복사 (fetch 경로, localStorage 처리)
  async function handleCreate() {
    const stored = JSON.parse(localStorage.getItem('player_profile') || '{}')
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: stored }),
    })
    const data = await res.json()
    if (data.code) {
      localStorage.setItem('player_profile', JSON.stringify({ ...stored, code: data.code, isHost: true }))
      navigate(`/lobby/${data.code}`)
    }
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.center}>
        <h1 className={styles.title}>팀 구성</h1>
        <p className={styles.subtitle}>팀을 만들거나 참여하세요</p>
      </div>
      <div className={styles.cards}>
        <button className={styles.card} onClick={handleCreate}>
          <span className={styles.icon}>⊞</span>
          <span className={styles.cardTitle}>팀 만들기</span>
          <span className={styles.cardDesc}>새 팀 생성 후 코드 공유</span>
          <span className={styles.chevron}>›</span>
        </button>
        <button className={styles.card} onClick={() => setShowCodeModal(true)}>
          <span className={styles.icon}>🔑</span>
          <span className={styles.cardTitle}>팀 참여</span>
          <span className={styles.cardDesc}>초대 코드로 팀 입장</span>
          <span className={styles.chevron}>›</span>
        </button>
      </div>
      {showCodeModal && <CodeModal onClose={() => setShowCodeModal(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Home.module.css 재구성**

```css
.page {
  min-height: 100vh;
  background: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 49px;
  position: relative;
}

.center {
  text-align: center;
  margin-bottom: 48px;
}

.title {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
}

.subtitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-2);
  margin-top: 8px;
}

.cards {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 512px;
}

.card {
  flex: 1;
  background: var(--white);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--divider);
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  cursor: pointer;
  position: relative;
}

.icon { font-size: 28px; margin-bottom: 4px; }

.cardTitle {
  font-size: 18px;
  font-weight: 900;
  color: var(--ink);
}

.cardDesc {
  font-size: 13px;
  font-weight: 400;
  color: var(--ink-2);
}

.chevron {
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: 20px;
  color: var(--ink-2);
}
```

- [ ] **Step 4: 기존 테스트 실행**

```bash
npm test -- --run src/pages/Home.test.jsx
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Home.jsx src/pages/Home.module.css
git commit -m "feat: redesign Home with light theme choice cards"
```

---

### Task 11: Lobby 재구성

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Modify: `src/pages/Lobby.module.css`

기존 소켓 로직(useEffect 4개: room-updated, room-prices-updated, game-submitted, you-were-kicked), rejoin 로직, handleLeave, handlePriceConfirm, handleSubmit, PriceModal, ConfirmModal JSX를 모두 보존한다.
`PlayerSlot`에 `onNavigate`를 더 이상 전달하지 않는다.

- [ ] **Step 1: 현재 Lobby.jsx 전체를 읽어 보존할 로직 파악**

`Read src/pages/Lobby.jsx` 실행 후 PriceModal, ConfirmModal 구현 위치 확인.

- [ ] **Step 2: Lobby.jsx 재구성 — 기존 소켓 로직 통합**

기존 state, useEffect, 핸들러 함수를 모두 유지하면서 JSX 구조만 교체:

```jsx
// 기존 import + state + useEffect + 핸들러 함수 그대로 유지

return (
  <div className={styles.page}>
    <BackButton />
    <button className={styles.leaveBtn} onClick={handleLeave}>🗑 팀 나가기</button>

    <div className={styles.header}>
      <h1 className={styles.title}>팀 만들기</h1>
      <p className={styles.subtitle}>코드를 팀원에게 공유하세요</p>
    </div>
    <hr className={styles.divider} />

    <div className={styles.codeCard}>
      <span className={styles.codeLabel}>팀 초대 코드</span>
      <div className={styles.codeRow}>
        <span className={styles.code}>{code}</span>
        <button
          className={styles.copyBtn}
          onClick={() => navigator.clipboard.writeText(code)}
          aria-label="코드 복사"
        >
          📋
        </button>
      </div>
    </div>

    <div className={styles.section}>
      <span className={styles.sectionLabel}>팀원 현황</span>
      <div className={styles.slots}>
        {slots.map((player, i) => (
          <PlayerSlot
            key={i}
            player={player}
            onKick={
              isHost && player && player.socketId !== socket?.id
                ? () => socket?.emit('kick-player', { code, socketId: player.socketId })
                : undefined
            }
          />
        ))}
      </div>
    </div>

    <div className={styles.bottomBar}>
      <button className={styles.actionBtn} onClick={() => setShowPriceModal(true)}>
        가격 설정
      </button>
      {myPlayer && (
        <button
          className={styles.actionBtn}
          onClick={() => navigate(`/lobby/${code}/individual`)}
        >
          프로필 설정
        </button>
      )}
      {allCompleted && (
        <button
          className={`${styles.actionBtn} ${styles.submitBtn}`}
          onClick={() => setShowConfirmModal(true)}
          disabled={isSubmitting}
        >
          {isSubmitting ? '제출 중...' : '결과 등록'}
        </button>
      )}
    </div>

    {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
    {/* 기존 PriceModal, ConfirmModal JSX 그대로 유지 */}
  </div>
)
```

`myPlayer` 변수 추가: `const myPlayer = players.find(p => p.socketId === socket?.id)`

- [ ] **Step 3: Lobby.module.css 재구성**

```css
.page {
  min-height: 100vh;
  background: var(--white);
  padding: 32px 49px 120px;
  position: relative;
}

.leaveBtn {
  position: absolute;
  top: 32px;
  right: 49px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  cursor: pointer;
}

.header { margin-top: 44px; }

.title {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
}

.subtitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-2);
  margin-top: 4px;
}

.divider {
  border: none;
  border-top: 1px solid var(--divider);
  margin: 16px 0 24px;
}

.codeCard {
  background: var(--white);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: fit-content;
  margin: 0 auto 32px;
}

.codeLabel {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-2);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.codeRow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.code {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: 9px;
}

.copyBtn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
}

.section { margin-top: 8px; }

.sectionLabel {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-2);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  display: block;
  margin-bottom: 16px;
}

.slots {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.bottomBar {
  position: fixed;
  bottom: 32px;
  left: 49px;
  display: flex;
  gap: 12px;
}

.actionBtn {
  background: var(--ink);
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  border-radius: var(--r-sm);
  height: 56px;
  padding: 0 24px;
  box-shadow: var(--shadow-card);
}

.submitBtn { background: var(--purple); }
.actionBtn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 4: 기존 Lobby 테스트 실행**

```bash
npm test -- --run src/pages/Lobby.test.jsx
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.module.css
git commit -m "feat: redesign Lobby, 프로필 설정 button → IndividualPage"
```

---

### Task 12: IndividualPage — StepBar 프레임 + 직업(step 0)

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Modify: `src/pages/IndividualPage.module.css`

기존 대시보드+팝업 구조 전체를 제거하고 5단계 StepBar UI로 교체한다.
`emitState`, 데이터 로딩 fetch, 소켓 rejoin, you-were-kicked 핸들러는 그대로 보존한다.

- [ ] **Step 1: IndividualPage.jsx 전면 재구성**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import StepBar from '../components/StepBar'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './IndividualPage.module.css'

const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}
const JOB_ICONS = { a: '💼', b: '⚙️', c: '🏥', d: '🎨', e: '🛒', f: '🚚' }

const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']
const BADGE_LABELS = {
  communication: '의사소통 및 협상능력', global: '글로벌경제이해력',
  idea: '문제해결능력', money: '재정관리능력',
  thinking: '기업가정신', trust: '신용과 신뢰',
}

const REAL_ESTATE_LABELS = {
  gaon: '단독 가온개미', nuri: '단독 누리고양이', dami: '다세대 다미원숭이',
  maru: '다세대 마루수리', chorong: '아파트 초롱부엉이', hani: '아파트 하늬여우',
}
const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
const ESTATE_PRICES = {
  gaon: '2만원', nuri: '2만원', dami: '7만원',
  maru: '7만원', chorong: '10만원', hani: '10만원',
}

const STOCK_LABELS = {
  semiconductor: '반도체·IT', finance: '금융', industrial: '산업재·기계',
  auto: '자동차·쇼핑', bio: '바이오·헬스케어', content: '콘텐츠·플랫폼',
}
const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}

export default function IndividualPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const [player, setPlayer] = useState(null)
  const [gameState, setGameState] = useState(defaultGameState)
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)
  const [cashDisplay, setCashDisplay] = useState('0')

  useEffect(() => {
    if (!socket) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        const me = data.players?.find(p => p.socketId === socket.id)
        if (me) {
          setPlayer(me)
          const gs = me.gameState ?? defaultGameState()
          setGameState(gs)
          setCashDisplay(String(gs.cash ?? 0))
          if (gs.job !== null) setCompletedUpTo(4)
          return
        }
        const stored = JSON.parse(localStorage.getItem('player_profile') || 'null')
        const playerUuid = localStorage.getItem('player_uuid')
        if (!stored || stored.code !== code) { navigate(`/lobby/${code}`); return }
        socket.emit('join-room', {
          code, name: stored.name, affiliation: stored.affiliation,
          character: stored.character, isHost: false, playerUuid,
        }, ({ ok }) => {
          if (!ok) { navigate(`/lobby/${code}`); return }
          fetch(`/api/rooms/${code}`)
            .then(r => r.json())
            .then(data2 => {
              const me2 = data2.players?.find(p => p.socketId === socket.id)
              if (!me2) { navigate(`/lobby/${code}`); return }
              setPlayer(me2)
              const gs = me2.gameState ?? defaultGameState()
              setGameState(gs)
              setCashDisplay(String(gs.cash ?? 0))
              if (gs.job !== null) setCompletedUpTo(4)
            })
            .catch(() => navigate(`/lobby/${code}`))
        })
      })
      .catch(() => navigate(`/lobby/${code}`))
  }, [code, socket, navigate])

  useEffect(() => {
    if (!socket) return
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate])

  function emitState(newState) {
    socket?.emit('update-player-state', { code, gameState: newState })
  }

  function handleNext() {
    if (step === 0 && !gameState.job) return
    if (step === 4) { handleComplete(); return }
    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  function handleComplete() {
    const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
    const next = { ...gameState, cash: cashVal, isCompleted: true }
    setGameState(next)
    emitState(next)
    navigate(`/lobby/${code}`)
  }

  if (!player) return null

  return (
    <div className={styles.page}>
      <BackButton />
      <StepBar
        steps={STEPS}
        currentStep={step}
        completedUpTo={completedUpTo}
        onStepClick={completedUpTo >= 0 ? i => setStep(i) : undefined}
      />
      <hr className={styles.divider} />

      {step === 0 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>직업 선택</h1>
          <p className={styles.stepSubtitle}>나의 직업을 선택해주세요</p>
          <div className={styles.jobGrid}>
            {Object.entries(JOB_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.jobTile} ${gameState.job === key ? styles.tileSelected : ''}`}
                onClick={() => {
                  const next = { ...gameState, job: key }
                  setGameState(next)
                  emitState(next)
                }}
              >
                <span className={styles.jobIcon}>{JOB_ICONS[key]}</span>
                <span className={styles.tileLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.bottomBar}>
        <button
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={step === 0 && !gameState.job}
        >
          {step === 4 ? '완료' : '다음'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: IndividualPage.module.css 재구성**

```css
.page {
  min-height: 100vh;
  background: var(--white);
  padding: 32px 0 120px;
  position: relative;
}

.divider {
  border: none;
  border-top: 1px solid var(--divider);
  margin: 12px 0 0;
}

.stepContent {
  padding: 24px 49px 0;
}

.stepTitle {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
  margin-bottom: 4px;
}

.stepSubtitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-2);
  margin-bottom: 24px;
}

.jobGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.jobTile {
  background: var(--white);
  border-radius: var(--r-sm);
  border: 2px solid transparent;
  box-shadow: var(--shadow-card);
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  aspect-ratio: 1;
}

.tileSelected {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(108, 125, 229, 0.2);
}

.jobIcon { font-size: 48px; }

.tileLabel {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.bottomBar {
  position: fixed;
  bottom: 32px;
  right: 49px;
}

.nextBtn {
  background: var(--ink);
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  border-radius: var(--r-sm);
  height: 58px;
  width: 167px;
  box-shadow: var(--shadow-card);
}

.nextBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: 앱 실행 후 직업 단계 수동 확인**

```bash
npm run dev
```

브라우저에서 Lobby → "프로필 설정" 클릭 → StepBar 표시, 직업 6개 타일 렌더링, 선택 시 "다음" 활성화 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.module.css
git commit -m "feat: IndividualPage - StepBar framework + step 1 (직업)"
```

---

### Task 13: IndividualPage — 성공카드(step 1) + 부동산(step 2) + 주식(step 3)

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Modify: `src/pages/IndividualPage.module.css`

- [ ] **Step 1: import에 AssetRow 추가**

```jsx
import AssetRow from '../components/AssetRow'
```

- [ ] **Step 2: 성공카드 단계(step 1) 추가 — `{step === 0 && ...}` 블록 다음에 삽입**

```jsx
{step === 1 && (
  <div className={styles.stepContent}>
    <h1 className={styles.stepTitle}>성공카드</h1>
    <p className={styles.stepSubtitle}>획득한 성공카드를 모두 선택해주세요</p>
    <div className={styles.jobGrid}>
      {BADGE_NAMES.map((name, i) => (
        <button
          key={name}
          className={`${styles.jobTile} ${gameState.badges[i] ? styles.tileSelected : ''}`}
          onClick={() => {
            const badges = [...gameState.badges]
            badges[i] = !badges[i]
            const next = { ...gameState, badges }
            setGameState(next)
            emitState(next)
          }}
        >
          <img src={`/badges/${name}.png`} alt={name} className={styles.badgeImg} />
          <span className={styles.tileLabel}>{BADGE_LABELS[name]}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: 부동산 단계(step 2) 추가**

```jsx
{step === 2 && (
  <div className={styles.stepContent}>
    <h1 className={styles.stepTitle}>부동산</h1>
    <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
    <div className={styles.assetList}>
      {Object.keys(REAL_ESTATE_LABELS).map(key => (
        <AssetRow
          key={key}
          image={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
          label={REAL_ESTATE_LABELS[key]}
          price={ESTATE_PRICES[key]}
          value={gameState.realEstate[key]}
          onChange={val => {
            const realEstate = { ...gameState.realEstate, [key]: val }
            const next = { ...gameState, realEstate, realEstateVisited: true }
            setGameState(next)
            emitState(next)
          }}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: 주식 단계(step 3) 추가**

```jsx
{step === 3 && (
  <div className={styles.stepContent}>
    <h1 className={styles.stepTitle}>주식</h1>
    <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
    <div className={styles.assetList}>
      {Object.keys(STOCK_LABELS).map(key => (
        <AssetRow
          key={key}
          image={`/badges/stock/${STOCK_IMAGES[key]}.png`}
          label={STOCK_LABELS[key]}
          price="가격 설정"
          value={gameState.stocks[key]}
          onChange={val => {
            const stocks = { ...gameState.stocks, [key]: val }
            const next = { ...gameState, stocks, stocksVisited: true }
            setGameState(next)
            emitState(next)
          }}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: IndividualPage.module.css에 추가 스타일 삽입**

```css
.badgeImg {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.assetList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

- [ ] **Step 6: 앱에서 step 1~3 수동 확인**

직업 선택 후 "다음" → 성공카드 그리드(6개 배지 이미지) 표시, 다중 선택 가능.
"다음" → 부동산 AssetRow 6줄 + QuantitySelector.
"다음" → 주식 AssetRow 6줄.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.module.css
git commit -m "feat: IndividualPage - steps 2-4 (성공카드, 부동산, 주식)"
```

---

### Task 14: IndividualPage — 현금(step 4) + 완료

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Modify: `src/pages/IndividualPage.module.css`

- [ ] **Step 1: 현금 Numpad 단계(step 4) 추가 — `{step === 3 && ...}` 다음에 삽입**

```jsx
{step === 4 && (
  <div className={styles.stepContent}>
    <h1 className={styles.stepTitle}>현금</h1>
    <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
    <div className={styles.numpadDisplay}>
      {Number(cashDisplay || 0).toLocaleString()}원
    </div>
    <div className={styles.numpad}>
      {['1','2','3','4','5','6','7','8','9','00','0','←'].map(key => (
        <button
          key={key}
          className={styles.numpadKey}
          onClick={() => {
            if (key === '←') {
              setCashDisplay(prev => prev.length <= 1 ? '0' : prev.slice(0, -1))
            } else {
              setCashDisplay(prev => {
                const next = prev === '0' ? key : prev + key
                return next.length > 10 ? prev : next
              })
            }
          }}
        >
          {key}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Numpad 스타일 추가**

```css
.numpadDisplay {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
  text-align: center;
  padding: 24px 0;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 24px;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 360px;
  margin: 0 auto;
}

.numpadKey {
  background: var(--white);
  border-radius: var(--r-sm);
  border: 1px solid var(--divider);
  height: 72px;
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
  box-shadow: var(--shadow-card);
}

.numpadKey:active { background: var(--slot-empty); }
```

- [ ] **Step 3: handleComplete 동작 확인**

`handleComplete`가 `cashDisplay` → 정수 변환 → `isCompleted: true`로 emit 후 `/lobby/${code}`로 이동하는지 확인:

```jsx
function handleComplete() {
  const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
  const next = { ...gameState, cash: cashVal, isCompleted: true }
  setGameState(next)
  emitState(next)
  navigate(`/lobby/${code}`)
}
```

Task 12에서 작성한 것과 동일한지 확인. 다르면 위 코드로 교체.

- [ ] **Step 4: 전체 테스트 실행**

```bash
npm test -- --run
```

Expected: 전체 PASS

- [ ] **Step 5: 앱에서 전체 플로우 수동 확인**

홈(그라데이션) → 로그인(glass card) → 캐릭터 선택(white 4×4) → 팀 구성(2 카드) → 로비(코드카드+슬롯) → 프로필 설정 → StepBar 5단계 완료 → 로비로 복귀 + "입력완료" 배지 표시.

- [ ] **Step 6: 최종 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.module.css
git commit -m "feat: IndividualPage - step 5 (현금 Numpad) + 완료 flow"
```
