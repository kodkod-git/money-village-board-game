# 관리자 모드 개편 (관전/수정 화면 + 실데이터 연동) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 모드의 관전/수정 화면을 목업 디자인대로 새로 만들고, 목업 데이터 대신 실제 데이터(진행중인 방 + 완료된 팀)를 쓰도록 연동한다.

**Architecture:** 서버에 진행중인 방(메모리)과 완료된 팀(Supabase)을 통합 조회/수정하는 `/api/admin/rooms` 엔드포인트를 추가한다. 프론트엔드는 `IndividualPage.jsx`의 필드 입력 UI(직업/성공카드/부동산/주식 선택기)를 재사용 가능한 컴포넌트로 추출하고, 이를 새 `AdminSpectateModal`(관전) → `AdminEditModal`(수정) 팝업 흐름에서 재사용한다. 관리자가 진행중인 팀을 수정하면 기존 소켓 `room-updated` 이벤트로 플레이어 화면에 즉시 반영되고, 완료된 팀 수정은 Supabase를 직접 UPDATE한다. 관전 팝업이 열려 있는 동안은 3초 폴링으로 진행중 팀 데이터를 갱신한다(관리자 대시보드 목록 자체는 수동 새로고침).

**Tech Stack:** React 18 + react-router-dom, Vite, Vitest + Testing Library, Express 5, socket.io, Supabase.

**Spec:** `docs/superpowers/specs/2026-07-20-admin-mode-db-design.md`
**Worktree/branch:** `.worktrees/admin-mode-db` on `feat/2026-07-20-admin-mode-db` (already created)

---

## File Structure Overview

**New files:**
- `src/constants/gameData.js` — 직업/성공카드/부동산/주식 라벨·이미지·가격 상수 (기존 `IndividualPage.jsx`에 흩어져 있던 것을 중앙화)
- `src/components/JobPicker.jsx` (+ `.module.css`, `.test.jsx`)
- `src/components/BadgePicker.jsx` (+ `.module.css`, `.test.jsx`)
- `src/components/AssetListEditor.jsx` (+ `.test.jsx`, 스타일은 기존 `IndividualPage.module.css`의 `.assetList` 재사용)
- `src/pages/IndividualPage.test.jsx` — 리팩터 전 안전망
- `src/components/admin/AdminPlayerCard.jsx` (+ `.module.css`, `.test.jsx`)
- `src/components/admin/JobEditModal.jsx` (+ `.test.jsx`)
- `src/components/admin/BadgeEditModal.jsx` (+ `.test.jsx`)
- `src/components/admin/RealEstateEditModal.jsx` (+ `.test.jsx`)
- `src/components/admin/StockEditModal.jsx` (+ `.test.jsx`)
- `src/components/admin/AdminEditModal.jsx` (+ `.module.css`, `.test.jsx`)
- `src/components/admin/AdminSpectateModal.jsx` (+ `.module.css`, `.test.jsx`)

**Modified files:**
- `server/rooms.js`, `server/rooms.test.js` — `listAllRooms`, `updatePlayerStateByUuid` 추가
- `server/db.js`, `server/db.test.js` — `getAllCompletedTeams`, `updateGameResult` 추가
- `server/index.js` — `GET /api/admin/rooms`, `PATCH /api/admin/rooms/:code/players/:playerUuid` 라우트 추가
- `src/pages/IndividualPage.jsx` — 추출한 컴포넌트/상수 사용하도록 리팩터
- `src/pages/AdminDashboard.jsx`, `src/pages/AdminDashboard.module.css`, `src/pages/AdminDashboard.test.jsx` — 실데이터 연동, `AdminSpectateModal`로 교체

**Deleted files:**
- `src/data/adminMockData.js`, `src/data/adminMockData.test.js`

---

### Task 1: 공용 게임 데이터 상수 추출

**Files:**
- Create: `src/constants/gameData.js`
- Test: `src/constants/gameData.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/constants/gameData.test.js
import { describe, it, expect } from 'vitest'
import {
  JOB_LABELS, JOB_ICONS, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES,
  STOCK_LABELS, STOCK_IMAGES,
} from './gameData'

describe('gameData constants', () => {
  it('직업은 6개이며 라벨과 아이콘 키가 일치한다', () => {
    const keys = Object.keys(JOB_LABELS)
    expect(keys).toHaveLength(6)
    expect(Object.keys(JOB_ICONS)).toEqual(keys)
  })

  it('성공카드는 6개이며 이름과 라벨 키가 일치한다', () => {
    expect(BADGE_NAMES).toHaveLength(6)
    expect(Object.keys(BADGE_LABELS)).toEqual(BADGE_NAMES)
  })

  it('부동산은 6개이며 라벨/이미지/가격 키가 일치한다', () => {
    const keys = Object.keys(REAL_ESTATE_LABELS)
    expect(keys).toHaveLength(6)
    expect(Object.keys(ESTATE_IMAGES)).toEqual(keys)
    expect(Object.keys(ESTATE_PRICES)).toEqual(keys)
  })

  it('주식은 6개이며 라벨/이미지 키가 일치한다', () => {
    const keys = Object.keys(STOCK_LABELS)
    expect(keys).toHaveLength(6)
    expect(Object.keys(STOCK_IMAGES)).toEqual(keys)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/constants/gameData.test.js`
Expected: FAIL — `Cannot find module './gameData'`

- [ ] **Step 3: Write the implementation**

```js
// src/constants/gameData.js
export const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}
export const JOB_ICONS = { a: '💼', b: '⚙️', c: '🏥', d: '🎨', e: '🛒', f: '🚚' }

export const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']
export const BADGE_LABELS = {
  communication: '의사소통 및 협상능력', global: '글로벌경제이해력',
  idea: '문제해결능력', money: '재정관리능력',
  thinking: '기업가정신', trust: '신용과 신뢰',
}

export const REAL_ESTATE_LABELS = {
  gaon: '단독 가온개미', nuri: '단독 누리고양이', dami: '다세대 다미원숭이',
  maru: '다세대 마루수리', chorong: '아파트 초롱부엉이', hani: '아파트 하늬여우',
}
export const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
export const ESTATE_PRICES = {
  gaon: '2만원', nuri: '2만원', dami: '7만원',
  maru: '7만원', chorong: '10만원', hani: '10만원',
}

export const STOCK_LABELS = {
  semiconductor: '반도체·IT', finance: '금융', industrial: '산업재·기계',
  auto: '자동차·쇼핑', bio: '바이오·헬스케어', content: '콘텐츠·플랫폼',
}
export const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/constants/gameData.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/constants/gameData.js src/constants/gameData.test.js
git commit -m "feat: extract shared game data constants"
```

---

### Task 2: `JobPicker` 컴포넌트 추출

**Files:**
- Create: `src/components/JobPicker.jsx`
- Create: `src/components/JobPicker.module.css`
- Test: `src/components/JobPicker.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/JobPicker.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JobPicker from './JobPicker'

describe('JobPicker', () => {
  it('6개의 직업 타일을 렌더링한다', () => {
    render(<JobPicker value={null} onChange={vi.fn()} />)
    expect(screen.getByText('경영·금융')).toBeInTheDocument()
    expect(screen.getByText('생산·운송')).toBeInTheDocument()
  })

  it('선택된 직업 타일에 체크 표시를 보여준다', () => {
    render(<JobPicker value="b" onChange={vi.fn()} />)
    const tile = screen.getByText('연구·기술').closest('button')
    expect(tile).toHaveTextContent('✓')
  })

  it('타일 클릭 시 onChange를 해당 키로 호출한다', async () => {
    const onChange = vi.fn()
    render(<JobPicker value={null} onChange={onChange} />)
    await userEvent.click(screen.getByText('보건·교육'))
    expect(onChange).toHaveBeenCalledWith('c')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/JobPicker.test.jsx`
Expected: FAIL — `Cannot find module './JobPicker'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/JobPicker.jsx
import { JOB_LABELS, JOB_ICONS } from '../constants/gameData'
import styles from './JobPicker.module.css'

export default function JobPicker({ value, onChange }) {
  return (
    <div className={styles.grid}>
      {Object.entries(JOB_LABELS).map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`${styles.tile} ${value === key ? styles.tileSelected : ''}`}
          onClick={() => onChange(key)}
        >
          {value === key && <span className={styles.tileBadge}>✓</span>}
          <span className={styles.icon}>{JOB_ICONS[key]}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  )
}
```

```css
/* src/components/JobPicker.module.css */
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.tile {
  background: var(--white);
  border-radius: var(--r-sm);
  border: 2px solid transparent;
  box-shadow: var(--shadow-card);
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  aspect-ratio: 1;
  min-width: 0;
  position: relative;
}

.tileBadge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--white);
  color: var(--ink);
  font-size: 11px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tileSelected { background: var(--ink); border-color: var(--ink); }
.tileSelected .label { color: var(--white); }

.icon { font-size: 40px; }

.label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
  text-align: center;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/JobPicker.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/JobPicker.jsx src/components/JobPicker.module.css src/components/JobPicker.test.jsx
git commit -m "feat: extract JobPicker component"
```

---

### Task 3: `BadgePicker` 컴포넌트 추출

**Files:**
- Create: `src/components/BadgePicker.jsx`
- Create: `src/components/BadgePicker.module.css`
- Test: `src/components/BadgePicker.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/BadgePicker.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgePicker from './BadgePicker'

const NONE = [false, false, false, false, false, false]

describe('BadgePicker', () => {
  it('6개의 성공카드 타일을 렌더링한다', () => {
    render(<BadgePicker badges={NONE} onToggle={vi.fn()} />)
    expect(screen.getByText('의사소통 및 협상능력')).toBeInTheDocument()
    expect(screen.getByText('신용과 신뢰')).toBeInTheDocument()
  })

  it('선택된 카드에 체크 표시를 보여준다', () => {
    const badges = [true, false, false, false, false, false]
    render(<BadgePicker badges={badges} onToggle={vi.fn()} />)
    const tile = screen.getByText('의사소통 및 협상능력').closest('button')
    expect(tile).toHaveTextContent('✓')
  })

  it('타일 클릭 시 onToggle을 해당 인덱스로 호출한다', async () => {
    const onToggle = vi.fn()
    render(<BadgePicker badges={NONE} onToggle={onToggle} />)
    await userEvent.click(screen.getByText('문제해결능력'))
    expect(onToggle).toHaveBeenCalledWith(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BadgePicker.test.jsx`
Expected: FAIL — `Cannot find module './BadgePicker'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/BadgePicker.jsx
import { BADGE_NAMES, BADGE_LABELS } from '../constants/gameData'
import styles from './BadgePicker.module.css'

export default function BadgePicker({ badges, onToggle }) {
  return (
    <div className={styles.grid}>
      {BADGE_NAMES.map((name, i) => (
        <button
          key={name}
          type="button"
          className={`${styles.tile} ${badges[i] ? styles.tileSelected : ''}`}
          onClick={() => onToggle(i)}
        >
          {badges[i] && <span className={styles.tileBadge}>✓</span>}
          <img src={`/badges/${name}.png`} alt={name} className={styles.img} />
          <span className={styles.label}>{BADGE_LABELS[name]}</span>
        </button>
      ))}
    </div>
  )
}
```

```css
/* src/components/BadgePicker.module.css */
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}

.tile {
  background: var(--white);
  border-radius: var(--r-sm);
  border: 2px solid transparent;
  box-shadow: var(--shadow-card);
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  height: 116px;
  min-width: 0;
  position: relative;
}

.tileBadge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--white);
  color: var(--ink);
  font-size: 11px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tileSelected { background: var(--ink); border-color: var(--ink); }
.tileSelected .label { color: var(--white); }

.img { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }

.label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
  text-align: center;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BadgePicker.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/BadgePicker.jsx src/components/BadgePicker.module.css src/components/BadgePicker.test.jsx
git commit -m "feat: extract BadgePicker component"
```

---

### Task 4: `AssetListEditor` 컴포넌트 추출

**Files:**
- Create: `src/components/AssetListEditor.jsx`
- Test: `src/components/AssetListEditor.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/AssetListEditor.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssetListEditor from './AssetListEditor'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES } from '../constants/gameData'

const VALUES = { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('AssetListEditor', () => {
  it('각 항목의 라벨과 수량을 렌더링한다', () => {
    render(
      <AssetListEditor
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        priceLabels={ESTATE_PRICES}
        imageFolder="estate"
        values={VALUES}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('단독 가온개미')).toBeInTheDocument()
    expect(screen.getByText('2만원')).toBeInTheDocument()
  })

  it('+ 버튼 클릭 시 onChange를 해당 키와 증가된 수량으로 호출한다', async () => {
    const onChange = vi.fn()
    render(
      <AssetListEditor
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        priceLabels={ESTATE_PRICES}
        imageFolder="estate"
        values={VALUES}
        onChange={onChange}
      />
    )
    const rows = screen.getAllByLabelText('수량 증가')
    await userEvent.click(rows[0])
    expect(onChange).toHaveBeenCalledWith('gaon', 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AssetListEditor.test.jsx`
Expected: FAIL — `Cannot find module './AssetListEditor'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/AssetListEditor.jsx
import AssetCard from './AssetCard'
import styles from '../pages/IndividualPage.module.css'

export default function AssetListEditor({ labels, images, priceLabels, imageFolder, values, onChange }) {
  return (
    <div className={styles.assetList}>
      {Object.keys(labels).map(key => (
        <AssetCard
          key={key}
          image={`/badges/${imageFolder}/${images[key]}.png`}
          label={labels[key]}
          price={priceLabels[key]}
          value={values[key]}
          onChange={val => onChange(key, val)}
        />
      ))}
    </div>
  )
}
```

`priceLabels`는 부동산처럼 고정 가격 문자열(`ESTATE_PRICES`)일 수도, 주식처럼 항상 `"가격 설정"` 같은 고정 문구를 담은 맵일 수도 있음 — 호출부에서 결정.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AssetListEditor.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/AssetListEditor.jsx src/components/AssetListEditor.test.jsx
git commit -m "feat: extract AssetListEditor component"
```

---

### Task 5: `IndividualPage` 리팩터 전 안전망 테스트 작성

**Files:**
- Create: `src/pages/IndividualPage.test.jsx`

`IndividualPage.jsx`는 지금까지 테스트가 없었다. 리팩터(Task 6) 전에 핵심 동작을 고정하는 테스트를 먼저 작성하고, 리팩터 전/후 모두 통과하는지 확인한다.

- [ ] **Step 1: Write the test**

```jsx
// src/pages/IndividualPage.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import IndividualPage from './IndividualPage'
import { SocketProvider } from '../contexts/SocketContext'

const PLAYER = {
  socketId: 's1', playerUuid: 'p1', name: '김민준', character: 'Innovator-사자',
  gameState: {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false, realEstateVisited: false, isCompleted: false,
  },
}

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ players: [PLAYER], prices: {} }),
  })
})

function renderPage() {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={['/lobby/AB1234/individual']}>
        <Routes>
          <Route path="/lobby/:code/individual" element={<IndividualPage />} />
        </Routes>
      </MemoryRouter>
    </SocketProvider>
  )
}

describe('IndividualPage', () => {
  it('직업 선택 단계를 먼저 보여준다', async () => {
    renderPage()
    expect(await screen.findByText('직업 선택')).toBeInTheDocument()
  })

  it('직업을 선택하면 다음 단계로 진행할 수 있다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('경영·금융'))
    await userEvent.click(screen.getByText('다음'))
    expect(await screen.findByText('성공카드')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it passes on current (pre-refactor) code**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: PASS (2 tests) — 이 시점에는 아직 리팩터 전이므로 기존 인라인 구현으로 통과해야 함

- [ ] **Step 3: Commit**

```bash
git add src/pages/IndividualPage.test.jsx
git commit -m "test: add regression coverage for IndividualPage before refactor"
```

---

### Task 6: `IndividualPage` 리팩터 — 추출한 컴포넌트/상수 사용

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Modify: `src/pages/IndividualPage.module.css`

- [ ] **Step 1: `IndividualPage.jsx` 상단 import/상수를 정리하고 각 스텝을 추출 컴포넌트로 교체**

```jsx
// src/pages/IndividualPage.jsx (전체 교체)
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import StepBar from '../components/StepBar'
import JobPicker from '../components/JobPicker'
import BadgePicker from '../components/BadgePicker'
import AssetListEditor from '../components/AssetListEditor'
import NumberInputModal from '../components/NumberInputModal'
import { useSocketContext } from '../contexts/SocketContext'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../constants/gameData'
import styles from './IndividualPage.module.css'

const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']
const STOCK_PRICE_LABELS = Object.fromEntries(Object.keys(STOCK_LABELS).map(key => [key, '가격 설정']))

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
  const [showCashModal, setShowCashModal] = useState(false)

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
          <JobPicker
            value={gameState.job}
            onChange={job => {
              const next = { ...gameState, job }
              setGameState(next)
              emitState(next)
            }}
          />
        </div>
      )}

      {step === 1 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>성공카드</h1>
          <p className={styles.stepSubtitle}>획득한 성공카드를 모두 선택해주세요</p>
          <BadgePicker
            badges={gameState.badges}
            onToggle={i => {
              const badges = [...gameState.badges]
              badges[i] = !badges[i]
              const next = { ...gameState, badges }
              setGameState(next)
              emitState(next)
            }}
          />
        </div>
      )}

      {step === 2 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>부동산</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <AssetListEditor
            labels={REAL_ESTATE_LABELS}
            images={ESTATE_IMAGES}
            priceLabels={ESTATE_PRICES}
            imageFolder="estate"
            values={gameState.realEstate}
            onChange={(key, val) => {
              const realEstate = { ...gameState.realEstate, [key]: val }
              const next = { ...gameState, realEstate, realEstateVisited: true }
              setGameState(next)
              emitState(next)
            }}
          />
        </div>
      )}

      {step === 3 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>주식</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <AssetListEditor
            labels={STOCK_LABELS}
            images={STOCK_IMAGES}
            priceLabels={STOCK_PRICE_LABELS}
            imageFolder="stock"
            values={gameState.stocks}
            onChange={(key, val) => {
              const stocks = { ...gameState.stocks, [key]: val }
              const next = { ...gameState, stocks, stocksVisited: true }
              setGameState(next)
              emitState(next)
            }}
          />
        </div>
      )}

      {step === 4 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>현금</h1>
          <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
          <div className={styles.cashCard}>
            <span className={styles.cashLabel}>현금 (원)</span>
            <button
              type="button"
              className={styles.cashInputBtn}
              onClick={() => setShowCashModal(true)}
            >
              {cashDisplay === '0' ? (
                <span className={styles.cashPlaceholder}>예: 5000</span>
              ) : (
                <span className={styles.cashValue}>{Number(cashDisplay).toLocaleString()}원</span>
              )}
            </button>
          </div>

          {showCashModal && (
            <NumberInputModal
              title="현금 입력"
              initialValue={Number(cashDisplay)}
              unit="원"
              onConfirm={val => {
                setCashDisplay(String(val))
                setShowCashModal(false)
              }}
              onClose={() => setShowCashModal(false)}
            />
          )}
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

- [ ] **Step 2: `IndividualPage.module.css`에서 `JobPicker`/`BadgePicker`로 옮긴 스타일 제거**

`.jobGrid`, `.badgeGrid`, `.jobTile`, `.tileBadge`, `.badgeTile`, `.tileSelected`, `.jobIcon`, `.tileLabel`, `.badgeImg` 규칙을 삭제한다 (각각 `JobPicker.module.css`/`BadgePicker.module.css`로 이전 완료). `.assetList`는 `AssetListEditor`가 계속 참조하므로 유지한다.

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npx vitest run src/pages/IndividualPage.test.jsx src/components/JobPicker.test.jsx src/components/BadgePicker.test.jsx src/components/AssetListEditor.test.jsx`
Expected: PASS (all)

- [ ] **Step 4: Commit**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.module.css
git commit -m "refactor: use extracted pickers/constants in IndividualPage"
```

---

### Task 7: 서버 — `listAllRooms()`

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

`server/rooms.test.js`의 import 목록에 `listAllRooms`을 추가하고, `describe('createRoom prices', ...)` 블록 아래(또는 파일 끝)에 새 블록 추가:

```js
// server/rooms.test.js — import 라인 수정
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms
} from './rooms.js'
```

```js
// server/rooms.test.js — 파일 끝에 추가
describe('listAllRooms', () => {
  it('생성된 모든 방을 배열로 반환한다', () => {
    const room1 = createRoom()
    const room2 = createRoom()
    const codes = listAllRooms().map(r => r.code)
    expect(codes).toEqual(expect.arrayContaining([room1.code, room2.code]))
    expect(listAllRooms()).toHaveLength(2)
  })

  it('방이 없으면 빈 배열을 반환한다', () => {
    expect(listAllRooms()).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `listAllRooms is not a function`

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `export function getRoom(code) { ... }` 바로 아래에 추가:

```js
export function listAllRooms() {
  return Array.from(rooms.values())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all tests including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add listAllRooms to server room store"
```

---

### Task 8: 서버 — `updatePlayerStateByUuid()`

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/rooms.test.js — import 라인에 updatePlayerStateByUuid 추가
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid
} from './rooms.js'
```

```js
// server/rooms.test.js — 파일 끝에 추가
describe('updatePlayerStateByUuid', () => {
  it('playerUuid로 플레이어를 찾아 gameState를 병합한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = updatePlayerStateByUuid(code, 'p1', { cash: 15000 })
    expect(room.players[0].gameState.cash).toBe(15000)
    expect(room.players[0].gameState.job).toBeNull()
  })

  it('존재하지 않는 방 코드는 null을 반환한다', () => {
    expect(updatePlayerStateByUuid('XXXXXX', 'p1', { cash: 1 })).toBeNull()
  })

  it('존재하지 않는 playerUuid는 null을 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(updatePlayerStateByUuid(code, 'unknown', { cash: 1 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `updatePlayerStateByUuid is not a function`

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `updatePlayerState` 함수 바로 아래에 추가:

```js
export function updatePlayerStateByUuid(code, playerUuid, partialGameState) {
  const room = rooms.get(code)
  if (!room) return null
  const player = room.players.find(p => p.playerUuid === playerUuid)
  if (!player) return null
  player.gameState = { ...player.gameState, ...partialGameState }
  return room
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add updatePlayerStateByUuid for admin edits"
```

---

### Task 9: 서버 — `getAllCompletedTeams()`

**Files:**
- Modify: `server/db.js`
- Modify: `server/db.test.js`

- [ ] **Step 1: Write the failing test**

`server/db.test.js` 파일 끝에 추가:

```js
describe('getAllCompletedTeams', () => {
  it('세션과 결과를 팀 단위로 묶어 room 형태로 반환한다', async () => {
    const sessions = [{
      id: 'session-1', team_code: 'AB1234',
      stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
    }]
    const results = [{
      session_id: 'session-1', player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    }]

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return makeQueryBuilder({ data: sessions, error: null })
      if (table === 'game_results') return makeQueryBuilder({ data: results, error: null })
      throw new Error(`unexpected table: ${table}`)
    })

    const { getAllCompletedTeams } = await import('./db.js')
    const rooms = await getAllCompletedTeams()

    expect(rooms).toEqual([{
      code: 'AB1234',
      status: 'completed',
      registered: true,
      prices: { stocks: PRICES.stocks, realEstate: PRICES.realEstate },
      players: [{
        playerUuid: 'p1', name: '김민준', character: 'lion', affiliation: '서울중',
        gameState: {
          cash: 10000, job: 'a',
          stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      }],
    }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `getAllCompletedTeams is not a function`

- [ ] **Step 3: Write the implementation**

`server/db.js`의 `getGameResult` 함수 아래, `RANKING_SELECT` 선언 위에 추가:

```js
export async function getAllCompletedTeams() {
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('*')
  if (sessionsError) throw sessionsError

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('*')
  if (resultsError) throw resultsError

  return sessions.map(session => ({
    code: session.team_code,
    status: 'completed',
    registered: true,
    prices: { stocks: session.stock_prices, realEstate: session.real_estate_prices },
    players: results
      .filter(r => r.session_id === session.id)
      .map(r => ({
        playerUuid: r.player_uuid,
        name: r.name,
        character: r.character,
        affiliation: r.affiliation,
        gameState: {
          cash: r.cash,
          job: r.job,
          stocks: r.stock_holdings,
          realEstate: r.real_estate_holdings,
          badges: r.badges,
          isCompleted: true,
        },
      })),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/db.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add getAllCompletedTeams for admin dashboard"
```

---

### Task 10: 서버 — `updateGameResult()`

**Files:**
- Modify: `server/db.js`
- Modify: `server/db.test.js`

- [ ] **Step 1: Write the failing test**

`server/db.test.js` 파일 끝에 추가:

```js
describe('updateGameResult', () => {
  it('세션/현재 결과를 조회해 필드를 병합하고 재계산된 자산으로 UPDATE한다', async () => {
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate },
      error: null,
    })
    const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })

    const currentRow = {
      cash: 10000, job: 'a',
      stock_holdings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    }
    const mockCurrentSingle = vi.fn().mockResolvedValue({ data: currentRow, error: null })
    const mockCurrentEqEq = vi.fn().mockReturnValue({ single: mockCurrentSingle })
    const mockCurrentEq = vi.fn().mockReturnValue({ eq: mockCurrentEqEq })
    const mockCurrentSelect = vi.fn().mockReturnValue({ eq: mockCurrentEq })

    const updatedRow = {
      player_uuid: 'p1', name: '김민준', character: 'lion', affiliation: '서울중',
      cash: 20000, job: 'a',
      stock_holdings: currentRow.stock_holdings,
      real_estate_holdings: currentRow.real_estate_holdings,
      badges: currentRow.badges,
    }
    const mockUpdateSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null })
    const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle })
    const mockUpdateEqEq = vi.fn().mockReturnValue({ select: mockUpdateSelect })
    const mockUpdateEq = vi.fn().mockReturnValue({ eq: mockUpdateEqEq })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    let callCount = 0
    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { select: mockSessionSelect }
      if (table === 'game_results') {
        callCount += 1
        return callCount === 1 ? { select: mockCurrentSelect } : { update: mockUpdate }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const { updateGameResult } = await import('./db.js')
    const updated = await updateGameResult('AB1234', 'p1', { cash: 20000 })

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cash: 20000,
      total_assets: 24000,
      stock_value: 4000,
      real_estate_value: 10000,
    }))
    expect(updated.gameState.cash).toBe(20000)
    expect(updated.playerUuid).toBe('p1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `updateGameResult is not a function`

- [ ] **Step 3: Write the implementation**

`server/db.js`의 `getAllCompletedTeams` 함수 아래에 추가:

```js
const GAME_STATE_TO_COLUMN = {
  job: 'job', cash: 'cash', stocks: 'stock_holdings',
  realEstate: 'real_estate_holdings', badges: 'badges',
}

export async function updateGameResult(teamCode, playerUuid, partialGameState) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, stock_prices, real_estate_prices')
    .eq('team_code', teamCode)
    .single()
  if (sessionError) throw sessionError

  const { data: current, error: currentError } = await supabase
    .from('game_results')
    .select('*')
    .eq('session_id', session.id)
    .eq('player_uuid', playerUuid)
    .single()
  if (currentError) throw currentError

  const mergedGameState = {
    cash: current.cash,
    job: current.job,
    stocks: current.stock_holdings,
    realEstate: current.real_estate_holdings,
    badges: current.badges,
    ...partialGameState,
  }

  const prices = { stocks: session.stock_prices, realEstate: session.real_estate_prices }
  const breakdown = calculateAssetBreakdown(mergedGameState, prices)

  const updateRow = {}
  for (const [key, column] of Object.entries(GAME_STATE_TO_COLUMN)) {
    if (key in partialGameState) updateRow[column] = partialGameState[key]
  }
  updateRow.total_assets = breakdown.totalAssets
  updateRow.stock_value = breakdown.stockValue
  updateRow.real_estate_value = breakdown.realEstateValue

  const { data: updated, error: updateError } = await supabase
    .from('game_results')
    .update(updateRow)
    .eq('session_id', session.id)
    .eq('player_uuid', playerUuid)
    .select('*')
    .single()
  if (updateError) throw updateError

  return {
    playerUuid: updated.player_uuid,
    name: updated.name,
    character: updated.character,
    affiliation: updated.affiliation,
    gameState: {
      cash: updated.cash,
      job: updated.job,
      stocks: updated.stock_holdings,
      realEstate: updated.real_estate_holdings,
      badges: updated.badges,
      isCompleted: true,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/db.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add updateGameResult for editing completed teams"
```

---

### Task 11: 서버 — `/api/admin/rooms` 라우트 연결

**Files:**
- Modify: `server/index.js`

기존 라우트들(`/api/rankings`, `/api/results/:sessionId` 등)과 마찬가지로 이 라우트들은 Express 앱 자체에 대한 단위 테스트가 없다(레포 컨벤션 — HTTP 라우팅은 수동 확인). 순수 로직은 Task 7~10에서 이미 테스트했다.

- [ ] **Step 1: import 목록 갱신**

```js
// server/index.js — 상단 import 수정
import { createRoom, getRoom, addPlayer, removePlayer, updatePlayerState, updateRoomPrices, kickPlayer, listAllRooms, updatePlayerStateByUuid } from './rooms.js'
import { saveGameResult, getGameResult, getAllRankings, getBoothRankings, getAllCompletedTeams, updateGameResult } from './db.js'
```

- [ ] **Step 2: `/api/rankings` 라우트 아래에 두 라우트 추가**

```js
// server/index.js — app.get('/api/rankings', ...) 블록 다음에 추가
app.get('/api/admin/rooms', async (_req, res) => {
  try {
    const liveRooms = listAllRooms().map(room => ({
      code: room.code,
      status: 'live',
      registered: false,
      prices: room.prices,
      players: room.players.map(p => ({
        playerUuid: p.playerUuid,
        name: p.name,
        character: p.character,
        affiliation: p.affiliation,
        gameState: p.gameState,
      })),
    }))
    const completedRooms = await getAllCompletedTeams()
    res.json([...liveRooms, ...completedRooms])
  } catch (err) {
    console.error('admin rooms error:', err)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

app.patch('/api/admin/rooms/:code/players/:playerUuid', async (req, res) => {
  const code = req.params.code.toUpperCase()
  const { playerUuid } = req.params
  const partialGameState = req.body

  const room = updatePlayerStateByUuid(code, playerUuid, partialGameState)
  if (room) {
    io.to(code).emit('room-updated', { players: room.players })
    const player = room.players.find(p => p.playerUuid === playerUuid)
    return res.json({
      playerUuid: player.playerUuid,
      name: player.name,
      character: player.character,
      affiliation: player.affiliation,
      gameState: player.gameState,
    })
  }

  try {
    const updatedPlayer = await updateGameResult(code, playerUuid, partialGameState)
    res.json(updatedPlayer)
  } catch (err) {
    console.error('admin patch error:', err)
    res.status(404).json({ error: 'Player not found' })
  }
})
```

- [ ] **Step 3: 수동으로 서버를 띄워 확인**

Run: `npm run dev`

다른 터미널에서:
```bash
curl http://localhost:3001/api/admin/rooms
```
Expected: `[]` (진행중/완료 팀이 없는 상태라면). 방을 하나 만들고(`curl -X POST http://localhost:3001/api/rooms`) 다시 호출하면 `status: "live"`인 방 하나가 배열에 포함되어야 한다.

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: wire GET/PATCH /api/admin/rooms routes"
```

---

### Task 12: `AdminPlayerCard` 컴포넌트

**Files:**
- Create: `src/components/admin/AdminPlayerCard.jsx`
- Create: `src/components/admin/AdminPlayerCard.module.css`
- Test: `src/components/admin/AdminPlayerCard.test.jsx`

`design/관리자 관전.png`의 2×2 카드 한 칸에 해당. 캐릭터/이름/직업/총자산/성공카드·부동산·주식 이모지를 보여주고 우측 상단 수정 버튼을 제공한다.

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/admin/AdminPlayerCard.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminPlayerCard from './AdminPlayerCard'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const PLAYER = {
  playerUuid: 'p1', name: '김민준', character: 'Innovator-사자', affiliation: '서울중',
  gameState: {
    cash: 125000, job: 'a',
    stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [true, false, false, false, false, false],
    isCompleted: true,
  },
}

describe('AdminPlayerCard', () => {
  it('이름/직업/총자산을 보여준다', () => {
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('경영·금융')).toBeInTheDocument()
    expect(screen.getByText('135,000원')).toBeInTheDocument()
  })

  it('직업 미입력 시 안내 문구를 보여준다', () => {
    const player = { ...PLAYER, gameState: { ...PLAYER.gameState, job: null } }
    render(<AdminPlayerCard player={player} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('직업 미입력')).toBeInTheDocument()
  })

  it('수정 버튼 클릭 시 onEdit을 호출한다', async () => {
    const onEdit = vi.fn()
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={onEdit} />)
    await userEvent.click(screen.getByText('수정'))
    expect(onEdit).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminPlayerCard.test.jsx`
Expected: FAIL — `Cannot find module './AdminPlayerCard'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/AdminPlayerCard.jsx
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import {
  JOB_LABELS, BADGE_NAMES,
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../../constants/gameData'
import styles from './AdminPlayerCard.module.css'

export default function AdminPlayerCard({ player, prices, onEdit }) {
  const { gameState } = player
  const { totalAssets } = calculateAssetBreakdown(gameState, prices)
  const earnedBadges = BADGE_NAMES.filter((_, i) => gameState.badges[i])
  const ownedRealEstate = Object.keys(REAL_ESTATE_LABELS).filter(key => gameState.realEstate[key] > 0)
  const ownedStocks = Object.keys(STOCK_LABELS).filter(key => gameState.stocks[key] > 0)

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <img src={`/characters/${player.character}.png`} alt={player.character} className={styles.avatar} />
        <div className={styles.identity}>
          <span className={styles.name}>{player.name}</span>
          <span className={styles.job}>{gameState.job ? JOB_LABELS[gameState.job] : '직업 미입력'}</span>
        </div>
        <button type="button" className={styles.editBtn} onClick={onEdit}>수정</button>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>총 자산</span>
        <span className={styles.totalAssets}>{totalAssets.toLocaleString()}원</span>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>성공카드</span>
        <div className={styles.iconRow}>
          {earnedBadges.map(name => (
            <img key={name} src={`/badges/${name}.png`} alt={name} className={styles.badgeIcon} />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>부동산</span>
        <div className={styles.iconRow}>
          {ownedRealEstate.map(key => (
            <span key={key} className={styles.iconCount}>
              <img
                src={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                alt={REAL_ESTATE_LABELS[key]}
                className={styles.assetIcon}
              />
              {gameState.realEstate[key]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>주식</span>
        <div className={styles.iconRow}>
          {ownedStocks.map(key => (
            <span key={key} className={styles.iconCount}>
              <img
                src={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                alt={STOCK_LABELS[key]}
                className={styles.assetIcon}
              />
              {gameState.stocks[key]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

```css
/* src/components/admin/AdminPlayerCard.module.css */
.card {
  background: var(--white);
  border: 1px solid var(--divider);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header { display: flex; align-items: center; gap: 10px; }

.avatar { width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; }

.identity { display: flex; flex-direction: column; flex: 1; min-width: 0; }

.name { font-size: 16px; font-weight: 800; color: var(--ink); }

.job { font-size: 12px; font-weight: 700; color: var(--ink-2); }

.editBtn {
  background: var(--purple);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--r-pill);
  padding: 6px 14px;
  flex-shrink: 0;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-top: 1px solid var(--divider);
  padding-top: 10px;
}

.rowLabel { font-size: 12px; font-weight: 700; color: var(--ink-2); }

.totalAssets { font-size: 16px; font-weight: 900; color: var(--ink); }

.section { display: flex; flex-direction: column; gap: 6px; }

.sectionLabel { font-size: 11px; font-weight: 700; color: var(--ghost); }

.iconRow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 24px; }

.badgeIcon, .assetIcon { width: 22px; height: 22px; object-fit: contain; }

.iconCount {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminPlayerCard.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminPlayerCard.jsx src/components/admin/AdminPlayerCard.module.css src/components/admin/AdminPlayerCard.test.jsx
git commit -m "feat: add AdminPlayerCard component"
```

---

### Task 13: `JobEditModal`, `BadgeEditModal`

**Files:**
- Create: `src/components/admin/JobEditModal.jsx`
- Create: `src/components/admin/BadgeEditModal.jsx`
- Create: `src/components/admin/FieldEditModal.module.css` (두 모달이 공유)
- Test: `src/components/admin/JobEditModal.test.jsx`
- Test: `src/components/admin/BadgeEditModal.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/admin/JobEditModal.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JobEditModal from './JobEditModal'

describe('JobEditModal', () => {
  it('직업 타일 클릭 시 onChange를 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<JobEditModal value="a" onChange={onChange} onClose={onClose} />)
    await userEvent.click(screen.getByText('보건·교육'))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<JobEditModal value="a" onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

```jsx
// src/components/admin/BadgeEditModal.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgeEditModal from './BadgeEditModal'

const NONE = [false, false, false, false, false, false]

describe('BadgeEditModal', () => {
  it('카드 클릭 시 onToggle을 해당 인덱스로 호출한다', async () => {
    const onToggle = vi.fn()
    render(<BadgeEditModal badges={NONE} onToggle={onToggle} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('문제해결능력'))
    expect(onToggle).toHaveBeenCalledWith(2)
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<BadgeEditModal badges={NONE} onToggle={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/JobEditModal.test.jsx src/components/admin/BadgeEditModal.test.jsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/JobEditModal.jsx
import JobPicker from '../JobPicker'
import styles from './FieldEditModal.module.css'

export default function JobEditModal({ value, onChange, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>직업 수정</span>
        </div>
        <JobPicker value={value} onChange={onChange} />
      </div>
    </div>
  )
}
```

```jsx
// src/components/admin/BadgeEditModal.jsx
import BadgePicker from '../BadgePicker'
import styles from './FieldEditModal.module.css'

export default function BadgeEditModal({ badges, onToggle, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>성공카드 수정</span>
        </div>
        <BadgePicker badges={badges} onToggle={onToggle} />
      </div>
    </div>
  )
}
```

```css
/* src/components/admin/FieldEditModal.module.css */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
}

.sheet {
  background: var(--white);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  width: min(420px, 92vw);
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.backBtn { font-size: 14px; font-weight: 700; color: var(--ink-2); }

.title { font-size: 16px; font-weight: 800; color: var(--ink); }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/JobEditModal.test.jsx src/components/admin/BadgeEditModal.test.jsx`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/JobEditModal.jsx src/components/admin/BadgeEditModal.jsx src/components/admin/FieldEditModal.module.css src/components/admin/JobEditModal.test.jsx src/components/admin/BadgeEditModal.test.jsx
git commit -m "feat: add JobEditModal and BadgeEditModal"
```

---

### Task 14: `RealEstateEditModal`, `StockEditModal`

**Files:**
- Create: `src/components/admin/RealEstateEditModal.jsx`
- Create: `src/components/admin/StockEditModal.jsx`
- Test: `src/components/admin/RealEstateEditModal.test.jsx`
- Test: `src/components/admin/StockEditModal.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/admin/RealEstateEditModal.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RealEstateEditModal from './RealEstateEditModal'

const VALUES = { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('RealEstateEditModal', () => {
  it('+ 버튼 클릭 시 onChange를 병합된 부동산 객체로 호출한다', async () => {
    const onChange = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={onChange} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByLabelText('수량 증가')[1])
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, nuri: 1 })
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

```jsx
// src/components/admin/StockEditModal.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StockEditModal from './StockEditModal'

const VALUES = { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 }

describe('StockEditModal', () => {
  it('+ 버튼 클릭 시 onChange를 병합된 주식 객체로 호출한다', async () => {
    const onChange = vi.fn()
    render(<StockEditModal values={VALUES} onChange={onChange} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByLabelText('수량 증가')[1])
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, finance: 1 })
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<StockEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/RealEstateEditModal.test.jsx src/components/admin/StockEditModal.test.jsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/RealEstateEditModal.jsx
import AssetListEditor from '../AssetListEditor'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

export default function RealEstateEditModal({ values, onChange, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>부동산 수정</span>
        </div>
        <AssetListEditor
          labels={REAL_ESTATE_LABELS}
          images={ESTATE_IMAGES}
          priceLabels={ESTATE_PRICES}
          imageFolder="estate"
          values={values}
          onChange={(key, val) => onChange({ ...values, [key]: val })}
        />
      </div>
    </div>
  )
}
```

```jsx
// src/components/admin/StockEditModal.jsx
import AssetListEditor from '../AssetListEditor'
import { STOCK_LABELS, STOCK_IMAGES } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

const STOCK_PRICE_LABELS = Object.fromEntries(Object.keys(STOCK_LABELS).map(key => [key, '가격 설정']))

export default function StockEditModal({ values, onChange, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>주식 수정</span>
        </div>
        <AssetListEditor
          labels={STOCK_LABELS}
          images={STOCK_IMAGES}
          priceLabels={STOCK_PRICE_LABELS}
          imageFolder="stock"
          values={values}
          onChange={(key, val) => onChange({ ...values, [key]: val })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/RealEstateEditModal.test.jsx src/components/admin/StockEditModal.test.jsx`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/RealEstateEditModal.jsx src/components/admin/StockEditModal.jsx src/components/admin/RealEstateEditModal.test.jsx src/components/admin/StockEditModal.test.jsx
git commit -m "feat: add RealEstateEditModal and StockEditModal"
```

---

### Task 15: `AdminEditModal` 컴포넌트

**Files:**
- Create: `src/components/admin/AdminEditModal.jsx`
- Create: `src/components/admin/AdminEditModal.module.css`
- Test: `src/components/admin/AdminEditModal.test.jsx`

`design/관리자 수정.png` 기준 두 열 카드(직업/성공카드/현금 | 부동산/주식) + 하단 총자산. 각 섹션의 `수정` 버튼이 Task 13/14의 모달을 연다. 필드 변경 시 `onSave(field, value)`를 호출해 부모(AdminSpectateModal)가 PATCH 요청을 보내도록 위임한다 — 네트워크 호출은 AdminEditModal이 아니라 상위에서 처리(단일 책임 유지, 테스트도 쉬워짐).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/admin/AdminEditModal.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminEditModal from './AdminEditModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const PLAYER = {
  playerUuid: 'p1', name: '김민준', character: 'Innovator-사자', affiliation: '서울중',
  gameState: {
    cash: 125000, job: 'a',
    stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [true, false, false, false, false, false],
    isCompleted: true,
  },
}

describe('AdminEditModal', () => {
  it('직업/현금/총자산 값을 보여준다', () => {
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('경영·금융')).toBeInTheDocument()
    expect(screen.getByText('125,000원')).toBeInTheDocument()
    expect(screen.getByText('135,000원')).toBeInTheDocument()
  })

  it('직업 수정 버튼 클릭 후 직업 선택 시 onSave("job", key)를 호출한다', async () => {
    const onSave = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByTestId('edit-job'))
    await userEvent.click(screen.getByText('보건·교육'))
    expect(onSave).toHaveBeenCalledWith('job', 'c')
  })

  it('현금 수정 시 onSave("cash", value)를 호출한다', async () => {
    const onSave = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByTestId('edit-cash'))
    await userEvent.click(screen.getByText('5'))
    await userEvent.click(screen.getByText('확인'))
    expect(onSave).toHaveBeenCalledWith('cash', 5)
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminEditModal.test.jsx`
Expected: FAIL — `Cannot find module './AdminEditModal'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/AdminEditModal.jsx
import { useState } from 'react'
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import { JOB_LABELS, BADGE_NAMES } from '../../constants/gameData'
import NumberInputModal from '../NumberInputModal'
import JobEditModal from './JobEditModal'
import BadgeEditModal from './BadgeEditModal'
import RealEstateEditModal from './RealEstateEditModal'
import StockEditModal from './StockEditModal'
import styles from './AdminEditModal.module.css'

export default function AdminEditModal({ player, prices, onSave, onClose }) {
  const [editingField, setEditingField] = useState(null)
  const { gameState } = player
  const { totalAssets } = calculateAssetBreakdown(gameState, prices)
  const earnedBadges = BADGE_NAMES.filter((_, i) => gameState.badges[i])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
        <img src={`/characters/${player.character}.png`} alt={player.character} className={styles.avatar} />
        <span className={styles.name}>{player.name}</span>
      </div>

      <div className={styles.columns}>
        <div className={styles.card}>
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>직업</span>
              <button type="button" data-testid="edit-job" className={styles.editBtn} onClick={() => setEditingField('job')}>수정</button>
            </div>
            <span className={styles.fieldValue}>{gameState.job ? JOB_LABELS[gameState.job] : '미입력'}</span>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>성공카드</span>
              <button type="button" data-testid="edit-badges" className={styles.editBtn} onClick={() => setEditingField('badges')}>수정</button>
            </div>
            <div className={styles.chipRow}>
              {earnedBadges.length === 0 && <span className={styles.fieldValue}>미입력</span>}
              {earnedBadges.map(name => <span key={name} className={styles.chip}>{name}</span>)}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>현금</span>
              <button type="button" data-testid="edit-cash" className={styles.editBtn} onClick={() => setEditingField('cash')}>수정</button>
            </div>
            <span className={styles.fieldValue}>{(gameState.cash ?? 0).toLocaleString()}원</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>부동산</span>
              <button type="button" data-testid="edit-realEstate" className={styles.editBtn} onClick={() => setEditingField('realEstate')}>수정</button>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>주식</span>
              <button type="button" data-testid="edit-stocks" className={styles.editBtn} onClick={() => setEditingField('stocks')}>수정</button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLabel}>총 자산</span>
        <span className={styles.footerValue}>{totalAssets.toLocaleString()}원</span>
      </div>

      {editingField === 'job' && (
        <JobEditModal
          value={gameState.job}
          onChange={val => { onSave('job', val); setEditingField(null) }}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'badges' && (
        <BadgeEditModal
          badges={gameState.badges}
          onToggle={i => {
            const badges = [...gameState.badges]
            badges[i] = !badges[i]
            onSave('badges', badges)
          }}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'cash' && (
        <NumberInputModal
          title="현금 수정"
          initialValue={gameState.cash ?? 0}
          unit="원"
          onConfirm={val => { onSave('cash', val); setEditingField(null) }}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'realEstate' && (
        <RealEstateEditModal
          values={gameState.realEstate}
          onChange={val => onSave('realEstate', val)}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'stocks' && (
        <StockEditModal
          values={gameState.stocks}
          onChange={val => onSave('stocks', val)}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: `AdminEditModal.module.css` 작성**

```css
/* src/components/admin/AdminEditModal.module.css */
.page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.header { display: flex; align-items: center; gap: 10px; }

.backBtn { font-size: 14px; font-weight: 700; color: var(--ink-2); }

.avatar { width: 36px; height: 36px; object-fit: contain; }

.name { font-size: 18px; font-weight: 800; color: var(--ink); }

.columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

.card {
  background: var(--white);
  border: 1px solid var(--divider);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field { display: flex; flex-direction: column; gap: 6px; }

.fieldHeader { display: flex; justify-content: space-between; align-items: center; }

.fieldLabel { font-size: 12px; font-weight: 700; color: var(--ghost); }

.fieldValue { font-size: 15px; font-weight: 800; color: var(--ink); }

.editBtn {
  background: var(--slot-empty);
  color: var(--purple);
  font-size: 11px;
  font-weight: 700;
  border-radius: var(--r-pill);
  padding: 4px 12px;
}

.chipRow { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  background: var(--slot-empty);
  border-radius: var(--r-pill);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ink);
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 8px;
  border-top: 1px solid var(--divider);
  padding-top: 12px;
}

.footerLabel { font-size: 13px; font-weight: 700; color: var(--ink-2); }

.footerValue { font-size: 22px; font-weight: 900; color: var(--ink); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminEditModal.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminEditModal.jsx src/components/admin/AdminEditModal.module.css src/components/admin/AdminEditModal.test.jsx
git commit -m "feat: add AdminEditModal component"
```

---

### Task 16: `AdminSpectateModal` 컴포넌트

**Files:**
- Create: `src/components/admin/AdminSpectateModal.jsx`
- Create: `src/components/admin/AdminSpectateModal.module.css`
- Test: `src/components/admin/AdminSpectateModal.test.jsx`

`design/관리자 관전.png` 기준 상단 팀 이동 바 + 2×2 `AdminPlayerCard` 그리드. 카드의 `수정` 클릭 시 같은 팝업 안에서 `AdminEditModal`로 전환한다. `rooms`/`onPlayerUpdate`는 `AdminDashboard`가 소유한 상태를 그대로 내려받는다 (Task 17에서 연결).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/admin/AdminSpectateModal.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminSpectateModal from './AdminSpectateModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makeRoom(code, name) {
  return {
    code, status: 'live', registered: false, prices: PRICES,
    players: [{
      playerUuid: `${code}-p1`, name, character: 'Innovator-사자', affiliation: '서울중',
      gameState: {
        cash: 10000, job: 'a',
        stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
        realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
        badges: [false, false, false, false, false, false],
        isCompleted: false,
      },
    }],
  }
}

const ROOMS = [makeRoom('AB1234', '김민준'), makeRoom('CD5678', '이서연')]

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
})

describe('AdminSpectateModal', () => {
  it('1팀 관전 화면을 보여주고 팀원 카드를 렌더링한다', () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('1팀')).toBeInTheDocument()
    expect(screen.getByText('김민준')).toBeInTheDocument()
  })

  it('다음 화살표 클릭 시 다음 팀으로 이동한다', async () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('다음 팀'))
    expect(screen.getByText('2팀')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
  })

  it('플레이어 카드의 수정 버튼 클릭 시 AdminEditModal로 전환된다', async () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('수정'))
    expect(screen.getByTestId('edit-job')).toBeInTheDocument()
  })

  it('‹ 뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: FAIL — `Cannot find module './AdminSpectateModal'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/AdminSpectateModal.jsx
import { useState, useEffect, useRef } from 'react'
import AdminPlayerCard from './AdminPlayerCard'
import AdminEditModal from './AdminEditModal'
import styles from './AdminSpectateModal.module.css'

const POLL_INTERVAL_MS = 3000

export default function AdminSpectateModal({ rooms, initialIndex, onPlayerUpdate, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const [editingPlayerUuid, setEditingPlayerUuid] = useState(null)
  const room = rooms[index]
  const pollTimer = useRef(null)

  useEffect(() => {
    if (room.status !== 'live') return undefined
    pollTimer.current = setInterval(() => {
      fetch(`/api/rooms/${room.code}`)
        .then(r => r.json())
        .then(data => {
          data.players?.forEach(player => onPlayerUpdate(room.code, player))
        })
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(pollTimer.current)
  }, [room.code, room.status, onPlayerUpdate])

  async function handleSave(playerUuid, field, value) {
    const res = await fetch(`/api/admin/rooms/${room.code}/players/${playerUuid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) return
    const updated = await res.json()
    onPlayerUpdate(room.code, updated)
  }

  if (editingPlayerUuid) {
    const player = room.players.find(p => p.playerUuid === editingPlayerUuid)
    return (
      <AdminEditModal
        player={player}
        prices={room.prices}
        onSave={(field, value) => handleSave(editingPlayerUuid, field, value)}
        onClose={() => setEditingPlayerUuid(null)}
      />
    )
  }

  const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)

  return (
    <div className={styles.page}>
      <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navArrow}
          aria-label="이전 팀"
          disabled={index === 0}
          onClick={() => setIndex(i => Math.max(0, i - 1))}
        >
          ‹
        </button>
        <div className={styles.navTitle}>
          <span className={styles.teamName}>{index + 1}팀</span>
          <span className={styles.teamCount}>{index + 1} / {rooms.length}</span>
        </div>
        <button
          type="button"
          className={styles.navArrow}
          aria-label="다음 팀"
          disabled={index === rooms.length - 1}
          onClick={() => setIndex(i => Math.min(rooms.length - 1, i + 1))}
        >
          ›
        </button>
      </div>

      <div className={styles.dots}>
        {rooms.map((r, i) => (
          <span key={r.code} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
        ))}
      </div>

      <div className={styles.grid}>
        {slots.map((player, i) => (
          player ? (
            <AdminPlayerCard
              key={player.playerUuid}
              player={player}
              prices={room.prices}
              onEdit={() => setEditingPlayerUuid(player.playerUuid)}
            />
          ) : (
            <div key={i} className={styles.emptySlot}>대기중</div>
          )
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `AdminSpectateModal.module.css` 작성**

```css
/* src/components/admin/AdminSpectateModal.module.css */
.page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.backBtn { align-self: flex-start; font-size: 14px; font-weight: 700; color: var(--ink-2); }

.nav { display: flex; align-items: center; justify-content: space-between; }

.navArrow {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--slot-empty);
  color: var(--ink);
  font-size: 18px;
}

.navArrow:disabled { opacity: 0.3; }

.navTitle { display: flex; flex-direction: column; align-items: center; gap: 2px; }

.teamName { font-size: 22px; font-weight: 900; color: var(--ink); }

.teamCount { font-size: 12px; font-weight: 700; color: var(--ghost); }

.dots { display: flex; justify-content: center; gap: 6px; }

.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--divider); }

.dotActive { background: var(--purple); }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

.emptySlot {
  min-height: 160px;
  border-radius: var(--r-sm);
  background: var(--slot-empty);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--ghost);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "feat: add AdminSpectateModal component"
```

---

### Task 17: `AdminDashboard` — 실데이터 연동 + `AdminSpectateModal` 교체

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`
- Modify: `src/pages/AdminDashboard.module.css`

- [ ] **Step 1: `AdminDashboard.jsx` 전체 교체**

```jsx
// src/pages/AdminDashboard.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import AdminSpectateModal from '../components/admin/AdminSpectateModal'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰' },
  { key: 'table', label: '테이블 뷰' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('grid')
  const [rooms, setRooms] = useState([])
  const [spectateIndex, setSpectateIndex] = useState(null)

  const loadRooms = useCallback(() => {
    fetch('/api/admin/rooms')
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.body.classList.add('admin-mode')
    loadRooms()
    return () => document.body.classList.remove('admin-mode')
  }, [loadRooms])

  function handlePlayerUpdate(code, updatedPlayer) {
    setRooms(prev => prev.map(room => {
      if (room.code !== code) return room
      return {
        ...room,
        players: room.players.map(p => (p.playerUuid === updatedPlayer.playerUuid ? updatedPlayer : p)),
      }
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>관리자 모드</h1>
          <p className={styles.subtitle}>진행중인 팀과 완료된 팀을 확인하고 수정할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadRooms} type="button">↻ 새로고침</button>
          <button className={styles.exitBtn} onClick={() => navigate('/')} type="button">← 나가기</button>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'grid' && (
        <AdminGridView rooms={rooms} onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))} />
      )}
      {activeTab === 'table' && <AdminTableView rooms={rooms} />}

      {spectateIndex !== null && (
        <div className={styles.overlay} onClick={() => setSpectateIndex(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <AdminSpectateModal
              rooms={rooms}
              initialIndex={spectateIndex}
              onPlayerUpdate={handlePlayerUpdate}
              onClose={() => setSpectateIndex(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `AdminDashboard.module.css`에 새 버튼 스타일 추가**

`.exitBtn` 규칙 위에 추가:

```css
/* src/pages/AdminDashboard.module.css — .header 아래에 추가 */
.headerActions { display: flex; gap: 8px; }

.refreshBtn {
  background: var(--slot-empty);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  height: 44px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
}
```

기존 `.closeBtn` 규칙(더 이상 사용되지 않음 — `AdminSpectateModal`이 자체 `‹ 뒤로` 버튼을 제공)은 삭제한다.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.jsx src/pages/AdminDashboard.module.css
git commit -m "feat: wire AdminDashboard to real data and AdminSpectateModal"
```

---

### Task 18: `AdminDashboard.test.jsx` 갱신

**Files:**
- Modify: `src/pages/AdminDashboard.test.jsx`

기존 테스트는 `ADMIN_MOCK_ROOMS`(고정 목업)에 의존하고 있었다. 이제 `fetch('/api/admin/rooms')` 응답에 의존하므로 fetch를 모킹하도록 갱신한다.

- [ ] **Step 1: 테스트 전체 교체**

```jsx
// src/pages/AdminDashboard.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminDashboard from './AdminDashboard'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const ROOMS = [{
  code: 'CD5678', status: 'live', registered: false, prices: PRICES,
  players: [{
    playerUuid: 'p1', name: '홍길동', character: 'Adventurer-강아지', affiliation: '서울중',
    gameState: {
      cash: 15000, job: 'a',
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
      isCompleted: false,
    },
  }],
}]

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  )
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(ROOMS) })
})

afterEach(() => {
  document.body.classList.remove('admin-mode')
})

describe('AdminDashboard', () => {
  it('마운트 시 admin-mode 바디 클래스를 추가한다', async () => {
    renderDashboard()
    expect(document.body.classList.contains('admin-mode')).toBe(true)
    await screen.findByText('홍길동')
  })

  it('언마운트 시 admin-mode 바디 클래스를 제거한다', () => {
    const { unmount } = renderDashboard()
    unmount()
    expect(document.body.classList.contains('admin-mode')).toBe(false)
  })

  it('/api/admin/rooms에서 받은 팀을 그리드 뷰에 보여준다', async () => {
    renderDashboard()
    expect(await screen.findByText('홍길동')).toBeInTheDocument()
    expect(screen.queryByText('CD5678')).not.toBeInTheDocument()
  })

  it('테이블 뷰 탭 클릭 시 테이블을 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('테이블 뷰'))
    expect(screen.getByText('이름')).toBeInTheDocument()
  })

  it('팀 카드 클릭 시 관전 팝업을 연다', async () => {
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /홍길동/ }))
    expect(screen.getByText('1팀')).toBeInTheDocument()
  })

  it('‹ 뒤로 클릭 시 팝업을 닫는다', async () => {
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /홍길동/ }))
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(screen.queryByText('1팀')).toBeNull()
  })

  it('새로고침 버튼 클릭 시 /api/admin/rooms를 다시 호출한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    global.fetch.mockClear()
    await userEvent.click(screen.getByText('↻ 새로고침'))
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/pages/AdminDashboard.test.jsx`
Expected: PASS (7 tests)

이 테스트는 이제 `SocketProvider`/`socket.io-client` 목이 필요 없다 — `AdminDashboard`가 더 이상 소켓을 직접 쓰지 않기 때문(폴링은 `AdminSpectateModal` 내부에서 `fetch`로 처리).

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.test.jsx
git commit -m "test: update AdminDashboard tests for real data flow"
```

---

### Task 19: 목업 데이터 삭제

**Files:**
- Delete: `src/data/adminMockData.js`
- Delete: `src/data/adminMockData.test.js`

- [ ] **Step 1: 파일 삭제**

```bash
git rm src/data/adminMockData.js src/data/adminMockData.test.js
```

- [ ] **Step 2: 남은 참조가 없는지 확인**

Run: `grep -r "adminMockData\|ADMIN_MOCK" src/ server/`
Expected: 결과 없음

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove admin mock data now that real data is wired up"
```

---

### Task 20: 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run`
Expected: 모든 테스트 PASS, 실패 0건

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료

- [ ] **Step 3: 수동 스모크 테스트**

Run: `npm run dev`

브라우저에서 확인:
1. `http://localhost:5173/admin` 접속 → 그리드 뷰가 빈 상태(또는 실제 진행중/완료 팀)로 뜨는지 확인
2. 별도 탭에서 실제로 방을 하나 만들고(`/` → 팀 만들기) 관리자 대시보드에서 `새로고침` 클릭 → 방금 만든 팀이 카드로 보이는지 확인
3. 카드 클릭 → 관전 팝업에서 `N팀` 타이틀, 팀원 카드, 좌우 화살표가 목업(`design/관리자 관전.png`)과 유사하게 보이는지 확인
4. 카드의 `수정` 클릭 → `관리자 수정.png`처럼 두 열 카드 + 총자산이 보이는지 확인
5. 직업/성공카드/현금/부동산/주식 각각 수정 → 총자산이 즉시 갱신되는지, 그리고 해당 팀의 플레이어 탭(다른 브라우저 탭에서 그 팀 로비/개인 화면을 열어둔 상태)에도 변경이 반영되는지 확인
6. 테이블 뷰 탭에서도 동일한 데이터가 행으로 보이는지 확인

- [ ] **Step 4: 최종 커밋 (필요 시)**

스모크 테스트 중 사소한 수정이 있었다면:

```bash
git add -A
git commit -m "fix: address issues found during manual smoke test"
```

---

## Spec Coverage Checklist

- 관리자 관전 팝업을 목업대로 재구성 (Task 16)
- 관리자 수정 화면 신규 구현 (Task 13, 14, 15)
- 자산 수정 시 플레이어 온보딩과 동일한 입력 UI 재사용 (Task 2, 3, 4, 6)
- 목업 데이터 제거, 실데이터 연동 (Task 7~11, 17, 19)
- 진행중 팀 수정 → 플레이어 화면 즉시 반영 (Task 11의 `room-updated` 브로드캐스트)
- 완료된 팀도 수정 가능 (Task 10)
- 관전 팝업 열려있는 동안 3초 폴링 (Task 16)
- `/admin` 인증은 범위 밖 — 변경 없음
