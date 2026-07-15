# 랭킹 페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 페이지에 전체 랭킹/부스 랭킹 최상위 탭, 시상대(podium) UI, 랭킹 리스트의 "팀" 컬럼을 추가하고, 기존 다크 테마를 `design/랭킹-*.png` 목업에 맞춰 라이트 테마 카드 UI로 리디자인한다.

**Architecture:** `RankingPage.jsx`에 최상위 탭(`전체 랭킹`/`부스 랭킹`) 상태를 추가한다. 서버는 제출 시점에 `stock_value`/`real_estate_value`를 미리 계산해 `game_results`에 저장하고, `/api/rankings`에 `category` 쿼리 파라미터를 추가해 부스 랭킹(주식·부동산만 활성화, 나머지 4개는 UI상 비활성화)을 조회한다. 신규 `RankingPodium`(시상대)과 `BoothCategoryTabs`(부스 카테고리 피커) 컴포넌트를 추가하고, 기존 `RankingTable`을 테이블에서 카드 리스트로 재작성해 "팀" 컬럼과 `valueKey` prop(어떤 금액 필드를 보여줄지)을 지원한다.

**Tech Stack:** React 18, react-router-dom 7, Vite, Vitest + Testing Library, CSS Modules, Express 5, Supabase.

**참고 문서:**
- `docs/superpowers/specs/2026-07-15-leaderboard-redesign-design.md` (승인된 설계)
- `proposal/20260715_leader_board.md` (원본 제안서)
- `design/랭킹-전체.png`, `design/랭킹-부스.png` (참고 목업)

---

### Task 1: `server/db.js` — `calculateAssetBreakdown` 리팩터링

**Files:**
- Modify: `server/db.js:1-15`
- Modify: `server/db.test.js` (전체 교체)

기존 `calculateTotalAssets`는 총자산 숫자만 반환한다. 이후 태스크에서 주식/부동산 개별 값이 필요하므로, 클라이언트의 `src/utils/calculateAssets.js`(관리자 모드 데모에서 만든 것)와 동일한 형태로 `{ cash, stockValue, realEstateValue, totalAssets }`를 반환하도록 리팩터링한다. 이 태스크에서 이후 태스크(2, 3)가 사용할 Supabase 체이너블 mock도 함께 셋업해둔다(뒤 태스크에서 같은 mock을 재사용).

- [ ] **Step 1: 실패하는 테스트 작성**

`server/db.test.js` 전체를 아래 내용으로 교체:

```js
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  }
  return builder
}

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { calculateAssetBreakdown } from './db.js'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makeState(overrides = {}) {
  return {
    cash: 0,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    ...overrides,
  }
}

describe('calculateAssetBreakdown', () => {
  it('뱃지 0개이면 총자산은 0원이다', () => {
    const state = makeState({ cash: 100000 })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(0)
  })

  it('뱃지 2개이면 base × 1.0을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, false, false, false, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(100000)
  })

  it('뱃지 3개이면 base × 1.5를 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, false, false, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(150000)
  })

  it('뱃지 6개이면 base × 3.0을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, true, true] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(300000)
  })

  it('주식 보유량 × 가격을 stockValue로 반환하고 총자산에도 포함한다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(20000)
    expect(result.totalAssets).toBe(20000)
  })

  it('부동산 보유량 × 가격을 realEstateValue로 반환하고 총자산에도 포함한다', () => {
    const state = makeState({
      realEstate: { gaon: 3, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.realEstateValue).toBe(30000)
    expect(result.totalAssets).toBe(30000)
  })

  it('현금+주식+부동산을 합산해 총자산을 계산한다', () => {
    const state = makeState({
      cash: 50000,
      stocks: { semiconductor: 5, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.cash).toBe(50000)
    expect(result.stockValue).toBe(10000)
    expect(result.realEstateValue).toBe(10000)
    expect(result.totalAssets).toBe(70000)
  })

  it('stockValue와 realEstateValue에는 뱃지 배수가 적용되지 않는다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [false, false, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(20000)
    expect(result.totalAssets).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `calculateAssetBreakdown is not exported` 또는 유사 import 에러 (`makeQueryBuilder`/`mockFrom`는 아직 사용되지 않아 lint 경고만 있을 수 있음, 무시)

- [ ] **Step 3: `calculateTotalAssets` → `calculateAssetBreakdown` 리팩터링**

`server/db.js`의 1~15번째 줄(`import` 문과 `calculateTotalAssets` 함수)을 아래로 교체:

```js
import { supabase } from './supabase.js'

export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(stocks).reduce(
    (sum, key) => sum + stocks[key] * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(realEstate).reduce(
    (sum, key) => sum + realEstate[key] * (prices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  const totalAssets = baseAssets * (badgeCount * 0.5)

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
```

같은 파일의 `saveGameResult` 안에서 `total_assets: calculateTotalAssets(player.gameState, prices),` 줄을 찾아 아래로 교체:

```js
    total_assets: calculateAssetBreakdown(player.gameState, prices).totalAssets,
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "refactor: expose asset breakdown from calculateAssetBreakdown"
```

---

### Task 2: `server/db.js` + 스키마 — `stock_value`/`real_estate_value` 저장

**Files:**
- Modify: `server/db.js` (`saveGameResult`)
- Modify: `server/db.test.js` (테스트 추가)
- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/2026-07-15-add-booth-values.sql`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/db.test.js` 맨 아래(마지막 `describe('calculateAssetBreakdown', ...)` 블록 다음)에 추가:

```js

describe('saveGameResult', () => {
  it('각 플레이어의 stock_value와 real_estate_value를 계산해 insert한다', async () => {
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

    const room = {
      code: 'AB1234',
      prices: PRICES,
      players: [
        {
          playerUuid: 'p1', name: '홍길동', affiliation: '서울중', character: 'fox',
          gameState: {
            job: 'a', cash: 10000,
            stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
            realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
            badges: [true, true, false, false, false, false],
          },
        },
      ],
    }

    await saveGameResult(room)

    expect(mockResultsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        player_uuid: 'p1',
        stock_value: 4000,
        real_estate_value: 10000,
        total_assets: 24000,
      }),
    ])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `mockResultsInsert`에 전달된 객체에 `stock_value`/`real_estate_value`가 없음

- [ ] **Step 3: `saveGameResult` row 매핑에 컬럼 추가**

`server/db.js`의 `saveGameResult` 안 `rows` 매핑 부분을 찾아 아래로 교체:

```js
  const rows = players.map(player => {
    const breakdown = calculateAssetBreakdown(player.gameState, prices)
    return {
      session_id: session.id,
      player_uuid: player.playerUuid,
      name: player.name,
      affiliation: player.affiliation ?? '',
      character: player.character,
      job: player.gameState.job,
      cash: player.gameState.cash ?? 0,
      stock_holdings: player.gameState.stocks,
      real_estate_holdings: player.gameState.realEstate,
      badges: player.gameState.badges,
      total_assets: breakdown.totalAssets,
      stock_value: breakdown.stockValue,
      real_estate_value: breakdown.realEstateValue,
    }
  })
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: 스키마 파일 업데이트**

`supabase/schema.sql`의 `game_results` 테이블 정의에서 `total_assets NUMERIC NOT NULL,` 다음 줄에 추가:

```sql
  stock_value NUMERIC,
  real_estate_value NUMERIC,
```

- [ ] **Step 6: 마이그레이션 SQL 작성**

`supabase/migrations/2026-07-15-add-booth-values.sql` 신규 작성:

```sql
-- 부스 랭킹(주식·부동산)을 위한 컬럼 추가.
-- NOT NULL 제약 없음: 과거 결과는 scripts/backfill-booth-values.js로 별도 백필한다.
ALTER TABLE game_results
  ADD COLUMN stock_value NUMERIC,
  ADD COLUMN real_estate_value NUMERIC;
```

이 SQL은 Supabase 대시보드의 SQL Editor 또는 CLI로 배포 전 수동 실행한다(자동화된 마이그레이션 러너는 이 프로젝트에 없음).

- [ ] **Step 7: 커밋**

```bash
git add server/db.js server/db.test.js supabase/schema.sql supabase/migrations/2026-07-15-add-booth-values.sql
git commit -m "feat: persist stock_value and real_estate_value on game result submission"
```

---

### Task 3: `server/db.js` — `getAllRankings`/`getBoothRankings`에 `teamCode` 및 부스 값 포함

**Files:**
- Modify: `server/db.js` (`getAllRankings`, 신규 `getBoothRankings`)
- Modify: `server/db.test.js` (테스트 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`server/db.test.js` 맨 아래에 추가:

```js

describe('getAllRankings', () => {
  it('teamCode, stockValue, realEstateValue를 포함해 반환한다', async () => {
    const rows = [{
      player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      total_assets: 200000, stock_value: 4000, real_estate_value: 10000,
      session_id: 's1', game_sessions: { team_code: 'AB1234' },
    }]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getAllRankings } = await import('./db.js')
    const result = await getAllRankings()

    expect(result).toEqual([{
      rank: 1, name: '김민준', affiliation: '서울중', character: 'lion',
      totalAssets: 200000, stockValue: 4000, realEstateValue: 10000,
      sessionId: 's1', playerUuid: 'p1', teamCode: 'AB1234',
    }])
  })

  it('affiliation이 있으면 eq로 필터링을 건다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getAllRankings } = await import('./db.js')
    await getAllRankings('서울중')

    expect(builder.eq).toHaveBeenCalledWith('affiliation', '서울중')
  })
})

describe('getBoothRankings', () => {
  it('stock 카테고리는 stock_value 컬럼 기준 내림차순으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getBoothRankings } = await import('./db.js')
    await getBoothRankings('stock')

    expect(builder.order).toHaveBeenCalledWith('stock_value', { ascending: false })
  })

  it('realEstate 카테고리는 real_estate_value 컬럼 기준 내림차순으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getBoothRankings } = await import('./db.js')
    await getBoothRankings('realEstate')

    expect(builder.order).toHaveBeenCalledWith('real_estate_value', { ascending: false })
  })

  it('알 수 없는 카테고리는 에러를 던진다', async () => {
    const { getBoothRankings } = await import('./db.js')
    await expect(getBoothRankings('unknown')).rejects.toThrow('Unknown booth category: unknown')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `getBoothRankings is not exported`, `getAllRankings` 반환값에 `teamCode`/`stockValue`/`realEstateValue` 없음

- [ ] **Step 3: `getAllRankings` 수정 + `getBoothRankings` 추가**

`server/db.js`의 `getAllRankings` 함수 전체를 아래로 교체하고, 그 아래에 `getBoothRankings`와 공용 헬퍼를 추가:

```js
const RANKING_SELECT = 'player_uuid, name, affiliation, character, total_assets, stock_value, real_estate_value, session_id, game_sessions(team_code)'

function mapRankingRow(r, i) {
  return {
    rank: i + 1,
    name: r.name,
    affiliation: r.affiliation,
    character: r.character,
    totalAssets: Number(r.total_assets),
    stockValue: r.stock_value != null ? Number(r.stock_value) : null,
    realEstateValue: r.real_estate_value != null ? Number(r.real_estate_value) : null,
    sessionId: r.session_id,
    playerUuid: r.player_uuid,
    teamCode: r.game_sessions?.team_code ?? '',
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

const BOOTH_ORDER_COLUMN = { stock: 'stock_value', realEstate: 'real_estate_value' }

export async function getBoothRankings(category) {
  const column = BOOTH_ORDER_COLUMN[category]
  if (!column) throw new Error(`Unknown booth category: ${category}`)

  const { data, error } = await supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order(column, { ascending: false })

  if (error) throw error

  return data.map(mapRankingRow)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add getBoothRankings and include teamCode in ranking queries"
```

---

### Task 4: `server/index.js` — 부스 랭킹 라우팅 + 팀 결과에 `teamCode` 추가

**Files:**
- Modify: `server/index.js:9,65-102`

이 파일의 Express 라우트는 기존에도 자동 테스트가 없다(이 프로젝트에 supertest 등 HTTP 테스트 도구 미설치, `server/db.js`/`server/rooms.js`만 단위 테스트됨). 이 태스크는 코드 수정 후 Task 10의 수동 QA로 검증한다.

- [ ] **Step 1: import 수정**

`server/index.js` 9번째 줄:

```js
import { saveGameResult, getGameResult, getAllRankings } from './db.js'
```

를 아래로 교체:

```js
import { saveGameResult, getGameResult, getAllRankings, getBoothRankings } from './db.js'
```

- [ ] **Step 2: `/api/rankings`에 `category` 파라미터 추가**

`server/index.js`의 `/api/rankings` 라우트(65~74번째 줄)를 아래로 교체:

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
    res.status(500).json({ error: 'Failed to fetch rankings' })
  }
})
```

- [ ] **Step 3: `/api/results/:sessionId`에 `teamCode` 추가**

같은 파일의 `/api/results/:sessionId` 라우트(76~102번째 줄) 안, `players: results.map((r, i) => ({` 블록에 `teamCode` 필드를 추가:

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

(추가된 줄은 `teamCode: session.team_code,` 한 줄뿐이며, 나머지는 기존과 동일하다.)

- [ ] **Step 4: 커밋**

```bash
git add server/index.js
git commit -m "feat: add booth category ranking route and teamCode to team results"
```

---

### Task 5: 과거 결과 백필 스크립트

**Files:**
- Create: `scripts/backfill-booth-values.js`

1회성 스크립트이므로 자동 테스트는 작성하지 않는다(설계 문서 §5 결정 사항). 로컬/스테이징에서 수동 실행 후 로그로 확인한다.

- [ ] **Step 1: 스크립트 작성**

`scripts/backfill-booth-values.js` 신규 작성:

```js
import 'dotenv/config'
import { supabase } from '../server/supabase.js'
import { calculateAssetBreakdown } from '../server/db.js'

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
    .select('id, session_id, cash, stock_holdings, real_estate_holdings, badges, stock_value')

  if (resultsError) throw resultsError

  const toBackfill = results.filter(r => r.stock_value === null)
  console.log(`${toBackfill.length}개 결과를 백필합니다 (전체 ${results.length}개)`)

  for (const row of toBackfill) {
    const prices = pricesBySessionId.get(row.session_id)
    if (!prices) {
      console.warn(`session ${row.session_id}의 가격 정보를 찾을 수 없어 건너뜁니다 (result id: ${row.id})`)
      continue
    }

    const breakdown = calculateAssetBreakdown(
      { cash: row.cash, stocks: row.stock_holdings, realEstate: row.real_estate_holdings, badges: row.badges },
      prices
    )

    const { error: updateError } = await supabase
      .from('game_results')
      .update({ stock_value: breakdown.stockValue, real_estate_value: breakdown.realEstateValue })
      .eq('id', row.id)

    if (updateError) {
      console.error(`result id ${row.id} 업데이트 실패:`, updateError.message)
      continue
    }

    console.log(`result id ${row.id} 백필 완료 (stock_value=${breakdown.stockValue}, real_estate_value=${breakdown.realEstateValue})`)
  }

  console.log('백필 완료')
}

main().catch(err => {
  console.error('백필 스크립트 실패:', err)
  process.exit(1)
})
```

- [ ] **Step 2: 커밋**

```bash
git add scripts/backfill-booth-values.js
git commit -m "feat: add booth values backfill script for legacy results"
```

(Supabase 마이그레이션(Task 2 Step 6)을 실제 프로젝트에 적용한 뒤, 배포 전 `node scripts/backfill-booth-values.js`를 1회 수동 실행한다.)

---

### Task 6: `RankingPodium` 컴포넌트 (시상대)

**Files:**
- Create: `src/components/RankingPodium.jsx`
- Create: `src/components/RankingPodium.module.css`
- Test: `src/components/RankingPodium.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/RankingPodium.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RankingPodium from './RankingPodium'

const rows = [
  { rank: 1, name: '김민준', character: 'lion', playerUuid: 'p1', totalAssets: 2191000 },
  { rank: 2, name: '이서연', character: 'fox', playerUuid: 'p2', totalAssets: 1844500 },
  { rank: 3, name: '박지호', character: 'panda', playerUuid: 'p3', totalAssets: 1291500 },
]

describe('RankingPodium', () => {
  it('3명일 때 1~3위를 모두 렌더링한다', () => {
    render(<RankingPodium rows={rows} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('박지호')).toBeInTheDocument()
    expect(screen.getByText('2,191,000원')).toBeInTheDocument()
  })

  it('2명일 때는 1~2위만 렌더링하고 3위 자리는 없다', () => {
    render(<RankingPodium rows={rows.slice(0, 2)} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.queryByText('박지호')).toBeNull()
  })

  it('1명일 때는 1위만 렌더링한다', () => {
    render(<RankingPodium rows={rows.slice(0, 1)} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.queryByText('이서연')).toBeNull()
  })

  it('0명일 때는 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<RankingPodium rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('valueKey를 지정하면 해당 필드 값을 표시한다', () => {
    const boothRows = [
      { rank: 1, name: '정우성', character: 'tiger', playerUuid: 'p4', stockValue: 172000 },
    ]
    render(<RankingPodium rows={boothRows} valueKey="stockValue" />)
    expect(screen.getByText('172,000원')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/RankingPodium.test.jsx`
Expected: FAIL — `Failed to resolve import "./RankingPodium"`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/RankingPodium.jsx`:

```jsx
import styles from './RankingPodium.module.css'

const PODIUM_ORDER = [1, 0, 2]

export default function RankingPodium({ rows, valueKey = 'totalAssets' }) {
  if (rows.length === 0) return null

  const podiumRows = PODIUM_ORDER.map(i => rows[i]).filter(Boolean)

  return (
    <div className={styles.podium}>
      {podiumRows.map(row => (
        <div key={row.playerUuid} className={`${styles.slot} ${row.rank === 1 ? styles.first : ''}`}>
          <img src={`/characters/${row.character}.png`} alt={row.character} className={styles.avatar} />
          <span className={styles.name}>{row.name}</span>
          <div className={styles.box}>
            <span className={styles.rank}>{row.rank}위</span>
            <span className={styles.value}>{row[valueKey].toLocaleString()}원</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

`src/components/RankingPodium.module.css`:

```css
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 120px;
}

.avatar {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.name {
  font-size: 14px;
  font-weight: 900;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.box {
  width: 100%;
  background: var(--slot-empty);
  border-radius: var(--r-sm);
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.rank {
  font-size: 18px;
  font-weight: 900;
  color: var(--ink);
}

.value {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
}

.first .box {
  background: var(--ink);
  padding-top: 24px;
  padding-bottom: 24px;
}

.first .rank,
.first .value {
  color: var(--white);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/RankingPodium.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/RankingPodium.jsx src/components/RankingPodium.module.css src/components/RankingPodium.test.jsx
git commit -m "feat: add RankingPodium component"
```

---

### Task 7: `BoothCategoryTabs` 컴포넌트

**Files:**
- Create: `src/components/BoothCategoryTabs.jsx`
- Create: `src/components/BoothCategoryTabs.module.css`
- Test: `src/components/BoothCategoryTabs.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/BoothCategoryTabs.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BoothCategoryTabs from './BoothCategoryTabs'

describe('BoothCategoryTabs', () => {
  it('6개 카테고리를 모두 렌더링한다', () => {
    render(<BoothCategoryTabs activeCategory="stock" onSelect={vi.fn()} />)
    ;['노동', '직업', '은행', '주식', '부동산', '행운'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('비활성 카테고리를 클릭해도 onSelect가 호출되지 않는다', async () => {
    const handleSelect = vi.fn()
    render(<BoothCategoryTabs activeCategory="stock" onSelect={handleSelect} />)
    await userEvent.click(screen.getByText('노동'))
    expect(handleSelect).not.toHaveBeenCalled()
  })

  it('활성 카테고리를 클릭하면 onSelect가 해당 key로 호출된다', async () => {
    const handleSelect = vi.fn()
    render(<BoothCategoryTabs activeCategory="stock" onSelect={handleSelect} />)
    await userEvent.click(screen.getByText('부동산'))
    expect(handleSelect).toHaveBeenCalledWith('realEstate')
  })

  it('비활성 카테고리는 disabled 속성을 가진다', () => {
    render(<BoothCategoryTabs activeCategory="stock" onSelect={vi.fn()} />)
    expect(screen.getByText('은행').closest('button')).toBeDisabled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/BoothCategoryTabs.test.jsx`
Expected: FAIL — `Failed to resolve import "./BoothCategoryTabs"`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/BoothCategoryTabs.jsx`:

```jsx
import styles from './BoothCategoryTabs.module.css'

export const BOOTH_CATEGORIES = [
  { key: 'labor', label: '노동', enabled: false },
  { key: 'job', label: '직업', enabled: false },
  { key: 'bank', label: '은행', enabled: false },
  { key: 'stock', label: '주식', enabled: true },
  { key: 'realEstate', label: '부동산', enabled: true },
  { key: 'luck', label: '행운', enabled: false },
]

export default function BoothCategoryTabs({ activeCategory, onSelect }) {
  return (
    <div className={styles.grid}>
      {BOOTH_CATEGORIES.map(category => (
        <button
          key={category.key}
          type="button"
          className={`${styles.tab} ${activeCategory === category.key ? styles.active : ''}`}
          disabled={!category.enabled}
          onClick={() => onSelect(category.key)}
        >
          {category.label}
        </button>
      ))}
    </div>
  )
}
```

`src/components/BoothCategoryTabs.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.tab {
  background: var(--slot-empty);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  height: 40px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}

.tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.active {
  background: var(--ink);
  color: var(--white);
  border-color: var(--ink);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/BoothCategoryTabs.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/BoothCategoryTabs.jsx src/components/BoothCategoryTabs.module.css src/components/BoothCategoryTabs.test.jsx
git commit -m "feat: add BoothCategoryTabs component"
```

---

### Task 8: `RankingTable` 카드 리스트 리디자인 (팀 컬럼 + `valueKey` + 라이트 테마)

**Files:**
- Modify: `src/components/RankingTable.jsx` (전체 교체)
- Modify: `src/components/RankingTable.module.css` (전체 교체)
- Modify: `src/components/RankingTable.test.jsx` (전체 교체)

기존 `<table>` 마크업을 `design/랭킹-전체.png`의 카드 리스트(헤더 없이 행마다 등수·캐릭터·이름·소속·팀·금액을 한 카드에 표시)로 재작성한다. 다크 테마(`#333` 등 하드코딩 색상)를 라이트 테마 디자인 토큰(`var(--ink)` 등)으로 교체한다. `valueKey` prop으로 어떤 금액 필드(`totalAssets`/`stockValue`/`realEstateValue`)를 표시할지 선택한다.

- [ ] **Step 1: 실패하는 테스트로 교체**

`src/components/RankingTable.test.jsx` 전체를 아래로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import RankingTable from './RankingTable'

const mockRows = [
  { rank: 1, name: '홍길동', affiliation: '경영학과', teamCode: 'AB1234', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1' },
  { rank: 2, name: '김철수', affiliation: '공학부', teamCode: 'CD5678', character: 'cat', totalAssets: 120000, playerUuid: 'uuid-2' },
]

describe('RankingTable', () => {
  it('등수, 이름, 소속, 팀, 총자산을 렌더링한다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.getByText('1위')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('경영학과 · AB1234')).toBeInTheDocument()
    expect(screen.getByText('150,000원')).toBeInTheDocument()
  })

  it('valueKey를 지정하면 해당 필드 값을 표시한다', () => {
    const boothRows = [
      { rank: 1, name: '정우성', affiliation: '수도고', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, playerUuid: 'uuid-3' },
    ]
    render(<MemoryRouter><RankingTable rows={boothRows} valueKey="stockValue" /></MemoryRouter>)
    expect(screen.getByText('172,000원')).toBeInTheDocument()
  })

  it('highlightPlayerUuid에 해당하는 행을 하단에 pinned row로 렌더링한다', () => {
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} highlightPlayerUuid="uuid-2" />
      </MemoryRouter>
    )
    const pinnedRow = screen.getByTestId('pinned-row')
    expect(pinnedRow).toBeInTheDocument()
    expect(pinnedRow).toHaveTextContent('김철수')
  })

  it('highlightPlayerUuid 없으면 pinned row를 렌더링하지 않는다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.queryByTestId('pinned-row')).toBeNull()
  })

  it('onRowClick이 있을 때 행 클릭 시 해당 row 데이터로 콜백을 호출한다', async () => {
    const handleClick = vi.fn()
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} onRowClick={handleClick} />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByText('홍길동'))
    expect(handleClick).toHaveBeenCalledWith(mockRows[0])
  })

  it('같은 playerUuid가 여러 행에 있을 때 각 행을 독립적으로 렌더링한다', () => {
    const duplicateRows = [
      { rank: 1, name: '홍길동', affiliation: '경영학과', teamCode: 'AB1234', character: 'fox', totalAssets: 200000, playerUuid: 'uuid-1', sessionId: 'session-A' },
      { rank: 2, name: '홍길동', affiliation: '경영학과', teamCode: 'AB1234', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1', sessionId: 'session-B' },
    ]
    render(<MemoryRouter><RankingTable rows={duplicateRows} /></MemoryRouter>)
    const rows = screen.getAllByText('홍길동')
    expect(rows).toHaveLength(2)
  })

  it('highlightPlayerUuid가 있지만 rows에서 찾을 수 없을 때 플레이스홀더 행을 렌더링한다', () => {
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} highlightPlayerUuid="uuid-unknown" />
      </MemoryRouter>
    )
    const empty = screen.getByTestId('pinned-row-empty')
    expect(empty).toBeInTheDocument()
    expect(empty).toHaveTextContent('게임에 참여하러 가기')
    expect(empty).toHaveTextContent('-위')
    expect(empty).toHaveTextContent('-원')
  })

  it('플레이스홀더 행 클릭 시 onRowClick에 isPlaceholder: true 객체를 전달한다', async () => {
    const handleClick = vi.fn()
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} highlightPlayerUuid="uuid-unknown" onRowClick={handleClick} />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByTestId('pinned-row-empty'))
    expect(handleClick).toHaveBeenCalledWith({ isPlaceholder: true })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/RankingTable.test.jsx`
Expected: FAIL — `getByText('1위')`, `getByText('경영학과 · AB1234')` 등이 기존 마크업(순수 숫자 `1`, `teamCode` 컬럼 없음)에서 발견되지 않음

- [ ] **Step 3: `RankingTable.jsx` 전체 교체**

```jsx
import styles from './RankingTable.module.css'

export default function RankingTable({ rows, highlightPlayerUuid, onRowClick, valueKey = 'totalAssets' }) {
  const pinnedRow = highlightPlayerUuid
    ? rows.find(r => r.playerUuid === highlightPlayerUuid)
    : null

  function formatValue(row) {
    const value = row[valueKey]
    return value == null ? '-원' : `${value.toLocaleString()}원`
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {rows.map(row => (
          <div
            key={`${row.sessionId ?? ''}-${row.playerUuid ?? `${row.rank}-${row.name}`}`}
            className={styles.row}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            <span className={styles.rank}>{row.rank}위</span>
            <img
              src={`/characters/${row.character}.png`}
              alt={row.character}
              className={styles.characterImg}
            />
            <div className={styles.info}>
              <span className={styles.name}>{row.name}</span>
              <span className={styles.sub}>{row.affiliation} · {row.teamCode}</span>
            </div>
            <span className={styles.value}>{formatValue(row)}</span>
          </div>
        ))}
      </div>

      {pinnedRow && (
        <div className={styles.pinnedRow} data-testid="pinned-row">
          <span className={styles.pinnedRank}>{pinnedRow.rank}위</span>
          <img
            src={`/characters/${pinnedRow.character}.png`}
            alt={pinnedRow.character}
            className={styles.characterImg}
          />
          <span className={styles.pinnedName}>{pinnedRow.name}</span>
          <span className={styles.pinnedAffiliation}>{pinnedRow.affiliation} · {pinnedRow.teamCode}</span>
          <span className={styles.pinnedAssets}>{formatValue(pinnedRow)}</span>
        </div>
      )}

      {highlightPlayerUuid && !pinnedRow && (
        <div
          className={`${styles.pinnedRow} ${styles.pinnedRowEmpty}`}
          data-testid="pinned-row-empty"
          onClick={onRowClick ? () => onRowClick({ isPlaceholder: true }) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          <span className={styles.pinnedRank}>-위</span>
          <span className={styles.pinnedRowEmptyLabel}>게임에 참여하러 가기</span>
          <span className={styles.pinnedAssets}>-원</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `RankingTable.module.css` 전체 교체**

```css
.container {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 420px);
  scrollbar-width: none;
}

.list::-webkit-scrollbar {
  display: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--slot-empty);
  border-radius: var(--r-sm);
  padding: 14px 16px;
}

.rank {
  font-size: 15px;
  font-weight: 900;
  color: var(--ink-2);
  min-width: 32px;
}

.characterImg {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 15px;
  font-weight: 900;
  color: var(--ink);
}

.sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-2);
}

.value {
  font-size: 14px;
  font-weight: 900;
  color: var(--ink);
  white-space: nowrap;
}

.pinnedRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-top: 12px;
  background: var(--ink);
  border-radius: var(--r-sm);
  font-weight: 900;
  color: var(--white);
}

.pinnedRank { font-size: 15px; min-width: 32px; }
.pinnedName { flex: 1; }
.pinnedAffiliation { color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 400; }
.pinnedAssets { font-size: 14px; }

.pinnedRowEmpty {
  opacity: 0.85;
  justify-content: center;
}

.pinnedRowEmptyLabel {
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  color: var(--white);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/components/RankingTable.test.jsx`
Expected: PASS (8 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/RankingTable.jsx src/components/RankingTable.module.css src/components/RankingTable.test.jsx
git commit -m "feat: redesign RankingTable as card list with team column"
```

---

### Task 9: `RankingPage` — 최상위 탭 구조 + 부스 랭킹 fetch + 라이트 테마

**Files:**
- Modify: `src/pages/RankingPage.jsx` (전체 교체)
- Modify: `src/pages/RankingPage.module.css` (전체 교체)
- Create: `src/pages/RankingPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/RankingPage.test.jsx` 신규 작성:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RankingPage from './RankingPage'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/result/:sessionId" element={<RankingPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.startsWith('/api/rankings?category=stock')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '정우성', affiliation: '수도고', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, totalAssets: 300000, playerUuid: 'p1' },
      ]) })
    }
    if (url.startsWith('/api/rankings?category=realEstate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '한소희', affiliation: '미래고', teamCode: 'GH3456', character: 'toucan', realEstateValue: 90000, totalAssets: 250000, playerUuid: 'p2' },
      ]) })
    }
    if (url.startsWith('/api/results/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        teamCode: 'AB1234',
        players: [
          { rank: 1, name: '홍길동', affiliation: '서울중', teamCode: 'AB1234', character: 'fox', totalAssets: 50000, playerUuid: 'p3' },
        ],
      }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([
      { rank: 1, name: '김민준', affiliation: '서울중', teamCode: 'AB1234', character: 'lion', totalAssets: 200000, playerUuid: 'p4' },
    ]) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RankingPage', () => {
  it('홈 진입(sessionId 없음)에서 부스 랭킹 탭 선택 시 서브탭 없이 카테고리 피커만 보인다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.queryByText('소속')).toBeNull()
  })

  it('결과등록 후 진입(sessionId 있음)에서 전체 랭킹 탭은 기존 소속/팀 서브탭을 유지한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByText('소속')).toBeInTheDocument()
    expect(screen.getByText('팀')).toBeInTheDocument()
  })

  it('부스 랭킹 + 주식 카테고리 선택 시 /api/rankings?category=stock을 호출한다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=stock')
    })
    expect(await screen.findByText('정우성')).toBeInTheDocument()
  })

  it('부스 랭킹에서 부동산 카테고리를 선택하면 /api/rankings?category=realEstate를 호출한다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    await userEvent.click(screen.getByText('부동산'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=realEstate')
    })
    expect(await screen.findByText('한소희')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: FAIL — "부스 랭킹" 텍스트를 찾지 못함(최상위 탭이 아직 없음)

- [ ] **Step 3: `RankingPage.jsx` 전체 교체**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import BoothCategoryTabs from '../components/BoothCategoryTabs'
import { getPlayerUuid } from '../utils/playerUuid'
import styles from './RankingPage.module.css'

const TOP_TABS = [
  { key: 'overall', label: '전체 랭킹' },
  { key: 'booth', label: '부스 랭킹' },
]

const TABS = [
  { key: 'global', label: '전체' },
  { key: 'affiliation', label: '소속' },
  { key: 'team', label: '팀' },
]

const BOOTH_VALUE_KEYS = { stock: 'stockValue', realEstate: 'realEstateValue' }

export default function RankingPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const isV2 = Boolean(sessionId)

  const [topTab, setTopTab] = useState('overall')
  const [activeTab, setActiveTab] = useState('global')
  const [boothCategory, setBoothCategory] = useState('stock')
  const [rows, setRows] = useState([])
  const [myAffiliation, setMyAffiliation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
            setRows(data.players ?? [])
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

  const valueKey = topTab === 'booth' ? BOOTH_VALUE_KEYS[boothCategory] : 'totalAssets'
  const podiumRows = rows.slice(0, 3)

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>랭킹</h1>
          <p className={styles.subtitle}>총 자산 순위를 확인하세요</p>
        </div>

        <div className={styles.topTabs}>
          {TOP_TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.topTab} ${topTab === tab.key ? styles.topTabActive : ''}`}
              onClick={() => setTopTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {topTab === 'overall' && isV2 && (
          <div className={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {topTab === 'booth' && (
          <BoothCategoryTabs activeCategory={boothCategory} onSelect={setBoothCategory} />
        )}

        {loading && <p className={styles.message}>불러오는 중...</p>}
        {error && <p className={styles.message}>{error}</p>}
        {!loading && !error && (
          <>
            <RankingPodium rows={podiumRows} valueKey={valueKey} />
            <RankingTable
              rows={rows}
              valueKey={valueKey}
              highlightPlayerUuid={myPlayerUuid}
              onRowClick={row => {
                if (!row || row.isPlaceholder) {
                  navigate('/join')
                  return
                }
                if (row.sessionId && row.playerUuid) {
                  navigate(`/result/${row.sessionId}/player/${row.playerUuid}`)
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `RankingPage.module.css` 전체 교체**

```css
.page {
  min-height: 100%;
  height: 100%;
  background: var(--white);
  padding: 0 24px 32px;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.page::-webkit-scrollbar {
  display: none;
}

.inner {
  width: 100%;
  max-width: 100%;
  position: relative;
  z-index: 1;
}

.header {
  padding-top: 96px;
  margin-bottom: 20px;
}

.title {
  font-size: 26px;
  font-weight: 900;
  color: var(--ink);
}

.subtitle {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  margin-top: 2px;
}

.topTabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--slot-empty);
  border-radius: var(--r-pill);
  padding: 4px;
}

.topTab {
  flex: 1;
  height: 44px;
  border-radius: var(--r-pill);
  background: none;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
}

.topTabActive {
  background: var(--ink);
  color: var(--white);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--divider);
  padding-bottom: 8px;
}

.tab {
  padding: 8px 16px;
  background: none;
  border: none;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 700;
  border-radius: var(--r-sm);
}

.tab:hover { background: var(--slot-empty); }

.tabActive {
  color: var(--white);
  background: var(--ink);
}

.message {
  color: var(--ink-2);
  text-align: center;
  padding: 40px 0;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.module.css src/pages/RankingPage.test.jsx
git commit -m "feat: add top-level overall/booth ranking tabs to RankingPage"
```

---

### Task 10: 전체 테스트 실행 + 수동 QA

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run --exclude '**/.worktrees/**'`
Expected: 모든 테스트 PASS (기존 테스트 포함, 회귀 없음)

- [ ] **Step 2: 개발 서버 실행**

Run: `npm run dev`
Expected: Vite dev 서버와 API 서버(`server/index.js`)가 함께 기동됨

- [ ] **Step 3: 수동 시나리오 확인 — 홈 진입 (sessionId 없음)**

1. `http://localhost:5173`(또는 표시된 포트)에서 홈 화면 "랭킹" 버튼 클릭 → `/ranking` 진입.
2. 최상위 탭("전체 랭킹"/"부스 랭킹")이 보이는지, 서브탭(전체/소속/팀)은 보이지 않는지 확인.
3. "부스 랭킹" 클릭 → 6개 카테고리 피커 노출, 노동/직업/은행/행운은 비활성화(흐리게, 클릭 안 됨), 주식/부동산만 클릭 가능한지 확인.
4. "주식" 선택 → 시상대(1~3위) + 리스트가 주식 평가액 기준으로 표시되는지 확인. "부동산" 선택 시에도 동일하게 동작하는지 확인.

- [ ] **Step 4: 수동 시나리오 확인 — 결과등록 후 진입 (sessionId 있음)**

1. 실제 게임 한 방을 끝까지 진행해 "결과 등록"까지 완료(또는 기존에 등록된 세션의 `/result/:sessionId` URL로 직접 접속).
2. "전체 랭킹" 탭에서 기존처럼 전체/소속/팀 서브탭이 모두 동작하는지 확인(회귀 확인).
3. "부스 랭킹" 탭으로 전환 → 서브탭 없이 카테고리 피커만 노출되고, 주식/부동산 랭킹이 전체 팀을 대상으로 표시되는지 확인(내 팀으로 필터링되지 않아야 함).
4. 리스트의 각 행에 "소속 · 팀코드" 형식으로 표시되는지, 시상대 인원이 3명 미만인 카테고리(데이터가 적을 때)에서 있는 만큼만 표시되는지 확인.
5. 내 기록이 pinned row(검정 카드)로 리스트 하단에 고정되는지 확인.

- [ ] **Step 5: 문제 발견 시 조치**

수동 검증 중 레이아웃 깨짐/텍스트 겹침 등이 발견되면 해당 `*.module.css`만 수정하고 `npx vitest run`으로 회귀 여부를 재확인한 뒤 별도 커밋으로 기록한다:

```bash
git add <수정한 파일>
git commit -m "fix: adjust ranking page layout after manual QA"
```

- [ ] **Step 6: Supabase 마이그레이션 및 백필 안내 (수동, 배포 담당자용)**

이 프로젝트에는 자동 마이그레이션 러너가 없으므로, 실제 배포 전 아래를 수동으로 수행해야 한다:

1. Supabase SQL Editor에서 `supabase/migrations/2026-07-15-add-booth-values.sql` 실행.
2. `node scripts/backfill-booth-values.js` 실행해 과거 결과에 `stock_value`/`real_estate_value` 채우기.
3. 콘솔 로그로 백필된 row 수와 실패 건수를 확인.

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지**: §1 적용범위 → Task 9, §2 데이터모델/백엔드 → Task 1~4, §3 프론트엔드 컴포넌트 → Task 6~9, §4 백필 → Task 5·10, §5 테스트전략 → 각 태스크 내 TDD 스텝, §6 범위밖 항목은 태스크에 포함하지 않음. 모두 커버됨.
- **플레이스홀더 없음**: 모든 스텝에 실제 코드/명령어 포함.
- **타입/이름 일관성**: `calculateAssetBreakdown`, `getBoothRankings`, `valueKey`(`totalAssets`/`stockValue`/`realEstateValue`), `teamCode`, `RankingPodium`/`BoothCategoryTabs` 이름이 전 태스크에서 동일하게 사용됨.
- **설계 문서와의 차이**: 설계 문서(§3.2, §3.4)에 언급된 `valueLabel` prop은 실제 목업에 컬럼 헤더/값 라벨이 시각적으로 없어 계획 단계에서 `valueKey`만 사용하는 것으로 단순화함(표시할 필드를 고르는 목적은 동일하게 달성).
