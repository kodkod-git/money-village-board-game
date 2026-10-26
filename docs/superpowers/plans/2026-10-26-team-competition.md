# 경쟁 모드 팀 대결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경쟁 모드에서 참여자가 직접 주식·부동산 가격을 정하고, 결과 화면에서 팀 비교 대시보드 4장 → 기존 랭킹을 옆으로 넘겨 본다. 수업 목록의 "경쟁" 배지는 이름 옆에 둔다.

**Architecture:** 참여자 가격은 `gameState.prices`에 두고 `game_results`의 새 jsonb 컬럼에 저장한다. 서버·클라이언트의 `calculateAssetBreakdown`이 `gameState.prices ?? prices`로 가격을 고르므로 평가액 계산 경로는 거의 그대로 둔다. 팀 비교는 새 공개 API `GET /api/results/:sessionId/competition`이 팀별 합계를 돌려주고, `RankingPage`가 경쟁 모드일 때만 CSS scroll-snap 캐러셀로 감싼다.

**Tech Stack:** React 18, react-router 7, CSS Modules, Express 5, socket.io, Supabase JS, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-26-team-competition-design.md`

**공통 규칙**
- 테스트 실행: `npx vitest run <파일>` (전체: `npx vitest run`)
- 브랜치: `feat/team-competition`
- 작업 트리에 이번 작업과 관계없는 수정 파일(`src/App.jsx`, `src/index.css`, `src/pages/AdminAllResults*`, `src/utils/calculateAssets.js`, `.omc/` 등)이 이미 있다. **커밋할 때는 그 Task에서 고친 파일만 `git add` 한다.** `src/utils/calculateAssets.js`는 이미 수정된 상태이므로 Task 1에서 `git diff src/utils/calculateAssets.js`로 기존 변경을 먼저 확인하고, 기존 변경까지 같이 커밋해도 되는지 사용자에게 물어본다(안 되면 `git add -p`로 이번 변경만 고른다).
- 커밋 메시지 끝에 다음 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

---

## File Structure

| 파일 | 역할 | 상태 |
|---|---|---|
| `supabase/migrations/2026-10-26-add-player-prices.sql` | `game_results` 가격 컬럼 | 새로 만듦 |
| `server/prices.js` (+ `.test.js`) | 가격 값 확인 `sanitizePrices`, `withSanitizedPrices` | 새로 만듦 |
| `server/db.js` (+ `.test.js`) | 참여자 가격 저장·읽기, `getCompetitionTeams` | 수정 |
| `server/index.js` | 가격 확인 연결, 결과 API 참여자 가격, `/competition` 라우트 | 수정 |
| `src/utils/calculateAssets.js` (+ test) | 클라이언트 평가액 계산이 참여자 가격 우선 | 수정 |
| `src/utils/playerPrices.js` (+ test) | `pricesForPlayer` | 새로 만듦 |
| `src/components/PriceListEditor.jsx` (+ test) | 가격 목록 + 계산기 (관리자 모달·가격 단계 공용) | 새로 만듦 |
| `src/components/PriceSettingModal.jsx` | 목록 부분을 `PriceListEditor`로 교체 | 수정 |
| `src/components/AssetInputSteps.jsx` (+ test) | `editablePrices` 7단계 | 수정 |
| `src/pages/IndividualPage.module.css` | 가격 단계 헤더 스타일 | 수정 |
| `src/pages/CompetitionPlay.jsx` (+ test) | `editablePrices`, 기본 가격 채우기 | 수정 |
| `src/pages/AdminClassList.jsx` / `.module.css` (+ test) | 배지를 이름 옆으로 | 수정 |
| `src/components/admin/AdminGridCard.jsx` (+ test) | 경쟁 모드 탭 숨김 | 수정 |
| `src/components/admin/AdminSpectateModal.jsx` (+ test) | 참여자별 가격 설정 | 수정 |
| `src/pages/AdminClassDashboard.jsx` | `competition` prop 전달 | 수정 |
| `src/pages/EconomicReport.jsx`, `src/pages/ParentGuide.jsx` | `pricesForPlayer` 사용 | 수정 |
| `src/components/TeamStatSlide.jsx` / `.module.css` (+ test) | 팀 비교 가로 막대 1장 | 새로 만듦 |
| `src/components/CompetitionResultCarousel.jsx` / `.module.css` (+ test) | 5장 캐러셀 | 새로 만듦 |
| `src/pages/RankingPage.jsx` / `.module.css` (+ test) | 경쟁 모드면 캐러셀 | 수정 |

---

### Task 1: `calculateAssetBreakdown`이 참여자 가격을 먼저 쓴다 (서버·클라이언트)

**Files:**
- Modify: `server/db.js:16-31`
- Modify: `src/utils/calculateAssets.js:16-29`
- Test: `server/db.test.js` (describe `calculateAssetBreakdown` 안에 추가)
- Test: `src/utils/calculateAssets.test.js` (없으면 새로 만듦)

- [ ] **Step 1: 실패하는 테스트 작성 — 서버**

`server/db.test.js`의 `describe('calculateAssetBreakdown', …)` 블록 마지막에 추가:

```js
  it('gameState.prices가 있으면 넘겨받은 가격 대신 그 가격으로 계산한다', () => {
    const state = makeState({
      stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      prices: {
        stocks: { semiconductor: 5000, finance: 2000, bio: 2000 },
        realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
      },
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(10000)
    expect(result.realEstateValue).toBe(30000)
    expect(result.totalAssets).toBe(40000)
  })
```

- [ ] **Step 2: 실패하는 테스트 작성 — 클라이언트**

`src/utils/calculateAssets.test.js`가 있으면 그 안에, 없으면 새 파일로:

```js
import { describe, it, expect } from 'vitest'
import { calculateAssetBreakdown } from './calculateAssets'

const ROOM_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
  realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
}

function state(overrides = {}) {
  return {
    cash: 0,
    stocks: { semiconductor: 2, finance: 0, bio: 0 },
    realEstate: { gaon: 1, dami: 0, chorong: 0 },
    badges: [false, false, false, false, false, false],
    ...overrides,
  }
}

describe('calculateAssetBreakdown (client)', () => {
  it('gameState.prices가 없으면 넘겨받은 가격을 쓴다', () => {
    expect(calculateAssetBreakdown(state(), ROOM_PRICES)).toEqual({
      cash: 0, stockValue: 4000, realEstateValue: 10000, totalAssets: 14000,
    })
  })

  it('gameState.prices가 있으면 그 가격을 먼저 쓴다', () => {
    const prices = {
      stocks: { semiconductor: 5000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
    }
    expect(calculateAssetBreakdown(state({ prices }), ROOM_PRICES)).toEqual({
      cash: 0, stockValue: 10000, realEstateValue: 30000, totalAssets: 40000,
    })
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run server/db.test.js src/utils/calculateAssets.test.js`
Expected: 새 테스트 2개 FAIL (`stockValue` 4000 ≠ 10000)

- [ ] **Step 4: 구현 — 서버 `server/db.js`**

`calculateAssetBreakdown`을 다음으로 바꾼다:

```js
// 경쟁 모드 참여자는 자기가 정한 가격(gameState.prices)을 가진다. 없으면 방(세션) 가격을 쓴다.
export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const usedPrices = gameState.prices ?? prices
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(STOCK_LABELS).reduce(
    (sum, key) => sum + (stocks[key] ?? 0) * (usedPrices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(REAL_ESTATE_LABELS).reduce(
    (sum, key) => sum + (realEstate[key] ?? 0) * (usedPrices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  const totalAssets = Math.round(baseAssets * badgeMultiplier(badgeCount))

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
```

- [ ] **Step 5: 구현 — 클라이언트 `src/utils/calculateAssets.js`**

같은 방식으로 바꾼다:

```js
// 경쟁 모드 참여자는 자기가 정한 가격(gameState.prices)을 가진다. 없으면 방(세션) 가격을 쓴다.
export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const usedPrices = gameState.prices ?? prices
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(STOCK_LABELS).reduce(
    (sum, key) => sum + (stocks[key] ?? 0) * (usedPrices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(REAL_ESTATE_LABELS).reduce(
    (sum, key) => sum + (realEstate[key] ?? 0) * (usedPrices.realEstate[key] ?? 0), 0
  )
  const totalAssets = Math.round(((cash ?? 0) + stockValue + realEstateValue) * badgeMultiplier(badgeCount))

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js src/utils/calculateAssets.test.js`
Expected: PASS

- [ ] **Step 7: 커밋** (공통 규칙의 `calculateAssets.js` 주의 사항 확인)

```bash
git add server/db.js server/db.test.js src/utils/calculateAssets.js src/utils/calculateAssets.test.js
git commit -m "feat: prefer player prices when calculating asset values"
```

---

### Task 2: 가격 값 확인 모듈 `server/prices.js`

**Files:**
- Create: `server/prices.js`
- Test: `server/prices.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sanitizePrices, withSanitizedPrices, DEFAULT_PLAYER_PRICES } from './prices.js'

describe('sanitizePrices', () => {
  it('정상 값은 그대로 둔다', () => {
    const prices = {
      stocks: { semiconductor: 5000, finance: 0, bio: 1000000 },
      realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
    }
    expect(sanitizePrices(prices)).toEqual(prices)
  })

  it('모르는 키는 버리고, 빠진 키는 기본값으로 채운다', () => {
    expect(sanitizePrices({ stocks: { semiconductor: 3000, hack: 1 }, realEstate: {} })).toEqual({
      stocks: { semiconductor: 3000, finance: 2000, bio: 2000 },
      realEstate: DEFAULT_PLAYER_PRICES.realEstate,
    })
  })

  it('음수·소수·최대값 초과·문자열은 기본값으로 바꾼다', () => {
    expect(sanitizePrices({
      stocks: { semiconductor: -1, finance: 1.5, bio: 1000001 },
      realEstate: { gaon: '5000', dami: null, chorong: 20000 },
    })).toEqual({
      stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 20000 },
    })
  })

  it('객체가 아니면 undefined를 돌려준다', () => {
    expect(sanitizePrices(undefined)).toBeUndefined()
    expect(sanitizePrices(null)).toBeUndefined()
    expect(sanitizePrices('x')).toBeUndefined()
    expect(sanitizePrices([])).toBeUndefined()
  })
})

describe('withSanitizedPrices', () => {
  it('prices 키가 없으면 그대로 돌려준다', () => {
    const gameState = { cash: 1 }
    expect(withSanitizedPrices(gameState)).toBe(gameState)
  })

  it('prices를 정리해서 넣는다', () => {
    expect(withSanitizedPrices({ cash: 1, prices: { stocks: { bio: -5 } } })).toEqual({
      cash: 1,
      prices: { stocks: DEFAULT_PLAYER_PRICES.stocks, realEstate: DEFAULT_PLAYER_PRICES.realEstate },
    })
  })

  it('prices가 잘못된 값이면 키를 지운다', () => {
    expect(withSanitizedPrices({ cash: 1, prices: 'bad' })).toEqual({ cash: 1 })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/prices.test.js`
Expected: FAIL — `Cannot find module './prices.js'`

- [ ] **Step 3: 구현**

`server/prices.js`:

```js
import { STOCK_LABELS, REAL_ESTATE_LABELS, MAX_ASSET_PRICE } from '../src/constants/gameData.js'

// 경쟁 모드 참여자가 처음 받는 가격. src/components/PriceSettingModal.jsx의 DEFAULT_PRICES와 같다.
export const DEFAULT_PLAYER_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
  realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
}

function isValidPrice(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ASSET_PRICE
}

function sanitizeCategory(values, labels, defaults) {
  const source = values && typeof values === 'object' ? values : {}
  return Object.fromEntries(Object.keys(labels).map(key => [
    key, isValidPrice(source[key]) ? source[key] : defaults[key],
  ]))
}

// 참여자가 보낸 가격은 정해진 종목 키만, 0 이상 MAX_ASSET_PRICE 이하의 정수만 받는다.
export function sanitizePrices(prices) {
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) return undefined
  return {
    stocks: sanitizeCategory(prices.stocks, STOCK_LABELS, DEFAULT_PLAYER_PRICES.stocks),
    realEstate: sanitizeCategory(prices.realEstate, REAL_ESTATE_LABELS, DEFAULT_PLAYER_PRICES.realEstate),
  }
}

export function withSanitizedPrices(gameState) {
  if (!gameState || !('prices' in gameState)) return gameState
  const { prices, ...rest } = gameState
  const sanitized = sanitizePrices(prices)
  return sanitized ? { ...rest, prices: sanitized } : rest
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/prices.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/prices.js server/prices.test.js
git commit -m "feat: validate player-set asset prices"
```

---

### Task 3: 마이그레이션 + `saveGameResult`가 참여자 가격을 저장

**Files:**
- Create: `supabase/migrations/2026-10-26-add-player-prices.sql`
- Modify: `server/db.js` (`saveGameResult`의 `rows` 매핑)
- Test: `server/db.test.js` (describe `saveGameResult` 안에 추가)

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 경쟁 모드 참여자가 직접 정한 가격. 일반 모드 행은 NULL이고 세션(game_sessions)의 가격을 쓴다.
ALTER TABLE game_results ADD COLUMN stock_prices JSONB;
ALTER TABLE game_results ADD COLUMN real_estate_prices JSONB;
```

- [ ] **Step 2: 실패하는 테스트 작성**

`server/db.test.js`의 `describe('saveGameResult', …)` 안에 추가:

```js
  it('참여자 가격이 있으면 그 가격으로 계산하고 행에 저장한다. 없으면 컬럼은 null이다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSessionInsert = vi.fn().mockReturnValue({ select: mockSelect })
    const mockResultsInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { insert: mockSessionInsert }
      if (table === 'game_results') return { insert: mockResultsInsert }
      throw new Error(`unexpected table: ${table}`)
    })

    const { saveGameResult } = await import('./db.js')
    const playerPrices = {
      stocks: { semiconductor: 5000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
    }
    const holdings = {
      stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    }

    await saveGameResult({
      code: 'AB1234', prices: PRICES, classId: 'class-1',
      players: [
        { playerUuid: 'p1', name: 'A', character: 'fox', gameState: makeState({ job: 'a', ...holdings, prices: playerPrices }) },
        { playerUuid: 'p2', name: 'B', character: 'fox', gameState: makeState({ job: 'a', ...holdings }) },
      ],
    })

    expect(mockResultsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        player_uuid: 'p1', stock_value: 10000, real_estate_value: 30000,
        stock_prices: playerPrices.stocks, real_estate_prices: playerPrices.realEstate,
      }),
      expect.objectContaining({
        player_uuid: 'p2', stock_value: 4000, real_estate_value: 10000,
        stock_prices: null, real_estate_prices: null,
      }),
    ])
  })
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run server/db.test.js -t "참여자 가격이 있으면"`
Expected: FAIL — `stock_prices` 키 없음 (평가액은 Task 1 덕분에 이미 맞다)

- [ ] **Step 4: 구현**

`saveGameResult`의 `rows` 매핑 객체에서 `real_estate_value: breakdown.realEstateValue,` 다음 줄에 추가:

```js
      // 경쟁 모드 참여자가 직접 정한 가격. 일반 모드는 null이고 세션 가격을 쓴다.
      stock_prices: player.gameState.prices?.stocks ?? null,
      real_estate_prices: player.gameState.prices?.realEstate ?? null,
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (기존 테스트 포함)

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/2026-10-26-add-player-prices.sql server/db.js server/db.test.js
git commit -m "feat: store player-set prices with game results"
```

---

### Task 4: 등록된 결과 읽기·수정에 참여자 가격 반영 (`getAllCompletedTeams`, `updateGameResult`)

**Files:**
- Modify: `server/db.js` (`getAllCompletedTeams`, `updateGameResult`)
- Test: `server/db.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

먼저 `server/db.test.js`의 `describe('getAllCompletedTeams', …)`에 있는 기존 테스트를 읽고 같은 mock 방식으로 다음 테스트를 추가한다. 행 하나에 `stock_prices`·`real_estate_prices`를 넣고, 다른 행은 두 값을 `null`로 둔다:

```js
  it('행에 참여자 가격이 있으면 gameState.prices로 넣고, 없으면 넣지 않는다', async () => {
    const playerPrices = {
      stocks: { semiconductor: 5000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
    }
    const sessions = [{ id: 's1', team_code: 'AB1234', created_at: 't', class_id: 'c1', title: null,
      stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate }]
    const results = [
      { session_id: 's1', player_uuid: 'p1', name: 'A', character: 'fox', affiliation: '', cash: 0, job: 'a',
        stock_holdings: {}, real_estate_holdings: {}, badges: [],
        stock_prices: playerPrices.stocks, real_estate_prices: playerPrices.realEstate },
      { session_id: 's1', player_uuid: 'p2', name: 'B', character: 'fox', affiliation: '', cash: 0, job: 'a',
        stock_holdings: {}, real_estate_holdings: {}, badges: [], stock_prices: null, real_estate_prices: null },
    ]
    mockFrom.mockReset()
    mockFrom.mockImplementation(table => makeQueryBuilder({ data: table === 'game_sessions' ? sessions : results, error: null }))

    const { getAllCompletedTeams } = await import('./db.js')
    const [team] = await getAllCompletedTeams()

    expect(team.players[0].gameState.prices).toEqual(playerPrices)
    expect(team.players[1].gameState).not.toHaveProperty('prices')
  })
```

`describe('updateGameResult', …)`에 추가 (기존 테스트의 mock 체인을 그대로 복사하되, `currentRow`와 `updatedRow`에 가격을 넣는다):

```js
  it('행의 참여자 가격으로 재계산하고, 고친 값에 prices가 있으면 그 가격으로 바꿔 저장한다', async () => {
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate },
      error: null,
    })
    const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })

    const rowPrices = {
      stocks: { semiconductor: 5000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
    }
    const currentRow = {
      cash: 0, job: 'a',
      stock_holdings: { semiconductor: 2, finance: 0, bio: 0 },
      real_estate_holdings: { gaon: 1, dami: 0, chorong: 0 },
      badges: [false, false, false, false, false, false],
      stock_prices: rowPrices.stocks, real_estate_prices: rowPrices.realEstate,
    }
    const mockCurrentSingle = vi.fn().mockResolvedValue({ data: currentRow, error: null })
    const mockCurrentEqEq = vi.fn().mockReturnValue({ single: mockCurrentSingle })
    const mockCurrentEq = vi.fn().mockReturnValue({ eq: mockCurrentEqEq })
    const mockCurrentSelect = vi.fn().mockReturnValue({ eq: mockCurrentEq })

    const mockUpdateSingle = vi.fn().mockResolvedValue({ data: { player_uuid: 'p1', ...currentRow }, error: null })
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

    // 1) 가격을 고치지 않으면 행에 저장된 참여자 가격으로 계산한다.
    const updated = await updateGameResult('AB1234', 'p1', { cash: 1000 })
    expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      cash: 1000, stock_value: 10000, real_estate_value: 30000, total_assets: 41000,
    }))
    expect(mockUpdate.mock.lastCall[0]).not.toHaveProperty('stock_prices')
    expect(updated.gameState.prices).toEqual(rowPrices)

    // 2) 고친 값에 prices가 있으면 그 가격으로 계산하고 컬럼도 바꾼다.
    callCount = 0
    const newPrices = {
      stocks: { semiconductor: 1000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 5000, dami: 10000, chorong: 10000 },
    }
    await updateGameResult('AB1234', 'p1', { prices: newPrices })
    expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      stock_value: 2000, real_estate_value: 5000, total_assets: 7000,
      stock_prices: newPrices.stocks, real_estate_prices: newPrices.realEstate,
    }))
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: 새 테스트 2개 FAIL

- [ ] **Step 3: 구현**

`server/db.js`, `toJobColumn` 함수 아래에 헬퍼 추가:

```js
// game_results 행의 참여자 가격(경쟁 모드). 일반 모드 행은 null이므로 undefined를 돌려준다.
function rowPrices(row) {
  if (!row.stock_prices && !row.real_estate_prices) return undefined
  return { stocks: row.stock_prices ?? {}, realEstate: row.real_estate_prices ?? {} }
}
```

`getAllCompletedTeams`의 `gameState` 객체에서 `isCompleted: true,` 다음에 추가:

```js
          ...(rowPrices(r) ? { prices: rowPrices(r) } : {}),
```

`updateGameResult`:
- `mergedGameState`를 다음으로 바꾼다:

```js
  const mergedGameState = {
    cash: current.cash,
    job: current.job,
    stocks: current.stock_holdings,
    realEstate: current.real_estate_holdings,
    badges: current.badges,
    prices: rowPrices(current),
    ...partialGameState,
  }
```

- `if ('job' in updateRow) …` 줄 다음에 추가:

```js
  if (partialGameState.prices) {
    updateRow.stock_prices = partialGameState.prices.stocks
    updateRow.real_estate_prices = partialGameState.prices.realEstate
  }
```

- 반환하는 `gameState`의 `isCompleted: true,` 다음에 추가:

```js
      ...(rowPrices(updated) ? { prices: rowPrices(updated) } : {}),
```

`calculateAssetBreakdown`은 `mergedGameState.prices`가 `undefined`면 세션 가격을 쓰므로(Task 1) 계산 줄은 그대로 둔다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: read and edit player prices on registered results"
```

---

### Task 5: 랭킹·결과 API가 참여자별 가격을 내려준다

**Files:**
- Modify: `server/db.js` (`RANKING_SELECT`, `mapRankingRow`)
- Modify: `server/index.js:652-690` (`GET /api/results/:sessionId`)
- Test: `server/db.test.js` (describe `getRankings`)

- [ ] **Step 1: 실패하는 테스트 작성**

`describe('getRankings', …)` 안의 기존 테스트 하나를 읽고 같은 방식(`makeQueryBuilder` + `mockFrom.mockReturnValue`)으로 추가:

```js
  it('행에 참여자 가격이 있으면 stockPrices/realEstatePrices로 그 가격을, 없으면 세션 가격을 쓴다', async () => {
    const session = { team_code: 'AB', title: null, stock_prices: { bio: 1 }, real_estate_prices: { gaon: 1 }, class_id: null, classes: null }
    const builder = makeQueryBuilder({ data: [
      { player_uuid: 'p1', total_assets: 2, stock_prices: { bio: 9 }, real_estate_prices: { gaon: 9 }, game_sessions: session },
      { player_uuid: 'p2', total_assets: 1, stock_prices: null, real_estate_prices: null, game_sessions: session },
    ], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    const rows = await getRankings()

    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('stock_prices, real_estate_prices, session_id'))
    expect(rows[0]).toMatchObject({ stockPrices: { bio: 9 }, realEstatePrices: { gaon: 9 } })
    expect(rows[1]).toMatchObject({ stockPrices: { bio: 1 }, realEstatePrices: { gaon: 1 } })
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/db.test.js -t "행에 참여자 가격이 있으면 stockPrices"`
Expected: FAIL

- [ ] **Step 3: 구현 — `server/db.js`**

`RANKING_SELECT`에서 `real_estate_value, session_id`를 `real_estate_value, stock_prices, real_estate_prices, session_id`로 바꾼다.

`mapRankingRow`의 두 줄을 바꾼다:

```js
    // 경쟁 모드 참여자는 자기 가격, 일반 모드는 그 게임(세션)의 가격.
    stockPrices: r.stock_prices ?? r.game_sessions?.stock_prices ?? null,
    realEstatePrices: r.real_estate_prices ?? r.game_sessions?.real_estate_prices ?? null,
```

- [ ] **Step 4: 구현 — `server/index.js` `GET /api/results/:sessionId`**

`players: results.map(...)` 객체에서 `playerUuid: r.player_uuid,` 앞에 추가:

```js
        // 경쟁 모드 참여자는 자기 가격, 일반 모드는 위의 세션 가격과 같다.
        stockPrices: r.stock_prices ?? session.stock_prices,
        realEstatePrices: r.real_estate_prices ?? session.real_estate_prices,
```

(index.js에는 라우트 테스트가 없다. Task 18의 수동 확인에서 검증한다.)

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add server/db.js server/db.test.js server/index.js
git commit -m "feat: expose per-player prices in results and rankings"
```

---

### Task 6: 팀 비교 데이터 `getCompetitionTeams` + `GET /api/results/:sessionId/competition`

**Files:**
- Modify: `server/db.js` (새 함수, 파일 끝)
- Modify: `server/index.js` (import, 라우트)
- Test: `server/db.test.js` (새 describe)

- [ ] **Step 1: 실패하는 테스트 작성**

`server/db.test.js` 끝에 추가:

```js
describe('getCompetitionTeams', () => {
  function builder(result) {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: resolve => resolve(result),
    }
    return b
  }

  it('경쟁 모드 수업의 등록된 팀을 만든 순서로 "팀 N"(제목 우선)으로 부르고 팀별로 합산한다', async () => {
    const sessionBuilder = builder({ data: { id: 's2', class_id: 'c1', classes: { mode: 'competition' } }, error: null })
    const teamsBuilder = builder({ data: [
      { id: 's1', title: null, created_at: 't1', game_results: [
        { cash: 1000, stock_value: 2000, real_estate_value: 3000, total_assets: 6000 },
        { cash: 500, stock_value: '100', real_estate_value: null, total_assets: 600 },
      ] },
      { id: 's2', title: '  호랑이팀 ', created_at: 't2', game_results: [
        { cash: 0, stock_value: 0, real_estate_value: 0, total_assets: 0 },
      ] },
      { id: 's3', title: '', created_at: 't3', game_results: [] },
    ], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValueOnce(sessionBuilder).mockReturnValueOnce(teamsBuilder)

    const { getCompetitionTeams } = await import('./db.js')
    const result = await getCompetitionTeams('s2')

    expect(sessionBuilder.eq).toHaveBeenCalledWith('id', 's2')
    expect(teamsBuilder.eq).toHaveBeenCalledWith('class_id', 'c1')
    expect(teamsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual({
      mySessionId: 's2',
      teams: [
        { sessionId: 's1', name: '팀 1', cash: 1500, stockValue: 2100, realEstateValue: 3000, totalAssets: 6600, playerCount: 2 },
        { sessionId: 's2', name: '호랑이팀', cash: 0, stockValue: 0, realEstateValue: 0, totalAssets: 0, playerCount: 1 },
        { sessionId: 's3', name: '팀 3', cash: 0, stockValue: 0, realEstateValue: 0, totalAssets: 0, playerCount: 0 },
      ],
    })
  })

  it('일반 모드 수업·미배정 수업·없는 세션이면 null을 돌려준다', async () => {
    const { getCompetitionTeams } = await import('./db.js')
    for (const data of [
      { id: 's1', class_id: 'c1', classes: { mode: 'normal' } },
      { id: 's1', class_id: null, classes: null },
      null,
    ]) {
      mockFrom.mockReset()
      mockFrom.mockReturnValueOnce(builder({ data, error: null }))
      expect(await getCompetitionTeams('s1')).toBeNull()
    }
  })

  it('조회 에러가 나면 예외를 던진다', async () => {
    mockFrom.mockReset()
    mockFrom.mockReturnValueOnce(builder({ data: null, error: { message: 'boom' } }))
    const { getCompetitionTeams } = await import('./db.js')
    await expect(getCompetitionTeams('s1')).rejects.toEqual({ message: 'boom' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/db.test.js -t getCompetitionTeams`
Expected: FAIL — `getCompetitionTeams is not a function`

- [ ] **Step 3: 구현 — `server/db.js` 끝에 추가**

```js
function sumColumn(rows, column) {
  return rows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0)
}

// 경쟁 모드 결과 화면의 팀 비교 대시보드. 경쟁 모드 수업의 결과가 아니면 null.
// 팀 이름은 관리자 팀 현황(teamDisplayName)과 같이 제목이 있으면 제목, 없으면 만든 순서대로 "팀 N".
export async function getCompetitionTeams(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, class_id, classes(mode)')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionError) throw sessionError
  if (!session?.class_id || session.classes?.mode !== 'competition') return null

  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('id, title, created_at, game_results(cash, stock_value, real_estate_value, total_assets)')
    .eq('class_id', session.class_id)
    .order('created_at', { ascending: true })
  if (sessionsError) throw sessionsError

  return {
    mySessionId: session.id,
    teams: sessions.map((s, i) => {
      const rows = s.game_results ?? []
      return {
        sessionId: s.id,
        name: s.title?.trim() || `팀 ${i + 1}`,
        cash: sumColumn(rows, 'cash'),
        stockValue: sumColumn(rows, 'stock_value'),
        realEstateValue: sumColumn(rows, 'real_estate_value'),
        totalAssets: sumColumn(rows, 'total_assets'),
        playerCount: rows.length,
      }
    }),
  }
}
```

- [ ] **Step 4: 구현 — `server/index.js`**

9번 줄 db.js import 목록 끝에 `getCompetitionTeams`를 추가한다.

`app.get('/api/results/:sessionId', …)` 라우트 **바로 위**에 추가:

```js
// 경쟁 모드 결과 화면의 팀 비교 대시보드. 경쟁 모드 수업이 아니면 404 — 화면은 기존 랭킹만 보여준다.
app.get('/api/results/:sessionId/competition', async (req, res) => {
  try {
    const result = await getCompetitionTeams(req.params.sessionId)
    if (!result) return res.status(404).json({ error: 'Not a competition result' })
    res.json(result)
  } catch (err) {
    console.error('competition teams error:', err)
    res.status(500).json({ error: 'Failed to fetch competition teams' })
  }
})
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add server/db.js server/db.test.js server/index.js
git commit -m "feat: add competition team comparison API"
```

---

### Task 7: 서버가 받은 가격을 확인한다 (`index.js` 연결)

**Files:**
- Modify: `server/index.js` (import, `update-pool-player-state`, `PATCH /api/admin/rooms/:code/players/:playerUuid`)

- [ ] **Step 1: import 추가**

`server/index.js` 18번 줄(competition.js import) 다음에:

```js
import { withSanitizedPrices } from './prices.js'
```

- [ ] **Step 2: `update-pool-player-state`**

```js
  socket.on('update-pool-player-state', ({ gameState } = {}) => {
    const info = socket.data.competition
    if (!info || !gameState) return
    const result = updateCompetitionPlayerState(info.classId, info.playerUuid, socket.id, withSanitizedPrices(gameState))
```

(나머지 줄은 그대로)

- [ ] **Step 3: 관리자 참여자 수정 라우트**

`app.patch('/api/admin/rooms/:code/players/:playerUuid', …)` 안의

```js
  const partialGameState = req.body
```

를 다음으로 바꾼다:

```js
  // 경쟁 모드에서 관리자가 참여자 가격을 고칠 때도 같은 규칙으로 확인한다.
  const partialGameState = withSanitizedPrices(req.body)
```

- [ ] **Step 4: 서버 테스트 전체 실행**

Run: `npx vitest run server`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/index.js
git commit -m "feat: sanitize player prices from participants and admins"
```

---

### Task 8: 공용 가격 목록 `PriceListEditor` 분리

**Files:**
- Create: `src/components/PriceListEditor.jsx`
- Create: `src/components/PriceListEditor.test.jsx`
- Modify: `src/components/PriceSettingModal.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

먼저 `src/components/NumberInputModal.test.jsx`를 열어 숫자 입력·확인 버튼 사용법(버튼 이름)을 확인하고, 아래 `'1'`, `'확인'` 부분을 실제 버튼 이름으로 맞춘다.

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PriceListEditor from './PriceListEditor'

const STOCKS = { semiconductor: 2000, finance: 2000, bio: 2000 }

describe('PriceListEditor', () => {
  it('종목 이름·단위·가격을 보여준다', () => {
    render(<PriceListEditor category="stocks" prices={STOCKS} onChange={vi.fn()} />)
    expect(screen.getByText('반도체')).toBeInTheDocument()
    expect(screen.getAllByText('단위: 원')).toHaveLength(3)
    expect(screen.getAllByText('2,000')).toHaveLength(3)
  })

  it('가격을 눌러 계산기로 입력하면 바뀐 목록으로 onChange를 부른다', async () => {
    const onChange = vi.fn()
    render(<PriceListEditor category="stocks" prices={STOCKS} onChange={onChange} />)
    await userEvent.click(screen.getAllByRole('button', { name: /2,000/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith({ semiconductor: 5, finance: 2000, bio: 2000 })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/PriceListEditor.test.jsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 — `src/components/PriceListEditor.jsx`**

`PriceSettingModal.jsx`의 목록·계산기 부분을 그대로 옮긴다:

```jsx
import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import {
  MAX_ASSET_PRICE,
  STOCK_LABELS, STOCK_IMAGES,
  REAL_ESTATE_LABELS, ESTATE_IMAGES as REAL_ESTATE_IMAGES,
} from '../constants/gameData'
import styles from './PriceSettingModal.module.css'

// 한 종류(주식 또는 부동산)의 가격 목록과 계산기. 관리자 가격 설정 모달과 경쟁 모드 가격 단계가 함께 쓴다.
// prices: 그 종류의 { 종목키: 가격 } / onChange: 바뀐 { 종목키: 가격 } 전체를 받는다.
export default function PriceListEditor({ category, prices, onChange }) {
  const [editingKey, setEditingKey] = useState(null)

  const labels = category === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const images = category === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const folder = category === 'stocks' ? 'stock' : 'estate'

  return (
    <>
      <div className={styles.list}>
        {Object.keys(labels).map(key => (
          <div key={key} className={styles.row}>
            <img src={`/badges/${folder}/${images[key]}.png`} alt="" className={styles.rowIcon} />
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{labels[key]}</span>
              <span className={styles.rowUnit}>단위: 원</span>
            </div>
            <button type="button" className={styles.pricePill} onClick={() => setEditingKey(key)}>
              <span className={styles.priceValue}>{prices[key].toLocaleString()}</span>{' '}
              <span className={styles.priceUnitLabel}>원 ›</span>
            </button>
          </div>
        ))}
      </div>

      {editingKey && (
        <NumberInputModal
          title={labels[editingKey]}
          // 새 가격을 바로 입력할 수 있도록 계산기는 현재 가격 대신 0원에서 시작한다.
          initialValue={0}
          unit="원"
          maxValue={MAX_ASSET_PRICE}
          onConfirm={val => {
            onChange({ ...prices, [editingKey]: val })
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: `PriceSettingModal.jsx`가 `PriceListEditor`를 쓰도록 바꾸기**

- `useState`의 `editingKey`, `NumberInputModal` import, `MAX_ASSET_PRICE`, `labels/images/folder/editingLabel` 변수를 지운다(`STOCK_LABELS` 등 re-export는 남긴다).
- `<div className={styles.list}>…</div>` 블록과 아래 `{editingKey && (<NumberInputModal …/>)}` 블록을 다음으로 바꾼다:

```jsx
          <PriceListEditor
            category={category}
            prices={tempPrices[category]}
            onChange={next => setTempPrices(prev => ({ ...prev, [category]: next }))}
          />
```

- 바깥 `<>…</>` 프래그먼트는 이제 자식이 하나이므로 지운다.
- import 추가: `import PriceListEditor from './PriceListEditor'`

- [ ] **Step 5: 통과 확인 (기존 모달 테스트 포함)**

Run: `npx vitest run src/components/PriceListEditor.test.jsx src/components/PriceSettingModal.test.jsx src/pages/Team.test.jsx src/components/admin`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/PriceListEditor.jsx src/components/PriceListEditor.test.jsx src/components/PriceSettingModal.jsx
git commit -m "refactor: extract PriceListEditor from PriceSettingModal"
```

---

### Task 9: `AssetInputSteps`에 경쟁 모드 가격 단계 추가 (`editablePrices`)

**Files:**
- Modify: `src/components/AssetInputSteps.jsx`
- Modify: `src/pages/IndividualPage.module.css` (끝에 스타일 추가)
- Test: `src/components/AssetInputSteps.test.jsx`

- [ ] **Step 1: 테스트 바꾸기 — `hidePrices` 테스트를 지우고 새 테스트 추가**

`'hidePrices면 가격을 숨긴다'` 테스트를 지우고 다음을 추가한다(NumberInputModal 버튼 이름은 Task 8에서 확인한 것으로 맞춘다):

```jsx
  function competitionState() {
    return { ...defaultGameState(), prices: {
      stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
    } }
  }

  it('일반 모드는 5단계이고 가격 단계가 없다', () => {
    render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.queryByText('주식 가격')).not.toBeInTheDocument()
  })

  it('editablePrices면 성공열쇠 다음에 주식 가격, 주식 다음에 부동산 가격 단계가 나온다', async () => {
    render(<AssetInputSteps editablePrices gameState={competitionState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식 가격' })).toBeInTheDocument()
    expect(screen.getByText('게임이 끝났을 때의 가격을 입력해주세요')).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산 가격' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '현금' })).toBeInTheDocument()
  })

  it('가격 단계에서 고친 가격을 onChange로 알리고, 수량 단계에 그 가격을 보여준다', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<AssetInputSteps editablePrices gameState={competitionState()} onChange={onChange} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getAllByRole('button', { name: /2,000/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    const next = onChange.mock.lastCall[0]
    expect(next.prices.stocks).toEqual({ semiconductor: 5, finance: 2000, bio: 2000 })

    rerender(<AssetInputSteps editablePrices gameState={next} onChange={onChange} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
    expect(screen.getByText('5원')).toBeInTheDocument()
  })

  it('가격 단계의 초기화는 그 종류만 기본 가격으로 되돌린다', async () => {
    const onChange = vi.fn()
    const state = competitionState()
    state.prices = { stocks: { semiconductor: 1, finance: 1, bio: 1 }, realEstate: { gaon: 1, dami: 1, chorong: 1 } }
    render(<AssetInputSteps editablePrices gameState={state} onChange={onChange} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      prices: { stocks: { semiconductor: 2000, finance: 2000, bio: 2000 }, realEstate: { gaon: 1, dami: 1, chorong: 1 } },
    }))
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/AssetInputSteps.test.jsx`
Expected: 새 테스트 FAIL (기존 테스트는 PASS)

- [ ] **Step 3: 구현 — 단계를 키로 정의**

`src/components/AssetInputSteps.jsx` 위쪽의 `STEPS`, `VISITED_KEY_BY_STEP`, `computeCompletedUpTo`를 다음으로 바꾼다(`defaultGameState`, `priceLabels`는 그대로):

```jsx
import PriceListEditor from './PriceListEditor'

const STEP_LABELS = {
  job: '직업', badges: '성공열쇠', stockPrices: '주식 가격', stocks: '주식',
  realEstatePrices: '부동산 가격', realEstate: '부동산', cash: '현금',
}
const NORMAL_STEPS = ['job', 'badges', 'stocks', 'realEstate', 'cash']
// 경쟁 모드는 참여자가 직접 가격을 정하므로 수량 입력 앞에 가격 단계를 둔다.
const COMPETITION_STEPS = ['job', 'badges', 'stockPrices', 'stocks', 'realEstatePrices', 'realEstate', 'cash']
const VISITED_KEY_BY_STEP = { job: 'jobVisited', badges: 'badgesVisited', stocks: 'stocksVisited', realEstate: 'realEstateVisited' }
const PRICE_CATEGORY_BY_STEP = { stockPrices: 'stocks', realEstatePrices: 'realEstate' }

// 저장된 방문 표시로 어느 단계까지 마쳤는지(steps 안의 인덱스) 계산한다. 가격 단계는 따로 표시가 없어
// 뒤 단계를 마쳤으면 함께 마친 것으로 본다.
export function computeCompletedUpTo(gameState, steps = NORMAL_STEPS) {
  const done = {
    job: gameState.job !== null || gameState.jobVisited,
    badges: gameState.badgesVisited,
    stocks: gameState.stocksVisited,
    realEstate: gameState.realEstateVisited,
    cash: gameState.isCompleted,
  }
  let upTo = -1
  steps.forEach((key, i) => { if (done[key]) upTo = i })
  return upTo
}
```

- [ ] **Step 4: 구현 — 컴포넌트 본문**

컴포넌트 시그니처와 주석을 바꾼다:

```jsx
// 직업 → 성공열쇠 → 주식 → 부동산 → 현금 입력 단계. 일반 모드(IndividualPage)와 경쟁 모드(CompetitionPlay)가 함께 쓴다.
// syncToken: 부모가 서버에서 상태를 다시 받아올 때마다 올리면 완료 단계·현금 표시를 그 상태에 맞춘다.
// editablePrices: 경쟁 모드. 참여자가 주식·부동산 가격을 직접 정하는 단계를 넣고, 수량 단계에 gameState.prices를 보여준다.
export default function AssetInputSteps({ gameState, onChange, onComplete, prices, editablePrices = false, syncToken = 0 }) {
  const steps = editablePrices ? COMPETITION_STEPS : NORMAL_STEPS
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(() => computeCompletedUpTo(gameState, steps))
```

`useEffect` 안의 `computeCompletedUpTo(latestGameState.current)`를 `computeCompletedUpTo(latestGameState.current, steps)`로 바꾼다(의존성 배열 `[syncToken]`은 그대로 — `steps`는 렌더 동안 바뀌지 않는다. eslint 경고가 나면 `// eslint-disable-next-line react-hooks/exhaustive-deps`를 기존 스타일대로 붙인다).

`handleNext`를 바꾼다:

```jsx
  const stepKey = steps[step]
  const isLastStep = step === steps.length - 1

  function handleNext() {
    if (isLastStep) { handleComplete(); return }

    const visitedKey = VISITED_KEY_BY_STEP[stepKey]
    if (visitedKey && !gameState[visitedKey]) onChange({ ...gameState, [visitedKey]: true })

    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }
```

`const noPrices = {}`를 지우고 다음을 넣는다:

```jsx
  const shownPrices = editablePrices ? gameState.prices : prices
  const priceCategory = PRICE_CATEGORY_BY_STEP[stepKey]

  function handlePriceChange(category, next) {
    onChange({ ...gameState, prices: { ...gameState.prices, [category]: next } })
  }
```

JSX:
- `<StepBar steps={STEPS} …>`를 `<StepBar steps={steps.map(key => STEP_LABELS[key])} …>`로 바꾼다.
- `{step === 0 && (` → `{stepKey === 'job' && (`, `step === 1` → `stepKey === 'badges'`, `step === 3` → `stepKey === 'realEstate'`, `step === 2` → `stepKey === 'stocks'`, `step === 4` → `stepKey === 'cash'`.
- 부동산·주식 단계의 `priceLabels={hidePrices ? noPrices : priceLabels(prices, 'realEstate')}`를 `priceLabels={priceLabels(shownPrices, 'realEstate')}`로, 주식도 `priceLabels(shownPrices, 'stocks')`로 바꾼다.
- 성공열쇠 블록 다음에 가격 단계를 추가한다:

```jsx
      {priceCategory && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <div className={styles.priceStepHeader}>
            <h1 className={styles.stepTitle}>{STEP_LABELS[stepKey]}</h1>
            <button
              type="button"
              className={styles.priceResetBtn}
              onClick={() => handlePriceChange(priceCategory, DEFAULT_PRICES[priceCategory])}
            >
              초기화
            </button>
          </div>
          <p className={styles.stepSubtitle}>게임이 끝났을 때의 가격을 입력해주세요</p>
          <div className={styles.fillWrapper}>
            <PriceListEditor
              category={priceCategory}
              prices={gameState.prices[priceCategory]}
              onChange={next => handlePriceChange(priceCategory, next)}
            />
          </div>
        </div>
      )}
```

- 아래 버튼 문구 `{step === 4 ? '완료' : '다음'}`를 `{isLastStep ? '완료' : '다음'}`로 바꾼다.

- [ ] **Step 5: 스타일 — `src/pages/IndividualPage.module.css` 끝에 추가**

`.stepTitle`과 `.stepSubtitle`의 기존 값(글꼴 크기·여백)을 먼저 확인하고, 아래 값이 어울리지 않으면 그에 맞춘다:

```css
/* 경쟁 모드 가격 단계: 제목 오른쪽에 초기화 버튼 */
.priceStepHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.priceResetBtn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 6: 통과 확인 (일반 모드 회귀 포함)**

Run: `npx vitest run src/components/AssetInputSteps.test.jsx src/pages/IndividualPage.test.jsx src/components/StepBar.test.jsx`
Expected: PASS. `CompetitionPlay.test.jsx`는 Task 10에서 고치므로 지금은 실패할 수 있다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/AssetInputSteps.jsx src/components/AssetInputSteps.test.jsx src/pages/IndividualPage.module.css
git commit -m "feat: add player price steps to competition asset input"
```

---

### Task 10: `CompetitionPlay`가 가격 단계를 쓴다

**Files:**
- Modify: `src/pages/CompetitionPlay.jsx`
- Test: `src/pages/CompetitionPlay.test.jsx`

- [ ] **Step 1: 테스트 바꾸기**

첫 테스트 `'대기 명단에 들어가 가격 없이 자산을 입력하고, 바뀔 때마다 서버에 저장한다'`의 이름과 마지막 두 줄을 바꾼다:

```jsx
  it('대기 명단에 들어가 자산을 입력하고, 바뀔 때마다 서버에 저장한다', async () => {
    // … 기존 줄 그대로 (두 번째 '다음' 클릭까지) …
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식 가격' })).toBeInTheDocument()
  })
```

새 테스트 추가:

```jsx
  it('가격이 없는 참여자는 기본 가격으로 채워서 보여준다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getAllByText('2,000')).toHaveLength(3)
  })

  it('다시 입력하기를 눌러도 정한 가격은 그대로 둔다', async () => {
    const prices = {
      stocks: { semiconductor: 7000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
    }
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), prices, isCompleted: true } }
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '다시 입력하기' }))
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ isCompleted: false, prices }),
    }))
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/CompetitionPlay.test.jsx`
Expected: FAIL (`hidePrices` 사용 중이라 가격 단계 없음)

- [ ] **Step 3: 구현**

`src/pages/CompetitionPlay.jsx`:

import 추가:

```jsx
import { DEFAULT_PRICES } from '../components/PriceSettingModal'
```

컴포넌트 위에 헬퍼 추가:

```jsx
// 가격 단계가 생기기 전에 들어온 참여자처럼 가격이 없으면 기본 가격으로 시작한다.
function withPrices(gameState) {
  return gameState?.prices ? gameState : { ...gameState, prices: DEFAULT_PRICES }
}
```

`join()` 안의 `setGameState(res.gameState)`를 `setGameState(withPrices(res.gameState))`로, `onStateUpdated` 안의 `setGameState(next)`를 `setGameState(withPrices(next))`로 바꾼다.

마지막 return의 `<AssetInputSteps hidePrices …>`를 `<AssetInputSteps editablePrices …>`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/CompetitionPlay.test.jsx src/components/AssetInputSteps.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/CompetitionPlay.jsx src/pages/CompetitionPlay.test.jsx
git commit -m "feat: let competition players set their own prices"
```

---

### Task 11: 수업 목록의 경쟁 배지를 이름 옆으로

**Files:**
- Modify: `src/pages/AdminClassList.jsx:105-108`
- Modify: `src/pages/AdminClassList.module.css`
- Test: `src/pages/AdminClassList.test.jsx:174-181`

- [ ] **Step 1: 테스트 바꾸기**

`'경쟁 모드 수업에만 경쟁 배지를 붙인다'` 테스트 끝에 추가:

```jsx
    // 배지는 수업 이름 밑이 아니라 같은 줄(이름 옆)에 있다.
    expect(badges[0].parentElement).toHaveTextContent(/^경쟁반경쟁$/)
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/AdminClassList.test.jsx`
Expected: FAIL (부모가 날짜까지 포함한 버튼)

- [ ] **Step 3: 구현**

`AdminClassList.jsx`:

```jsx
              <span className={styles.itemTitleRow}>
                <span className={styles.itemName}>{cls.name}</span>
                {cls.mode === 'competition' && <span className={styles.modeBadge}>경쟁</span>}
              </span>
              {cls.createdAt && <span className={styles.itemDate}>{formatDate(cls.createdAt)}</span>}
```

`AdminClassList.module.css`, `.itemName` 위에 추가:

```css
.itemTitleRow { display: flex; align-items: center; gap: 6px; }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/AdminClassList.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminClassList.jsx src/pages/AdminClassList.module.css src/pages/AdminClassList.test.jsx
git commit -m "feat: show competition badge next to class name"
```

---

### Task 12: 경쟁 모드 팀 카드에서 팀 가격 탭 숨기기

**Files:**
- Modify: `src/components/admin/AdminGridCard.jsx:78-90`
- Test: `src/components/admin/AdminGridCard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`AdminGridCard.test.jsx`에서 `competition` prop을 쓰는 기존 테스트를 찾아 같은 `room` 준비 코드를 쓰고 추가:

```jsx
  it('경쟁 모드에서는 주식·부동산 가격 탭을 숨기고, 카드를 누르면 관전 화면을 연다', async () => {
    const onSpectate = vi.fn()
    render(<AdminGridCard room={room} competition onSpectate={onSpectate} />)
    expect(screen.queryByRole('button', { name: '주식' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '부동산' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('admin-team-card').querySelector('button'))
    expect(onSpectate).toHaveBeenCalledWith(room)
  })
```

(`room`은 그 파일의 기존 픽스처 이름에 맞춘다. 카드 버튼 선택이 기존 테스트와 다르면 기존 방식을 따른다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/AdminGridCard.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`AdminGridCard.jsx`의 `<div className={styles.tabs}>…</div>`를 감싼다:

```jsx
        {/* 경쟁 모드는 참여자가 각자 가격을 정하므로 팀 가격 탭(보기·설정)을 쓰지 않는다. */}
        {!competition && (
          <div className={styles.tabs}>
            {TABS.map(t => (
              …기존 그대로…
            ))}
          </div>
        )}
```

`competition`이면 `tab`이 항상 `'lobby'`이므로 `handleCardClick`은 늘 `onSpectate`를 부른다. 그대로 둔다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/admin`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/AdminGridCard.jsx src/components/admin/AdminGridCard.test.jsx
git commit -m "feat: hide team price tabs on competition team cards"
```

---

### Task 13: 관전·수정 화면에서 참여자별 가격 설정

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`
- Modify: `src/pages/AdminClassDashboard.jsx:362-368`
- Test: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`AdminSpectateModal.test.jsx`의 기존 픽스처(`rooms`, `adminFetch` mock 방식)를 읽고 같은 방식으로 추가한다. 참여자 하나는 `gameState.prices`를 갖게 한다:

```jsx
  it('경쟁 모드에서는 팀 가격 설정 버튼을 숨기고, 참여자 수정 화면에서 그 참여자의 가격을 저장한다', async () => {
    const prices = {
      stocks: { semiconductor: 7000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
    }
    const competitionRooms = [{
      ...rooms[0],
      players: [{ ...rooms[0].players[0], gameState: { ...rooms[0].players[0].gameState, prices } }],
    }]
    render(
      <AdminSpectateModal competition rooms={competitionRooms} initialIndex={0}
        onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: '가격 설정' })).not.toBeInTheDocument()

    // 참여자 카드의 수정 버튼(기존 테스트가 쓰는 방식으로 연다)
    await userEvent.click(screen.getAllByRole('button', { name: /수정/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '가격 설정' }))
    expect(screen.getByText('7,000 원 ›')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '확인하기' }))

    expect(adminFetch).toHaveBeenCalledWith(
      `/api/admin/rooms/${competitionRooms[0].code}/players/${competitionRooms[0].players[0].playerUuid}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ prices }) }),
    )
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현 — `AdminSpectateModal.jsx`**

import 추가:

```jsx
import { DEFAULT_PRICES } from '../PriceSettingModal'
```

시그니처에 `competition = false`를 추가하고 위에 주석을 단다:

```jsx
// competition: 경쟁 모드 수업. 참여자가 각자 가격을 정하므로 팀 가격 대신 참여자 수정 화면에서 그 참여자의 가격을 고친다.
export default function AdminSpectateModal({ rooms, initialIndex, onPlayerUpdate, onClose, onRoomChanged, competition = false }) {
```

state 추가(`showPriceModal` 옆):

```jsx
  const [showPlayerPriceModal, setShowPlayerPriceModal] = useState(false)
```

`if (editingPlayerUuid) { … }` 블록을 다음으로 바꾼다:

```jsx
  if (editingPlayerUuid) {
    const player = room.players.find(p => p.playerUuid === editingPlayerUuid)
    const playerPrices = player.gameState.prices ?? DEFAULT_PRICES
    return (
      <>
        <AdminEditModal
          player={player}
          prices={competition ? playerPrices : room.prices}
          onSave={(field, value) => handleSave(editingPlayerUuid, field, value)}
          onClose={() => setEditingPlayerUuid(null)}
          headerAction={competition && (
            <button type="button" className={styles.priceBtn} onClick={() => setShowPlayerPriceModal(true)}>가격 설정</button>
          )}
        />
        {showPlayerPriceModal && (
          <AdminPriceSettingModal
            prices={playerPrices}
            onConfirm={async newPrices => {
              setShowPlayerPriceModal(false)
              await handleSave(editingPlayerUuid, 'prices', newPrices)
            }}
            onClose={() => setShowPlayerPriceModal(false)}
          />
        )}
      </>
    )
  }
```

팀 가격 설정 버튼 조건을 바꾼다:

```jsx
        {!room.registered && !competition && (
          <button type="button" className={styles.priceBtn} onClick={() => setShowPriceModal(true)}>가격 설정</button>
        )}
```

`AdminEditModal`의 `headerAction` 위치(헤더 안)에서 `styles.priceBtn` 크기가 어색하면 `AdminSpectateModal.module.css`에 `.playerPriceBtn`을 따로 만들어 쓴다(Task 18 화면 확인 때 판단).

- [ ] **Step 4: 구현 — `AdminClassDashboard.jsx`**

```jsx
            <AdminSpectateModal
              rooms={rooms}
              initialIndex={spectateIndex}
              competition={competition}
              onPlayerUpdate={handlePlayerUpdate}
              onClose={() => setSpectateIndex(null)}
              onRoomChanged={loadRooms}
            />
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/components/admin src/pages/AdminClassDashboard.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.test.jsx src/pages/AdminClassDashboard.jsx
git commit -m "feat: edit competition player prices from spectate modal"
```

---

### Task 14: 보고서·안내서·팀 랭킹이 참여자 가격을 쓴다 (`pricesForPlayer`)

**Files:**
- Create: `src/utils/playerPrices.js`
- Create: `src/utils/playerPrices.test.js`
- Modify: `src/pages/EconomicReport.jsx:116-119`
- Modify: `src/pages/ParentGuide.jsx:62`
- Modify: `src/pages/RankingPage.jsx:80-85`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest'
import { pricesForPlayer } from './playerPrices'

const RESULT = { stockPrices: { bio: 1 }, realEstatePrices: { gaon: 1 } }

describe('pricesForPlayer', () => {
  it('참여자 가격이 있으면 그 가격을 쓴다', () => {
    expect(pricesForPlayer({ stockPrices: { bio: 9 }, realEstatePrices: { gaon: 9 } }, RESULT))
      .toEqual({ stockPrices: { bio: 9 }, realEstatePrices: { gaon: 9 } })
  })

  it('참여자 가격이 없으면 결과(세션) 가격을 쓴다', () => {
    expect(pricesForPlayer({}, RESULT)).toEqual(RESULT)
    expect(pricesForPlayer({ stockPrices: null, realEstatePrices: null }, RESULT)).toEqual(RESULT)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/utils/playerPrices.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/utils/playerPrices.js`:

```js
// 경쟁 모드 참여자는 자기가 정한 가격을 갖고, 일반 모드는 그 게임(세션)의 가격을 쓴다.
// result: GET /api/results/:sessionId 응답(최상위 stockPrices/realEstatePrices가 세션 가격).
export function pricesForPlayer(player, result) {
  return {
    stockPrices: player.stockPrices ?? result.stockPrices,
    realEstatePrices: player.realEstatePrices ?? result.realEstatePrices,
  }
}
```

`EconomicReport.jsx` (import `pricesForPlayer` from `'../utils/playerPrices'`):

```jsx
  // 경쟁 모드는 참여자마다, 일반 모드는 게임(세션)마다 가격이 다르다.
  const result = calcEconomicPotential({ ...me, ...pricesForPlayer(me, data) })
```

(바로 위의 기존 주석 "결과 API는 가격을 플레이어가 아니라 …"는 지운다.)

`ParentGuide.jsx` (같은 import):

```jsx
  const guide = buildParentGuide(me, pricesForPlayer(me, data))
```

`RankingPage.jsx` 팀 범위 매핑 (같은 import):

```jsx
            .map(p => ({
              ...p,
              // 순자산 = 현금 + 주식평가액 + 부동산평가액 (성공열쇠 배수 미적용).
              // 팀 스코프 응답엔 netWorth가 없으므로 여기서 계산한다.
              netWorth: (p.cash ?? 0) + (p.stockValue ?? 0) + (p.realEstateValue ?? 0),
              ...pricesForPlayer(p, data),
            }))
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/utils/playerPrices.test.js src/pages/EconomicReport.test.jsx src/pages/ParentGuide.test.jsx src/pages/RankingPage.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/utils/playerPrices.js src/utils/playerPrices.test.js src/pages/EconomicReport.jsx src/pages/ParentGuide.jsx src/pages/RankingPage.jsx
git commit -m "feat: use per-player prices in report, guide and team ranking"
```

---

### Task 15: 팀 비교 막대그래프 `TeamStatSlide`

**Files:**
- Create: `src/components/TeamStatSlide.jsx`
- Create: `src/components/TeamStatSlide.module.css`
- Create: `src/components/TeamStatSlide.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TeamStatSlide from './TeamStatSlide'

const TEAMS = [
  { sessionId: 's1', name: '팀 1', cash: 1000 },
  { sessionId: 's2', name: '팀 2', cash: 3000 },
  { sessionId: 's3', name: '팀 3', cash: 0 },
]

function renderSlide(teams = TEAMS, mySessionId = 's1') {
  return render(<TeamStatSlide title="더 많은 현금을 가진 팀은?" valueKey="cash" teams={teams} mySessionId={mySessionId} />)
}

describe('TeamStatSlide', () => {
  it('제목과 1위 팀을 보여주고, 값이 큰 팀부터 막대를 그린다', () => {
    renderSlide()
    expect(screen.getByRole('heading', { name: '더 많은 현금을 가진 팀은?' })).toBeInTheDocument()
    expect(screen.getByText('🏆 팀 2')).toBeInTheDocument()
    const rows = screen.getAllByTestId('team-stat-row')
    expect(rows.map(r => within(r).getByTestId('team-stat-name').textContent)).toEqual(['팀 2', '팀 1우리 팀', '팀 3'])
    expect(within(rows[0]).getByText('3,000원')).toBeInTheDocument()
    expect(within(rows[2]).getByText('0원')).toBeInTheDocument()
  })

  it('막대 길이는 1위 값 기준이고 0원은 길이 0이다', () => {
    renderSlide()
    const bars = screen.getAllByTestId('team-stat-bar')
    expect(bars[0].style.width).toBe('100%')
    expect(bars[1].style.width).toBe(`${(1000 / 3000) * 100}%`)
    expect(bars[2].style.width).toBe('0%')
  })

  it('우리 팀 줄을 강조하고 "우리 팀"을 붙인다', () => {
    renderSlide()
    const mine = screen.getByText('우리 팀').closest('[data-testid="team-stat-row"]')
    expect(mine).toHaveAttribute('data-mine', 'true')
    expect(screen.getAllByText('우리 팀')).toHaveLength(1)
  })

  it('1위가 동점이면 함께 보여준다', () => {
    renderSlide([
      { sessionId: 's1', name: '팀 1', cash: 500 },
      { sessionId: 's2', name: '팀 2', cash: 100 },
      { sessionId: 's3', name: '팀 3', cash: 500 },
    ])
    expect(screen.getByText('🏆 팀 1 · 팀 3')).toBeInTheDocument()
  })

  it('모든 팀이 0원이면 막대 길이가 모두 0이다', () => {
    renderSlide([{ sessionId: 's1', name: '팀 1', cash: 0 }])
    expect(screen.getByTestId('team-stat-bar').style.width).toBe('0%')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/TeamStatSlide.test.jsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 — `src/components/TeamStatSlide.jsx`**

```jsx
import styles from './TeamStatSlide.module.css'

// 경쟁 모드 결과 화면: 한 가지 수치(valueKey)로 같은 수업의 팀들을 가로 막대그래프로 비교한다.
// 값이 큰 팀부터 놓고(동점이면 팀 순서), 막대 길이는 1위 값을 기준으로 정한다.
export default function TeamStatSlide({ title, valueKey, teams, mySessionId }) {
  const sorted = [...teams].sort((a, b) => b[valueKey] - a[valueKey])
  const top = sorted[0]?.[valueKey] ?? 0
  const winners = sorted.filter(team => team[valueKey] === top).map(team => team.name)

  return (
    <section className={styles.slide} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.winner}>🏆 {winners.join(' · ')}</p>
      <ol className={styles.bars}>
        {sorted.map(team => {
          const value = team[valueKey]
          const mine = team.sessionId === mySessionId
          return (
            <li
              key={team.sessionId}
              className={`${styles.row} ${mine ? styles.mine : ''}`}
              data-testid="team-stat-row"
              data-mine={mine ? 'true' : undefined}
            >
              <span className={styles.name} data-testid="team-stat-name">
                {team.name}
                {mine && <span className={styles.myTag}>우리 팀</span>}
              </span>
              <span className={styles.track}>
                <span
                  className={styles.bar}
                  data-testid="team-stat-bar"
                  style={{ width: `${top > 0 ? (value / top) * 100 : 0}%` }}
                />
              </span>
              <span className={styles.value}>{value.toLocaleString('ko-KR')}원</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: 스타일 — `src/components/TeamStatSlide.module.css`**

전역 토큰(`src/index.css`의 `--blue-accent`, `--ghost`, `--ink`, `--ink-2`, `--white`, `--line`)을 쓴다:

```css
.slide {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 72px 4px 16px; /* 위쪽 공유 버튼 줄과 겹치지 않게 */
  height: 100%;
  overflow-y: auto;
}

.title { font-size: 22px; font-weight: 800; color: var(--ink); text-align: center; }
.winner { font-size: 18px; font-weight: 700; color: var(--ink); text-align: center; margin-bottom: 8px; }

.bars { list-style: none; display: flex; flex-direction: column; gap: 10px; }

.row {
  display: grid;
  grid-template-columns: minmax(64px, 28%) 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--white);
  border: 1px solid var(--line);
}
.mine { border-color: var(--blue-accent); }

.name { font-size: 14px; font-weight: 700; color: var(--ink); display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
.myTag { font-size: 11px; font-weight: 700; color: var(--blue-accent); }

.track { height: 14px; border-radius: 999px; background: var(--gray-10); overflow: hidden; }
.bar { display: block; height: 100%; border-radius: 999px; background: var(--ghost); }
.mine .bar { background: var(--blue-accent); }

.value { font-size: 13px; font-weight: 700; color: var(--ink-2); white-space: nowrap; }
.mine .value { color: var(--ink); }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/components/TeamStatSlide.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/TeamStatSlide.jsx src/components/TeamStatSlide.module.css src/components/TeamStatSlide.test.jsx
git commit -m "feat: add team comparison bar chart slide"
```

---

### Task 16: 5장 캐러셀 `CompetitionResultCarousel`

**Files:**
- Create: `src/components/CompetitionResultCarousel.jsx`
- Create: `src/components/CompetitionResultCarousel.module.css`
- Create: `src/components/CompetitionResultCarousel.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import CompetitionResultCarousel from './CompetitionResultCarousel'

const TEAMS = [
  { sessionId: 's1', name: '팀 1', cash: 1, stockValue: 2, realEstateValue: 3, totalAssets: 6 },
  { sessionId: 's2', name: '팀 2', cash: 4, stockValue: 5, realEstateValue: 6, totalAssets: 15 },
]

function renderCarousel() {
  return render(
    <CompetitionResultCarousel teams={TEAMS} mySessionId="s1">
      <div>랭킹 본문</div>
    </CompetitionResultCarousel>
  )
}

function currentDot() {
  return screen.getAllByRole('button', { name: /번째 화면$/ }).findIndex(b => b.getAttribute('aria-current') === 'true')
}

describe('CompetitionResultCarousel', () => {
  it('현금 → 주식 → 부동산 → 총 자산 → 랭킹 순서로 5장을 그린다', () => {
    renderCarousel()
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      '더 많은 현금을 가진 팀은?',
      '주식으로 더 많은 돈을 번 팀은?',
      '부동산으로 더 많은 돈을 번 팀은?',
      '총 자산이 더 많은 팀은?',
    ])
    expect(screen.getByText('랭킹 본문')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /번째 화면$/ })).toHaveLength(5)
  })

  it('첫 장에서 시작하고, 첫 장에서는 이전 화살표가 비활성이다', () => {
    renderCarousel()
    expect(currentDot()).toBe(0)
    expect(screen.getByRole('button', { name: '이전 화면' })).toBeDisabled()
  })

  it('다음 화살표와 점으로 이동하고, 마지막 장에서는 다음 화살표가 비활성이다', async () => {
    renderCarousel()
    await userEvent.click(screen.getByRole('button', { name: '다음 화면' }))
    expect(currentDot()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: '5번째 화면' }))
    expect(currentDot()).toBe(4)
    expect(screen.getByRole('button', { name: '다음 화면' })).toBeDisabled()
  })

  it('손으로 쓸어넘겨 스크롤 위치가 바뀌면 현재 장을 따라간다', () => {
    renderCarousel()
    const track = screen.getByTestId('result-carousel-track')
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true })
    track.scrollLeft = 600
    fireEvent.scroll(track)
    expect(currentDot()).toBe(2)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/CompetitionResultCarousel.test.jsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현 — `src/components/CompetitionResultCarousel.jsx`**

```jsx
import { useRef, useState } from 'react'
import TeamStatSlide from './TeamStatSlide'
import styles from './CompetitionResultCarousel.module.css'

const STAT_SLIDES = [
  { valueKey: 'cash', title: '더 많은 현금을 가진 팀은?' },
  { valueKey: 'stockValue', title: '주식으로 더 많은 돈을 번 팀은?' },
  { valueKey: 'realEstateValue', title: '부동산으로 더 많은 돈을 번 팀은?' },
  { valueKey: 'totalAssets', title: '총 자산이 더 많은 팀은?' },
]

// 경쟁 모드 결과 화면: 팀 비교 4장을 옆으로 넘기고, 마지막 장(children)에서 기존 랭킹을 보여준다.
// 라이브러리 없이 가로 scroll-snap을 쓰고, 현재 장은 스크롤 위치로 계산한다.
export default function CompetitionResultCarousel({ teams, mySessionId, children }) {
  const trackRef = useRef(null)
  const [current, setCurrent] = useState(0)
  const total = STAT_SLIDES.length + 1

  function goTo(index) {
    setCurrent(index)
    const track = trackRef.current
    track?.scrollTo?.({ left: index * track.clientWidth, behavior: 'smooth' })
  }

  function handleScroll() {
    const track = trackRef.current
    if (!track?.clientWidth) return
    setCurrent(Math.round(track.scrollLeft / track.clientWidth))
  }

  return (
    <div className={styles.carousel}>
      <div ref={trackRef} className={styles.track} onScroll={handleScroll} data-testid="result-carousel-track">
        {STAT_SLIDES.map(slide => (
          <div key={slide.valueKey} className={styles.slide}>
            <TeamStatSlide title={slide.title} valueKey={slide.valueKey} teams={teams} mySessionId={mySessionId} />
          </div>
        ))}
        <div className={styles.slide}>{children}</div>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.arrow} aria-label="이전 화면" disabled={current === 0} onClick={() => goTo(current - 1)}>‹</button>
        <div className={styles.dots}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              aria-label={`${i + 1}번째 화면`}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button type="button" className={styles.arrow} aria-label="다음 화면" disabled={current === total - 1} onClick={() => goTo(current + 1)}>›</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 스타일 — `src/components/CompetitionResultCarousel.module.css`**

```css
.carousel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.track {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}
.track::-webkit-scrollbar { display: none; }

.slide {
  flex: 0 0 100%;
  min-width: 0;
  height: 100%;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 8px;
}

.arrow {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--white);
  font-size: 20px;
  color: var(--ink);
  cursor: pointer;
}
.arrow:disabled { color: var(--disabled); cursor: default; }

.dots { display: flex; gap: 8px; }
.dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--ghost);
  cursor: pointer;
}
.dotActive { background: var(--blue-accent); width: 20px; }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/components/CompetitionResultCarousel.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/CompetitionResultCarousel.jsx src/components/CompetitionResultCarousel.module.css src/components/CompetitionResultCarousel.test.jsx
git commit -m "feat: add competition result carousel"
```

---

### Task 17: `RankingPage`가 경쟁 모드면 캐러셀로 감싼다

**Files:**
- Modify: `src/pages/RankingPage.jsx`
- Test: `src/pages/RankingPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`RankingPage.test.jsx`의 `beforeEach` fetch mock에서 `/api/results/` 분기 **앞**에 추가한다. 기본은 404(일반 모드)로 두고, 테스트에서 바꿀 수 있게 변수로 둔다:

```jsx
let competitionResponse = null // null이면 404(일반 모드)
```

`beforeEach` 맨 위에 `competitionResponse = null`을 넣고, fetch mock 안에:

```jsx
    if (url.endsWith('/competition')) {
      return competitionResponse
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(competitionResponse) })
        : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
    }
```

새 테스트:

```jsx
  it('경쟁 모드 결과면 팀 비교 4장 뒤에 랭킹을 보여준다', async () => {
    competitionResponse = {
      mySessionId: 'session-1',
      teams: [
        { sessionId: 'session-1', name: '팀 1', cash: 10, stockValue: 20, realEstateValue: 30, totalAssets: 60, playerCount: 2 },
        { sessionId: 'session-2', name: '팀 2', cash: 40, stockValue: 5, realEstateValue: 6, totalAssets: 51, playerCount: 2 },
      ],
    }
    renderAt('/result/session-1')
    expect(await screen.findByRole('heading', { name: '더 많은 현금을 가진 팀은?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '총 자산이 더 많은 팀은?' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /번째 화면$/ })).toHaveLength(5)
    expect(screen.getByRole('heading', { name: '랭킹' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/results/session-1/competition')
  })

  it('일반 모드(404)면 캐러셀 없이 기존 랭킹만 보여준다', async () => {
    renderAt('/result/session-1')
    expect(await screen.findByRole('heading', { name: '랭킹' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1번째 화면' })).not.toBeInTheDocument()
  })

  it('대시보드 요청이 실패해도 기존 랭킹을 보여준다', async () => {
    const baseFetch = global.fetch
    global.fetch = vi.fn(url => (url.endsWith('/competition') ? Promise.reject(new Error('net')) : baseFetch(url)))
    renderAt('/result/session-1')
    expect(await screen.findByRole('heading', { name: '랭킹' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1번째 화면' })).not.toBeInTheDocument()
  })

  it('홈 랭킹(/ranking)은 대시보드를 요청하지 않는다', async () => {
    renderAt('/ranking')
    await screen.findByRole('heading', { name: '랭킹' })
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/competition$/))
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: 첫 새 테스트 FAIL

- [ ] **Step 3: 구현 — 상태와 요청**

import 추가:

```jsx
import CompetitionResultCarousel from '../components/CompetitionResultCarousel'
```

`hasMyResult` state 아래에 추가:

```jsx
  // 경쟁 모드 결과면 팀 비교 대시보드를 랭킹 앞에 붙인다. undefined = 확인 중, null = 일반 결과(또는 실패).
  const [competition, setCompetition] = useState(isV2 ? undefined : null)

  useEffect(() => {
    if (!isV2) return
    fetch(`/api/results/${sessionId}/competition`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setCompetition(Array.isArray(data?.teams) ? data : null))
      .catch(() => setCompetition(null))
  }, [sessionId, isV2])
```

- [ ] **Step 4: 구현 — 렌더링**

return 안의 `<div className={styles.inner}> … </div>` 블록 전체(제목부터 `RankingTable`까지, 끝의 `</div>` 포함)를 **내용 그대로** return 위의 변수로 옮긴다:

```jsx
  const rankingBody = (
    <div className={styles.inner}>
      {/* …기존 .inner 내용 그대로… */}
    </div>
  )
```

return 안 원래 자리에는 다음을 넣는다:

```jsx
      {competition === undefined && <p className={styles.message}>불러오는 중...</p>}
      {competition && (
        <CompetitionResultCarousel teams={competition.teams} mySessionId={competition.mySessionId}>
          {rankingBody}
        </CompetitionResultCarousel>
      )}
      {competition === null && rankingBody}
```

`viewingPlayer` 오버레이는 그 아래 그대로 둔다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: PASS (기존 테스트 포함 — 기존 테스트는 `/competition`이 404라 지금 화면 그대로)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.test.jsx
git commit -m "feat: show team comparison carousel on competition results"
```

---

### Task 18: 전체 확인 + 화면 확인

**Files:** 고칠 것이 나오면 해당 파일

- [ ] **Step 1: 전체 테스트**

Run: `npx vitest run`
Expected: 전부 PASS. 실패하면 원인을 고치고(이번 변경과 관계없는 기존 실패라면 그대로 기록) 다시 실행한다.

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 오류 없이 끝남

- [ ] **Step 3: 마이그레이션 적용 확인**

사용자에게 `supabase/migrations/2026-10-26-add-player-prices.sql`을 개발 DB에 적용했는지 묻는다. 적용하지 않으면 결과 등록 시 `game_results` insert가 컬럼 없음 오류로 실패한다. **실서비스 DB 적용은 사용자가 직접 결정한다.**

- [ ] **Step 4: 화면 확인 (run 스킬 또는 `npm run dev`, 휴대폰 폭 390px)**

1. 관리자: 경쟁 모드 수업 목록 → 배지가 이름 옆에 있다.
2. 학생 2명 이상 QR 입장 → 7단계 StepBar 글자가 겹치지 않는다(겹치면 `StepBar.module.css`에서 글자 크기·줄바꿈을 조정한다). 주식 가격 → 계산기 → 주식 단계에 정한 가격이 보인다. 초기화가 동작한다.
3. 관리자: 팀 2개 만들어 배정 → 팀 카드에 주식/부동산 탭이 없다. 관전 → 참여자 수정 → 가격 설정으로 그 참여자 가격을 고치면 카드 총자산이 바뀐다.
4. 결과 등록 → 학생 화면에 ①현금부터 나온다. 쓸어넘기기, 점, 화살표로 ⑤ 랭킹까지 이동한다. 우리 팀이 강조된다. 랭킹 탭 버튼이 정상 동작한다.
5. 보고서(경제적 잠재력 유형)·안내서 금액이 참여자가 정한 가격으로 계산된다.
6. 일반 모드 수업 하나로 결과 등록 → 대시보드가 없고 화면이 예전과 같다.

- [ ] **Step 5: 고친 것이 있으면 커밋**

```bash
git add <고친 파일>
git commit -m "fix: polish team competition screens"
```
