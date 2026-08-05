# 사용자 피드백 3건 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 주식/부동산 가격·수량에 상한을 걸고 기존 DB 데이터를 백필하며, (2) 자산 입력 화면에서 뒤로가기 시 확인창을 띄우고 재입장 시 실제 진행 상태를 정확히 복원하고, (3) 랭킹 페이지의 "소속" 개념을 실제 "수업"(class) 기반으로 바꾸고 팀코드 표시를 제거한다.

**Architecture:** 가격/수량 상한은 기존 `MAX_CASH` 패턴을 그대로 따라 `NumberInputModal`의 `maxValue` prop으로 클라이언트에서만 제한한다. 자산 입력 화면은 `Team.jsx`에 이미 있는 `LeaveConfirmModal` 패턴을 재사용하고, `stocksVisited`/`realEstateVisited`와 동일한 방식의 `badgesVisited` 플래그를 추가해 재입장 시 진행 상태를 정확히 계산한다. 랭킹은 이미 DB에 존재하는 `game_sessions.class_id`를 `classes` 테이블과 조인해 수업 이름을 내려주고, 클라이언트는 `affiliation` 필터링 로직을 `classId` 필터링으로 교체한다.

**Tech Stack:** React + vitest/@testing-library/react (클라이언트), Node.js/Express (서버), Supabase(PostgreSQL) — `server/supabase.js`를 통한 접근.

**Spec:** `docs/superpowers/specs/2026-08-05-user-feedback-design.md`

---

## Group A — 주식/부동산 가격·수량 상한

### Task 1: `src/constants/gameData.js` — 상한 상수 추가

**Files:**
- Modify: `src/constants/gameData.js`
- Test: `src/constants/gameData.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/constants/gameData.test.js`의 import 목록에 `MAX_ASSET_PRICE, MAX_ASSET_QUANTITY`를 추가하고, `describe` 블록 끝에 테스트를 추가한다:

```js
import {
  JOB_LABELS, JOB_ICONS, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES,
  STOCK_LABELS, STOCK_IMAGES, ROOM_STATUS_LABELS,
  MAX_ASSET_PRICE, MAX_ASSET_QUANTITY,
} from './gameData'
```

```js
  it('자산 가격/수량 상한값이 정의되어 있다', () => {
    expect(MAX_ASSET_PRICE).toBe(1000000)
    expect(MAX_ASSET_QUANTITY).toBe(100)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/constants/gameData.test.js`
Expected: FAIL — `MAX_ASSET_PRICE`/`MAX_ASSET_QUANTITY`가 `undefined`.

- [ ] **Step 3: 상수 추가**

`src/constants/gameData.js`의 `MAX_CASH` 정의 바로 아래에 추가:

```js
export const MAX_CASH = 1000000000

export const MAX_ASSET_PRICE = 1000000
export const MAX_ASSET_QUANTITY = 100
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/constants/gameData.test.js`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/constants/gameData.js src/constants/gameData.test.js
git commit -m "feat: add MAX_ASSET_PRICE and MAX_ASSET_QUANTITY constants"
```

---

### Task 2: `QuantitySelector` — 수량 100개 상한

**Files:**
- Modify: `src/components/QuantitySelector.jsx`
- Test: `src/components/QuantitySelector.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/QuantitySelector.test.jsx`에서 기존 두 테스트를 교체하고 새 테스트를 추가한다. 아래 두 테스트를:

```js
  it('값이 10 이상이어도 + 버튼이 비활성화되지 않는다', () => {
    render(<QuantitySelector value={10} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 증가')).not.toBeDisabled()
  })

  it('값이 10일 때 + 버튼을 클릭하면 11을 전달한다 (상한 없음)', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={10} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(11)
  })
```

다음으로 교체:

```js
  it('값이 100 미만이면 + 버튼이 비활성화되지 않는다', () => {
    render(<QuantitySelector value={10} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 증가')).not.toBeDisabled()
  })

  it('값이 99일 때 + 버튼을 클릭하면 100을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={99} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('값이 100이면 + 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={100} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 증가')).toBeDisabled()
  })

  it('수량 입력 팝업에서 100을 초과하는 값을 입력해도 확인 시 100으로 제한된다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith(100)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/QuantitySelector.test.jsx`
Expected: FAIL — 새로 추가한 4개 테스트(100 상한 관련)가 실패. 상한이 없으므로 `+` 버튼이 100에서 비활성화되지 않고, `onChange`가 100이 아닌 값으로 호출됨.

- [ ] **Step 3: 상한 구현**

`src/components/QuantitySelector.jsx` 전체를 다음으로 교체:

```jsx
import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import { MAX_ASSET_QUANTITY } from '../constants/gameData'
import styles from './QuantitySelector.module.css'

export default function QuantitySelector({ value, onChange, label }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className={styles.stepper}>
      <button
        className={styles.minusBtn}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label="수량 감소"
      >
        −
      </button>
      <button type="button" className={styles.count} onClick={() => setShowModal(true)}>
        {value}
      </button>
      <button
        className={styles.plusBtn}
        onClick={() => onChange(Math.min(MAX_ASSET_QUANTITY, value + 1))}
        disabled={value >= MAX_ASSET_QUANTITY}
        aria-label="수량 증가"
      >
        +
      </button>

      {showModal && (
        <NumberInputModal
          title={`${label} 수량`}
          initialValue={value}
          unit="개"
          maxValue={MAX_ASSET_QUANTITY}
          onConfirm={next => {
            onChange(next)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/QuantitySelector.test.jsx src/components/AssetCard.test.jsx`
Expected: PASS (전체) — `AssetCard`는 `QuantitySelector`를 감싸는 컴포넌트이므로 함께 돌려 회귀가 없는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/QuantitySelector.jsx src/components/QuantitySelector.test.jsx
git commit -m "feat: cap asset quantity input at 100"
```

---

### Task 3: `Team.jsx` `PriceSettingModal` — 가격 100만원 상한

**Files:**
- Modify: `src/pages/Team.jsx:1-9` (import), `src/pages/Team.jsx:394-405` (`PriceSettingModal` 내 `NumberInputModal`)
- Test: `src/pages/Team.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/Team.test.jsx`의 `describe('Team price setting modal', ...)` 블록 끝(`가격 pill을 누르면...` 테스트 다음)에 추가:

```js
  it('가격 입력값이 100만원을 초과하면 확인 시 100만원으로 제한된다', async () => {
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체 IT' })).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    for (let i = 0; i < 7; i++) {
      await userEvent.click(screen.getByRole('button', { name: '9' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByRole('button', { name: /1,000,000 원/ })).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/Team.test.jsx`
Expected: FAIL — `maxValue`가 없어 `9,999,999 원`으로 표시됨.

- [ ] **Step 3: 상한 구현**

`src/pages/Team.jsx` 상단 import 블록(`import NumberInputModal from '../components/NumberInputModal'` 다음 줄)에 추가:

```js
import { MAX_ASSET_PRICE } from '../constants/gameData'
```

`PriceSettingModal` 내부의 `NumberInputModal` 호출부(파일 끝 근처, `editingKey &&` 블록)를:

```jsx
      {editingKey && (
        <NumberInputModal
          title={editingLabel}
          initialValue={tempPrices[category][editingKey]}
          unit="원"
          onConfirm={val => {
            setTempPrices(prev => ({ ...prev, [category]: { ...prev[category], [editingKey]: val } }))
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
```

다음으로 교체:

```jsx
      {editingKey && (
        <NumberInputModal
          title={editingLabel}
          initialValue={tempPrices[category][editingKey]}
          unit="원"
          maxValue={MAX_ASSET_PRICE}
          onConfirm={val => {
            setTempPrices(prev => ({ ...prev, [category]: { ...prev[category], [editingKey]: val } }))
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/Team.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Team.jsx src/pages/Team.test.jsx
git commit -m "feat: cap stock/real estate price input at 1,000,000 won"
```

---

### Task 4: 기존 DB 보유수량 백필 스크립트 작성

**Files:**
- Create: `scripts/backfill-holdings-cap.js`

이 스크립트는 자동 테스트 없이 수동 실행으로 검증한다 (기존 `scripts/backfill-booth-values.js`와 동일한 방식). Supabase 접속 정보(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)가 있는 환경에서 사용자가 직접 실행해야 한다.

- [ ] **Step 1: 스크립트 작성**

`scripts/backfill-holdings-cap.js` 신규 생성:

```js
import 'dotenv/config'
import { supabase } from '../server/supabase.js'
import { calculateAssetBreakdown } from '../server/db.js'

const MAX_QUANTITY = 100

function clampHoldings(holdings) {
  const clamped = {}
  let changed = false
  for (const [key, value] of Object.entries(holdings)) {
    if (value > MAX_QUANTITY) {
      clamped[key] = MAX_QUANTITY
      changed = true
    } else {
      clamped[key] = value
    }
  }
  return { clamped, changed }
}

async function main() {
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('id, stock_prices, real_estate_prices')

  if (sessionsError) throw sessionsError

  const pricesBySessionId = new Map(
    sessions.map(s => [s.id, { stocks: s.stock_prices, realEstate: s.real_estate_prices }])
  )

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('id, session_id, cash, stock_holdings, real_estate_holdings, badges')

  if (resultsError) throw resultsError

  let updatedCount = 0

  for (const row of results) {
    const { clamped: stockHoldings, changed: stockChanged } = clampHoldings(row.stock_holdings)
    const { clamped: realEstateHoldings, changed: realEstateChanged } = clampHoldings(row.real_estate_holdings)

    if (!stockChanged && !realEstateChanged) continue

    const prices = pricesBySessionId.get(row.session_id)
    if (!prices) {
      console.warn(`session ${row.session_id}의 가격 정보를 찾을 수 없어 건너뜁니다 (result id: ${row.id})`)
      continue
    }

    const breakdown = calculateAssetBreakdown(
      { cash: row.cash, stocks: stockHoldings, realEstate: realEstateHoldings, badges: row.badges },
      prices
    )

    const { error: updateError } = await supabase
      .from('game_results')
      .update({
        stock_holdings: stockHoldings,
        real_estate_holdings: realEstateHoldings,
        stock_value: breakdown.stockValue,
        real_estate_value: breakdown.realEstateValue,
        total_assets: breakdown.totalAssets,
      })
      .eq('id', row.id)

    if (updateError) {
      console.error(`result id ${row.id} 업데이트 실패:`, updateError.message)
      continue
    }

    updatedCount += 1
    console.log(`result id ${row.id} 백필 완료 (stock_holdings=${JSON.stringify(stockHoldings)}, real_estate_holdings=${JSON.stringify(realEstateHoldings)})`)
  }

  console.log(`백필 완료: ${updatedCount}개 결과 수정 (전체 ${results.length}개 중)`)
}

main().catch(err => {
  console.error('백필 스크립트 실패:', err)
  process.exit(1)
})
```

- [ ] **Step 2: 문법 확인**

Run: `node --check scripts/backfill-holdings-cap.js`
Expected: 출력 없음 (문법 오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add scripts/backfill-holdings-cap.js
git commit -m "feat: add one-off script to clamp existing holdings to 100"
```

- [ ] **Step 4: 사용자에게 실행 안내**

이 단계는 코드 변경이 아니다. 플랜 실행자는 사용자에게 다음을 안내한다: "`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 환경변수가 설정된 환경에서 `node scripts/backfill-holdings-cap.js`를 직접 실행해 기존 100개 초과 보유수량 데이터를 정리해 주세요." 에이전트는 프로덕션 Supabase에 접근할 수 없으므로 이 스크립트를 대신 실행할 수 없다.

---

## Group B — 자산 미입력 시 상태 유지 (`IndividualPage.jsx`)

### Task 5: `defaultGameState`에 `badgesVisited` 플래그 추가

**Files:**
- Modify: `src/pages/IndividualPage.jsx:19-27` (`defaultGameState`)
- Test: `src/pages/IndividualPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/IndividualPage.test.jsx`의 `PLAYER` 상수를 다음으로 교체(gameState에 `badgesVisited: false` 추가):

```js
const PLAYER = {
  socketId: 's1', playerUuid: 'p1', name: '김민준', character: 'Innovator-사자',
  gameState: {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    badgesVisited: false, stocksVisited: false, realEstateVisited: false, isCompleted: false,
  },
}
```

`describe('IndividualPage', ...)` 블록 끝에 추가:

```js
  it('직업만 선택한 상태로 재입장하면 아직 방문하지 않은 단계는 완료 표시되지 않는다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        players: [{ ...PLAYER, gameState: { ...PLAYER.gameState, job: 'a' } }],
        prices: {},
      }),
    })
    renderPage()
    await screen.findByText('직업 선택')
    expect(screen.getByText('현금').closest('button')).toBeDisabled()
    expect(screen.getByText('성공카드').closest('button')).toBeDisabled()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: FAIL — 현재 코드는 `job !== null`이면 무조건 `completedUpTo`를 4로 설정하므로 '현금'/'성공카드' 버튼이 비활성화되지 않음.

- [ ] **Step 3: `defaultGameState`에 플래그 추가**

`src/pages/IndividualPage.jsx:19-27`을:

```js
function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}
```

다음으로 교체:

```js
function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    badgesVisited: false, stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}

function computeCompletedUpTo(gameState) {
  let upTo = -1
  if (gameState.job !== null) upTo = 0
  if (gameState.badgesVisited) upTo = 1
  if (gameState.realEstateVisited) upTo = 2
  if (gameState.stocksVisited) upTo = 3
  if (gameState.isCompleted) upTo = 4
  return upTo
}
```

이제 두 곳의 `if (gs.job !== null) setCompletedUpTo(4)`를 `setCompletedUpTo(computeCompletedUpTo(gs))`로 교체한다.

첫 번째 위치 (초기 `syncPlayer` 안, `if (me) { ... }` 블록):

```js
          if (me) {
            setPlayer(me)
            const gs = me.gameState ?? defaultGameState()
            setGameState(gs)
            setCashDisplay(String(gs.cash ?? 0))
            if (gs.job !== null) setCompletedUpTo(4)
            return
          }
```

다음으로 교체:

```js
          if (me) {
            setPlayer(me)
            const gs = me.gameState ?? defaultGameState()
            setGameState(gs)
            setCashDisplay(String(gs.cash ?? 0))
            setCompletedUpTo(computeCompletedUpTo(gs))
            return
          }
```

두 번째 위치 (`join-room` 콜백 이후 재조회):

```js
                setPlayer(me2)
                const gs = me2.gameState ?? defaultGameState()
                setGameState(gs)
                setCashDisplay(String(gs.cash ?? 0))
                if (gs.job !== null) setCompletedUpTo(4)
```

다음으로 교체:

```js
                setPlayer(me2)
                const gs = me2.gameState ?? defaultGameState()
                setGameState(gs)
                setCashDisplay(String(gs.cash ?? 0))
                setCompletedUpTo(computeCompletedUpTo(gs))
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.test.jsx
git commit -m "fix: compute resumed step progress from actual visited flags"
```

---

### Task 6: `handleNext`에서 단계 이탈 시 visited 플래그 저장

**Files:**
- Modify: `src/pages/IndividualPage.jsx` (`handleNext`)
- Test: `src/pages/IndividualPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/IndividualPage.test.jsx`에 추가:

```js
  it('값 변경 없이 "다음"만 눌러 성공카드 단계를 지나가도 badgesVisited가 저장된다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('경영·금융'))
    await userEvent.click(screen.getByText('다음'))
    await screen.findByRole('heading', { name: '성공카드' })
    await userEvent.click(screen.getByText('다음'))
    await screen.findByRole('heading', { name: '부동산' })

    const socket = io()
    const emittedStates = socket.emit.mock.calls
      .filter(([event]) => event === 'update-player-state')
      .map(([, payload]) => payload.gameState)
    expect(emittedStates.some(gs => gs.badgesVisited === true)).toBe(true)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: FAIL — `handleNext`가 아직 `badgesVisited`를 저장하지 않음.

- [ ] **Step 3: `handleNext` 구현**

먼저 모듈 스코프 상수를 추가한다. `src/pages/IndividualPage.jsx`의:

```js
const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']
const STOCK_PRICE_LABELS = Object.fromEntries(Object.keys(STOCK_LABELS).map(key => [key, '가격 설정']))
```

다음으로 교체:

```js
const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']
const STOCK_PRICE_LABELS = Object.fromEntries(Object.keys(STOCK_LABELS).map(key => [key, '가격 설정']))
const VISITED_KEY_BY_STEP = { 1: 'badgesVisited', 2: 'realEstateVisited', 3: 'stocksVisited' }
```

그다음 `handleNext`를:

```js
  function handleNext() {
    if (step === 0 && !gameState.job) return
    if (step === 4) { handleComplete(); return }
    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }
```

다음으로 교체:

```js
  function handleNext() {
    if (step === 0 && !gameState.job) return
    if (step === 4) { handleComplete(); return }

    const visitedKey = VISITED_KEY_BY_STEP[step]
    if (visitedKey && !gameState[visitedKey]) {
      const next = { ...gameState, [visitedKey]: true }
      setGameState(next)
      emitState(next)
    }

    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.test.jsx
git commit -m "feat: mark step as visited when advancing past it unchanged"
```

---

### Task 7: `IndividualPage.module.css`에 확인 팝업 스타일 추가

**Files:**
- Modify: `src/pages/IndividualPage.module.css`

이 스타일은 `src/pages/Team.module.css`의 `.overlay`/`.popup`/`.popupTitle`/`.popupActions`/`.cancelBtn`/`.confirmBtn`/`.confirmText`와 동일한 값을 그대로 사용한다. 별도 테스트 없이(순수 CSS) 다음 Task에서 렌더링 여부로 검증한다.

- [ ] **Step 1: 스타일 추가**

`src/pages/IndividualPage.module.css` 파일 끝에 추가:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.popup {
  background: var(--white);
  border-radius: var(--r-lg);
  padding: 32px;
  width: min(320px, calc(100% - 28px));
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: var(--shadow-card);
}

.popupTitle {
  font-size: 20px;
  font-weight: 900;
  color: var(--ink);
  text-align: center;
}

.popupActions {
  display: flex;
  gap: 12px;
}

.cancelBtn {
  flex: 1;
  height: 48px;
  border-radius: var(--r-sm);
  background: var(--slot-empty);
  color: var(--ink-2);
  font-size: 16px;
  font-weight: 700;
  border: 1px solid var(--line);
}

.confirmBtn {
  flex: 1;
  height: 48px;
  border-radius: var(--r-sm);
  background: var(--purple);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
}

.confirmText {
  font-size: 15px;
  color: var(--ink-2);
  text-align: center;
  line-height: 1.6;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/IndividualPage.module.css
git commit -m "style: add leave-confirm popup styles to IndividualPage"
```

(다음 Task에서 이 스타일을 사용하는 컴포넌트를 추가하고 테스트로 검증한다.)

---

### Task 8: 뒤로가기 확인 팝업 추가

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Test: `src/pages/IndividualPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/IndividualPage.test.jsx`에 추가:

```js
  it('뒤로가기 버튼을 누르면 바로 이동하지 않고 확인 팝업이 뜬다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByText(/입력 도중에 뒤로가기 버튼을 누르는 경우/)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('확인 팝업에서 취소를 누르면 화면에 남는다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    await userEvent.click(screen.getByText('취소'))
    expect(screen.queryByText(/입력 도중에 뒤로가기 버튼을 누르는 경우/)).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('확인 팝업에서 이동을 누르면 이전 화면으로 이동한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    await userEvent.click(screen.getByText('이동'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: FAIL — 현재 `<BackButton />`는 확인 없이 바로 `navigate(-1)`을 호출함.

- [ ] **Step 3: 확인 팝업 구현**

`src/pages/IndividualPage.jsx`의 다른 `useState` 선언들(예: `const [showCashModal, setShowCashModal] = useState(false)`) 바로 아래에 추가:

```js
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
```

`<BackButton />`을:

```jsx
      <BackButton />
```

다음으로 교체:

```jsx
      <BackButton onClick={() => setShowLeaveConfirm(true)} />
```

`bottomBar` div 바로 다음, 컴포넌트가 반환하는 최상위 `<div className={styles.page} ...>` 의 닫는 태그 직전에 추가:

```jsx
      {showLeaveConfirm && (
        <LeaveConfirmModal
          onConfirm={() => { setShowLeaveConfirm(false); navigate(-1) }}
          onClose={() => setShowLeaveConfirm(false)}
        />
      )}
```

파일 끝(`export default function IndividualPage` 함수 닫는 `}` 다음)에 새 컴포넌트를 추가:

```jsx
function LeaveConfirmModal({ onConfirm, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>이전 화면으로 이동</div>
        <p className={styles.confirmText}>
          입력 도중에 뒤로가기 버튼을 누르는 경우, 현재까지 입력한 내용이 사라질 수 있습니다.<br />
          이전 화면으로 돌아가시겠습니까?
        </p>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>이동</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.test.jsx
git commit -m "feat: confirm before leaving the asset input flow"
```

---

## Group C — 랭킹 페이지 "소속" → "수업"

### Task 9: `server/db.js` — 랭킹에 수업 이름 포함, `classId` 기준 필터링

**Files:**
- Modify: `server/db.js` (`RANKING_SELECT`, `mapRankingRow`, `getAllRankings`, `getGameResult`)
- Test: `server/db.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/db.test.js`의 `makeQueryBuilder` 헬퍼(파일 상단)에 `is` 메서드를 추가:

```js
function makeQueryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  }
  return builder
}
```

`describe('getAllRankings', ...)` 블록을 다음으로 교체:

```js
describe('getAllRankings', () => {
  it('teamCode, className, stockValue, realEstateValue를 포함해 반환한다', async () => {
    const rows = [{
      player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
      total_assets: 200000, stock_value: 4000, real_estate_value: 10000,
      session_id: 's1',
      game_sessions: {
        team_code: 'AB1234', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
        class_id: 'class-1', classes: { name: '1반' },
      },
    }]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getAllRankings } = await import('./db.js')
    const result = await getAllRankings()

    expect(result).toEqual([{
      rank: 1, name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stockHoldings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstateHoldings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
      totalAssets: 200000, stockValue: 4000, realEstateValue: 10000,
      sessionId: 's1', playerUuid: 'p1', teamCode: 'AB1234', className: '1반',
      stockPrices: PRICES.stocks, realEstatePrices: PRICES.realEstate,
    }])
  })

  it('수업 정보가 없으면 className이 미배정 수업으로 채워진다', async () => {
    const rows = [{
      player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
      total_assets: 0, stock_value: 0, real_estate_value: 0,
      session_id: 's2',
      game_sessions: {
        team_code: 'CD5678', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
        class_id: null, classes: null,
      },
    }]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getAllRankings } = await import('./db.js')
    const result = await getAllRankings()

    expect(result[0].className).toBe('미배정 수업')
  })

  it('classId가 있으면 game_sessions.class_id로 eq 필터링을 건다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getAllRankings } = await import('./db.js')
    await getAllRankings('class-1')

    expect(builder.eq).toHaveBeenCalledWith('game_sessions.class_id', 'class-1')
  })

  it("classId가 'unassigned'면 game_sessions.class_id를 null로 필터링한다", async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getAllRankings } = await import('./db.js')
    await getAllRankings('unassigned')

    expect(builder.is).toHaveBeenCalledWith('game_sessions.class_id', null)
  })
})
```

`describe('deleteCompletedTeam', ...)` 블록 앞에 새 블록을 추가:

```js
describe('getGameResult', () => {
  it('세션 조회 시 classes 이름을 함께 select한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', class_id: 'class-1', classes: { name: '1반' } },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { select: mockSelect }
      if (table === 'game_results') return makeQueryBuilder({ data: [], error: null })
      throw new Error(`unexpected table: ${table}`)
    })

    const { getGameResult } = await import('./db.js')
    const { session } = await getGameResult('session-1')

    expect(mockSelect).toHaveBeenCalledWith('*, classes(name)')
    expect(session.classes.name).toBe('1반')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `className`이 없어 `undefined`, `getAllRankings('class-1')`는 아직 `affiliation`으로 eq를 걸어 `'affiliation'`을 인자로 호출하고, `getGameResult`는 `'*'`만 select함.

- [ ] **Step 3: `server/db.js` 구현**

파일 최상단 import에 추가:

```js
import { supabase } from './supabase.js'
import { UNASSIGNED_CLASS } from './classes.js'
```

`getGameResult`의 세션 조회 부분을:

```js
export async function getGameResult(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
```

다음으로 교체:

```js
export async function getGameResult(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*, classes(name)')
    .eq('id', sessionId)
    .single()
```

`RANKING_SELECT`/`mapRankingRow`/`getAllRankings`를:

```js
const RANKING_SELECT = 'player_uuid, name, affiliation, character, job, cash, stock_holdings, real_estate_holdings, badges, total_assets, stock_value, real_estate_value, session_id, game_sessions(team_code, stock_prices, real_estate_prices)'

function mapRankingRow(r, i) {
  return {
    rank: i + 1,
    name: r.name,
    affiliation: r.affiliation,
    character: r.character,
    job: r.job,
    cash: r.cash,
    stockHoldings: r.stock_holdings,
    realEstateHoldings: r.real_estate_holdings,
    badges: r.badges,
    totalAssets: Number(r.total_assets),
    stockValue: r.stock_value != null ? Number(r.stock_value) : null,
    realEstateValue: r.real_estate_value != null ? Number(r.real_estate_value) : null,
    sessionId: r.session_id,
    playerUuid: r.player_uuid,
    teamCode: r.game_sessions?.team_code ?? '',
    stockPrices: r.game_sessions?.stock_prices ?? null,
    realEstatePrices: r.game_sessions?.real_estate_prices ?? null,
  }
}

export async function getAllRankings(affiliation = null) {
  let query = supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order('total_assets', { ascending: false })

  if (affiliation) {
    query = query.eq('affiliation', affiliation)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map(mapRankingRow)
}
```

다음으로 교체:

```js
const RANKING_SELECT = 'player_uuid, name, affiliation, character, job, cash, stock_holdings, real_estate_holdings, badges, total_assets, stock_value, real_estate_value, session_id, game_sessions!inner(team_code, stock_prices, real_estate_prices, class_id, classes(name))'

function mapRankingRow(r, i) {
  return {
    rank: i + 1,
    name: r.name,
    affiliation: r.affiliation,
    character: r.character,
    job: r.job,
    cash: r.cash,
    stockHoldings: r.stock_holdings,
    realEstateHoldings: r.real_estate_holdings,
    badges: r.badges,
    totalAssets: Number(r.total_assets),
    stockValue: r.stock_value != null ? Number(r.stock_value) : null,
    realEstateValue: r.real_estate_value != null ? Number(r.real_estate_value) : null,
    sessionId: r.session_id,
    playerUuid: r.player_uuid,
    teamCode: r.game_sessions?.team_code ?? '',
    className: r.game_sessions?.classes?.name ?? UNASSIGNED_CLASS,
    stockPrices: r.game_sessions?.stock_prices ?? null,
    realEstatePrices: r.game_sessions?.real_estate_prices ?? null,
  }
}

export async function getAllRankings(classId = null) {
  let query = supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order('total_assets', { ascending: false })

  if (classId === 'unassigned') {
    query = query.is('game_sessions.class_id', null)
  } else if (classId) {
    query = query.eq('game_sessions.class_id', classId)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map(mapRankingRow)
}
```

`getBoothRankings`도 같은 `RANKING_SELECT`를 쓰므로 자동으로 `className`이 포함된다 — 별도 수정 불필요.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: filter rankings by class_id and expose class name"
```

---

### Task 10: `server/index.js` — `/api/rankings`, `/api/results/:sessionId` 라우트 갱신

**Files:**
- Modify: `server/index.js:12` (import), `server/index.js:81-91` (`/api/rankings`), `server/index.js:301-328` (`/api/results/:sessionId`)

이 라우트들은 얇은 래퍼로 기존에도 전용 서버 테스트가 없다 (동작은 `server/db.test.js`와 `src/pages/RankingPage.test.jsx`에서 검증됨). Task 9, Task 11에서 이미 관련 동작이 테스트로 커버되므로 이 Task는 코드 변경만 수행한다.

- [ ] **Step 1: import에 `UNASSIGNED_CLASS` 추가**

`server/index.js:12`:

```js
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass } from './classes.js'
```

다음으로 교체:

```js
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, UNASSIGNED_CLASS } from './classes.js'
```

- [ ] **Step 2: `/api/rankings` 핸들러 수정**

```js
app.get('/api/rankings', async (req, res) => {
  try {
    const { affiliation, category } = req.query
    const rankings = category
      ? await getBoothRankings(category)
      : await getAllRankings(affiliation ?? null)
    res.json(rankings)
  } catch (err) {
    console.error('rankings error:', err)
```

다음으로 교체:

```js
app.get('/api/rankings', async (req, res) => {
  try {
    const { classId, category } = req.query
    const rankings = category
      ? await getBoothRankings(category)
      : await getAllRankings(classId ?? null)
    res.json(rankings)
  } catch (err) {
    console.error('rankings error:', err)
```

- [ ] **Step 3: `/api/results/:sessionId` 핸들러 수정**

```js
app.get('/api/results/:sessionId', async (req, res) => {
  try {
    const { session, results } = await getGameResult(req.params.sessionId)
    res.json({
      teamCode: session.team_code,
      createdAt: session.created_at,
      stockPrices: session.stock_prices,
      realEstatePrices: session.real_estate_prices,
      players: results.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        affiliation: r.affiliation,
        character: r.character,
        job: r.job,
        cash: r.cash,
        stockHoldings: r.stock_holdings,
        realEstateHoldings: r.real_estate_holdings,
        badges: r.badges,
        totalAssets: Number(r.total_assets),
        playerUuid: r.player_uuid,
        teamCode: session.team_code,
      })),
    })
  } catch (err) {
    console.error('results error:', err)
    res.status(404).json({ error: 'Result not found' })
  }
})
```

다음으로 교체:

```js
app.get('/api/results/:sessionId', async (req, res) => {
  try {
    const { session, results } = await getGameResult(req.params.sessionId)
    const className = session.classes?.name ?? UNASSIGNED_CLASS
    res.json({
      teamCode: session.team_code,
      createdAt: session.created_at,
      classId: session.class_id ?? null,
      className,
      stockPrices: session.stock_prices,
      realEstatePrices: session.real_estate_prices,
      players: results.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        affiliation: r.affiliation,
        className,
        character: r.character,
        job: r.job,
        cash: r.cash,
        stockHoldings: r.stock_holdings,
        realEstateHoldings: r.real_estate_holdings,
        badges: r.badges,
        totalAssets: Number(r.total_assets),
        playerUuid: r.player_uuid,
        teamCode: session.team_code,
      })),
    })
  } catch (err) {
    console.error('results error:', err)
    res.status(404).json({ error: 'Result not found' })
  }
})
```

- [ ] **Step 4: 서버 전체 테스트 통과 확인**

Run: `npx vitest run server`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add server/index.js
git commit -m "feat: expose classId/className via rankings and results routes"
```

---

### Task 11: `RankingTable.jsx` — 소속/팀코드 대신 수업명 표시

**Files:**
- Modify: `src/components/RankingTable.jsx`
- Test: `src/components/RankingTable.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/RankingTable.test.jsx`의 `mockRows`를 다음으로 교체:

```js
const mockRows = [
  { rank: 1, name: '홍길동', className: '1반', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1' },
  { rank: 2, name: '김철수', className: '2반', character: 'cat', totalAssets: 120000, playerUuid: 'uuid-2' },
]
```

첫 번째 테스트를:

```js
  it('등수, 이름, 소속, 팀, 총자산을 렌더링한다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.getByText('1위')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('경영학과 · AB1234')).toBeInTheDocument()
    expect(screen.getByText('150,000원')).toBeInTheDocument()
  })
```

다음으로 교체:

```js
  it('등수, 이름, 수업, 총자산을 렌더링한다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.getByText('1위')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('1반')).toBeInTheDocument()
    expect(screen.getByText('150,000원')).toBeInTheDocument()
  })
```

`valueKey를 지정하면...` 테스트의 `boothRows`도 `className`을 쓰도록 교체:

```js
    const boothRows = [
      { rank: 1, name: '정우성', affiliation: '수도고', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, playerUuid: 'uuid-3' },
    ]
```

다음으로:

```js
    const boothRows = [
      { rank: 1, name: '정우성', className: '3반', character: 'tiger', stockValue: 172000, playerUuid: 'uuid-3' },
    ]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/RankingTable.test.jsx`
Expected: FAIL — 현재 `RankingTable`은 `row.affiliation`/`row.teamCode`를 렌더링하므로 `'1반'` 텍스트가 없음.

- [ ] **Step 3: `RankingTable.jsx` 구현**

```jsx
            <div className={styles.info}>
              <span className={styles.name}>{row.name}</span>
              <span className={styles.sub}>{row.affiliation} · {row.teamCode}</span>
            </div>
```

다음으로 교체:

```jsx
            <div className={styles.info}>
              <span className={styles.name}>{row.name}</span>
              <span className={styles.sub}>{row.className}</span>
            </div>
```

```jsx
          <div className={styles.pinnedInfo}>
            <span className={styles.pinnedName}>{pinnedRow.name}</span>
            <span className={styles.pinnedAffiliation}>{pinnedRow.affiliation} · {pinnedRow.teamCode}</span>
          </div>
```

다음으로 교체:

```jsx
          <div className={styles.pinnedInfo}>
            <span className={styles.pinnedName}>{pinnedRow.name}</span>
            <span className={styles.pinnedAffiliation}>{pinnedRow.className}</span>
          </div>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/RankingTable.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/components/RankingTable.jsx src/components/RankingTable.test.jsx
git commit -m "feat: show class name instead of affiliation/team code in ranking rows"
```

---

### Task 12: `RankingPage.jsx` — "소속" 탭을 "수업" 탭(classId 기준)으로 교체

**Files:**
- Modify: `src/pages/RankingPage.jsx`
- Test: `src/pages/RankingPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/RankingPage.test.jsx`의 `beforeEach` 안 fetch 모킹을 다음으로 교체(각 행에 `className` 추가, `/api/results/` 응답에 `classId`/`className` 추가):

```js
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.startsWith('/api/rankings?category=stock')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '정우성', className: '3반', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, totalAssets: 300000, playerUuid: 'p1' },
      ]) })
    }
    if (url.startsWith('/api/rankings?category=realEstate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '한소희', className: '4반', teamCode: 'GH3456', character: 'toucan', realEstateValue: 90000, totalAssets: 250000, playerUuid: 'p2' },
      ]) })
    }
    if (url.startsWith('/api/results/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        teamCode: 'AB1234',
        classId: 'class-1',
        className: '1반',
        players: [
          { rank: 1, name: '홍길동', className: '1반', teamCode: 'AB1234', character: 'fox', totalAssets: 50000, playerUuid: 'p3' },
        ],
      }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([
      { rank: 1, name: '김민준', className: '1반', teamCode: 'AB1234', character: 'lion', totalAssets: 200000, playerUuid: 'p4' },
    ]) })
  })
})
```

두 개 테스트를 교체한다. 먼저:

```js
  it('홈 진입(sessionId 없음)에서 부스 랭킹 탭 선택 시 서브탭 없이 카테고리 피커만 보인다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.queryByText('소속')).toBeNull()
  })
```

다음으로:

```js
  it('홈 진입(sessionId 없음)에서 부스 랭킹 탭 선택 시 서브탭 없이 카테고리 피커만 보인다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.queryByText('수업')).toBeNull()
  })
```

그리고:

```js
  it('결과등록 후 진입(sessionId 있음)에서 전체 랭킹 탭은 기존 소속/팀 서브탭을 유지한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByText('소속')).toBeInTheDocument()
    expect(screen.getByText('팀')).toBeInTheDocument()
  })
```

다음으로:

```js
  it('결과등록 후 진입(sessionId 있음)에서 전체 랭킹 탭은 기존 수업/팀 서브탭을 유지한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByText('수업')).toBeInTheDocument()
    expect(screen.getByText('팀')).toBeInTheDocument()
  })

  it('수업 탭을 선택하면 내 세션의 classId로 /api/rankings를 호출한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    await userEvent.click(screen.getByText('수업'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?classId=class-1')
    })
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: FAIL — 현재 탭 라벨이 '소속'이고 `myAffiliation` 기반으로 `/api/rankings?affiliation=...`를 호출함.

- [ ] **Step 3: `RankingPage.jsx` 구현**

`TABS` 상수를:

```js
const TABS = [
  { key: 'global', label: '전체' },
  { key: 'affiliation', label: '소속' },
  { key: 'team', label: '팀' },
]
```

다음으로 교체:

```js
const TABS = [
  { key: 'global', label: '전체' },
  { key: 'class', label: '수업' },
  { key: 'team', label: '팀' },
]
```

`myAffiliation` state와 그 조회 effect를:

```js
  const [myAffiliation, setMyAffiliation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewingPlayer, setViewingPlayer] = useState(null)

  const myPlayerUuid = getPlayerUuid()

  // V2: 내 소속 파악을 위해 팀 결과에서 내 기록 찾기
  useEffect(() => {
    if (!isV2) return
    fetch(`/api/results/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        const me = data.players?.find(p => p.playerUuid === myPlayerUuid)
        if (me) setMyAffiliation(me.affiliation)
      })
      .catch(() => {})
  }, [sessionId, isV2, myPlayerUuid])
```

다음으로 교체:

```js
  const [myClassId, setMyClassId] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewingPlayer, setViewingPlayer] = useState(null)

  const myPlayerUuid = getPlayerUuid()

  // V2: 내 수업 파악을 위해 세션 정보에서 classId 조회
  useEffect(() => {
    if (!isV2) return
    fetch(`/api/results/${sessionId}`)
      .then(r => r.json())
      .then(data => setMyClassId(data.classId ?? 'unassigned'))
      .catch(() => {})
  }, [sessionId, isV2])
```

메인 랭킹 조회 `useEffect`를:

```js
  useEffect(() => {
    setLoading(true)
    setError(null)

    if (topTab === 'booth') {
      fetch(`/api/rankings?category=${boothCategory}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(data => { setRows(data); setLoading(false) })
        .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
      return
    }

    if (isV2 && activeTab === 'affiliation' && myAffiliation === null) return

    let url = '/api/rankings'

    if (isV2) {
      if (activeTab === 'affiliation' && myAffiliation) {
        url = `/api/rankings?affiliation=${encodeURIComponent(myAffiliation)}`
      } else if (activeTab === 'team') {
        fetch(`/api/results/${sessionId}`)
          .then(r => { if (!r.ok) throw new Error(); return r.json() })
          .then(data => {
            const players = (data.players ?? []).map(p => ({
              ...p,
              stockPrices: data.stockPrices,
              realEstatePrices: data.realEstatePrices,
            }))
            setRows(players)
            setLoading(false)
          })
          .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
        return
      }
    }

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [activeTab, sessionId, isV2, myAffiliation, topTab, boothCategory])
```

다음으로 교체:

```js
  useEffect(() => {
    setLoading(true)
    setError(null)

    if (topTab === 'booth') {
      fetch(`/api/rankings?category=${boothCategory}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(data => { setRows(data); setLoading(false) })
        .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
      return
    }

    if (isV2 && activeTab === 'class' && myClassId === undefined) return

    let url = '/api/rankings'

    if (isV2) {
      if (activeTab === 'class') {
        url = `/api/rankings?classId=${encodeURIComponent(myClassId)}`
      } else if (activeTab === 'team') {
        fetch(`/api/results/${sessionId}`)
          .then(r => { if (!r.ok) throw new Error(); return r.json() })
          .then(data => {
            const players = (data.players ?? []).map(p => ({
              ...p,
              stockPrices: data.stockPrices,
              realEstatePrices: data.realEstatePrices,
            }))
            setRows(players)
            setLoading(false)
          })
          .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
        return
      }
    }

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [activeTab, sessionId, isV2, myClassId, topTab, boothCategory])
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.test.jsx
git commit -m "feat: replace affiliation ranking tab with class-based grouping"
```

---

### Task 13: 전체 테스트 스위트 확인

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm test -- --run`
Expected: PASS (전체) — Group A/B/C에서 수정한 모든 파일과 나머지 기존 테스트가 함께 그린이어야 한다.

- [ ] **Step 2: 실패 시 조치**

실패하는 테스트가 있으면 해당 Task로 돌아가 원인을 확인하고 수정한다 (특히 `RankingPage.jsx`/`RankingTable.jsx`/`db.js`는 서로 데이터 모양이 맞물려 있으므로, 한 파일만 수정하고 다른 파일을 놓쳤는지 우선 점검한다).

---

## 참고: 이번 계획에서 다루지 않는 것

- `affiliation` 필드 자체와 관련 입력 UI(캐릭터 선택 등에서 소속을 입력받는 폼)는 그대로 둔다.
- 가격/수량에 대한 서버 측 검증은 추가하지 않는다.
- "방 이름" 같은 새 필드는 도입하지 않는다 — 팀코드는 화면 표시에서만 제거한다.
- `scripts/backfill-holdings-cap.js` 실행은 이 계획의 범위 밖이며 사용자가 직접 수행해야 한다.
