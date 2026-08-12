# 랭킹 페이지 탭 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 페이지 탭을 "총자산/주식/부동산"(항상 노출) 위 탭 + "전체/수업/팀"(마이데이터가 있을 때만 노출) 아래 탭의 2단 구조로 바꾼다. 기존 "부스 랭킹" 개념과 `BoothCategoryTabs`는 제거된다.

**Architecture:** 서버의 `getAllRankings`/`getBoothRankings`를 `getRankings({ classId, category })` 하나로 합친다(정렬 컬럼만 다를 뿐 조회 로직은 이미 동일). `/api/results/:sessionId`(팀 스코프) 응답에 이미 DB에 저장돼 있는 `stock_value`/`real_estate_value`를 추가로 노출한다(별도 계산 로직 불필요). `RankingPage.jsx`는 `topTab`/`boothCategory` 상태를 `category`(총자산/주식/부동산) + `scope`(전체/수업/팀) 두 축으로 재구성한다.

**Tech Stack:** Express, Supabase, React, Vitest, Testing Library

**참고(설계 문서 대비 수정):** 설계 문서(`docs/superpowers/specs/2026-08-12-user-feedback-design.md`)의 3절은 "팀" 스코프를 클라이언트에서 `calculateAssetBreakdown`으로 계산한다고 적었으나, 실제로 `/api/results/:sessionId`가 참조하는 `game_results` 테이블에는 `stock_value`/`real_estate_value`가 이미 계산·저장돼 있다(부스 랭킹에 쓰는 것과 같은 컬럼). 라우트 핸들러가 이 두 필드를 응답에 포함하지 않았을 뿐이므로, 이 플랜에서는 그 두 필드를 추가하는 훨씬 단순한 방식으로 구현한다. 최종 사용자 동작은 설계 문서와 동일하다.

---

### Task 1: 서버 — `getAllRankings`/`getBoothRankings`를 `getRankings()`로 통합

**Files:**
- Modify: `server/db.js`
- Modify: `server/db.test.js`

- [ ] **Step 1: `getRankings` 실패 테스트 작성**

`server/db.test.js`의 `describe('getAllRankings', ...)`와 `describe('getBoothRankings', ...)` 두 블록을 아래의 `describe('getRankings', ...)` 하나로 교체한다:

```js
describe('getRankings', () => {
  it('category 없이 호출하면 total_assets 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({})

    expect(builder.order).toHaveBeenCalledWith('total_assets', { ascending: false })
  })

  it('category가 stock이면 stock_value 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ category: 'stock' })

    expect(builder.order).toHaveBeenCalledWith('stock_value', { ascending: false })
  })

  it('category가 realEstate이면 real_estate_value 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ category: 'realEstate' })

    expect(builder.order).toHaveBeenCalledWith('real_estate_value', { ascending: false })
  })

  it('알 수 없는 category는 에러를 던진다', async () => {
    const { getRankings } = await import('./db.js')
    await expect(getRankings({ category: 'unknown' })).rejects.toThrow('Unknown ranking category: unknown')
  })

  it('classId가 있으면 game_sessions.class_id로 eq 필터링을 건다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ classId: 'class-1' })

    expect(builder.eq).toHaveBeenCalledWith('game_sessions.class_id', 'class-1')
  })

  it("classId가 'unassigned'면 game_sessions.class_id를 null로 필터링한다", async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ classId: 'unassigned' })

    expect(builder.is).toHaveBeenCalledWith('game_sessions.class_id', null)
  })

  it('classId와 category를 동시에 적용할 수 있다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ classId: 'class-1', category: 'stock' })

    expect(builder.order).toHaveBeenCalledWith('stock_value', { ascending: false })
    expect(builder.eq).toHaveBeenCalledWith('game_sessions.class_id', 'class-1')
  })

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

    const { getRankings } = await import('./db.js')
    const result = await getRankings({})

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

    const { getRankings } = await import('./db.js')
    const result = await getRankings({})

    expect(result[0].className).toBe('미배정 수업')
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run server/db.test.js -t getRankings`
Expected: FAIL — `getRankings is not a function`

- [ ] **Step 3: `getAllRankings`/`getBoothRankings`를 `getRankings`로 교체**

`server/db.js`에서 다음 두 함수:

```js
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

을 다음 하나로 교체:

```js
const RANKING_ORDER_COLUMN = { stock: 'stock_value', realEstate: 'real_estate_value' }

export async function getRankings({ classId = null, category = null } = {}) {
  const column = category ? RANKING_ORDER_COLUMN[category] : 'total_assets'
  if (!column) throw new Error(`Unknown ranking category: ${category}`)

  let query = supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order(column, { ascending: false })

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

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "refactor: merge getAllRankings/getBoothRankings into getRankings(classId, category)"
```

---

### Task 2: 서버 — 라우트에 `getRankings` 연결, 팀 스코프에 자산값 노출

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: import 교체**

```js
import { saveGameResult, getGameResult, getRankings, getAllCompletedTeams, updateGameResult, updateSessionTitle, deleteCompletedTeam, deleteCompletedTeamsByClassId } from './db.js'
```

(이 플랜은 `updateSessionTitle`을 도입한 `2026-08-12-admin-room-title` 플랜 이후에 실행된다고 가정한다. 그 플랜이 아직 적용되지 않았다면 `updateSessionTitle` 부분은 제외한다.)

- [ ] **Step 2: `/api/rankings` 라우트 교체**

```js
app.get('/api/rankings', async (req, res) => {
  try {
    const { classId, category } = req.query
    const rankings = await getRankings({ classId: classId ?? null, category: category ?? null })
    res.json(rankings)
  } catch (err) {
    console.error('rankings error:', err)
    res.status(500).json({ error: 'Failed to fetch rankings' })
  }
})
```

- [ ] **Step 3: `/api/results/:sessionId`의 `players` 매핑에 `stockValue`/`realEstateValue` 추가**

```js
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
        stockValue: r.stock_value != null ? Number(r.stock_value) : null,
        realEstateValue: r.real_estate_value != null ? Number(r.real_estate_value) : null,
        playerUuid: r.player_uuid,
        teamCode: session.team_code,
      })),
```

- [ ] **Step 4: 수동 확인**

기존 컨벤션대로 이 라우트들은 HTTP 단위 테스트 대상이 아니다. `npm run dev`로 서버를 띄우고, 등록 완료된 세션 하나로 `curl http://localhost:3001/api/results/<sessionId>`를 호출해 각 `players[].stockValue`/`realEstateValue`가 숫자로 채워지는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add server/index.js
git commit -m "feat: wire /api/rankings to getRankings and expose stock/real-estate value on team results"
```

---

### Task 3: `RankingPage.jsx` — 2단 탭 구조로 재구성

**Files:**
- Modify: `src/pages/RankingPage.jsx`
- Delete: `src/components/BoothCategoryTabs.jsx`
- Delete: `src/components/BoothCategoryTabs.module.css`
- Delete: `src/components/BoothCategoryTabs.test.jsx`
- Modify: `src/pages/RankingPage.test.jsx`

- [ ] **Step 1: 기존 부스 관련 테스트 제거하고 새 구조 테스트로 교체**

`RankingPage.test.jsx`의 `beforeEach` 목 함수와 테스트 목록을 다음으로 전체 교체한다:

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
    if (url === '/api/rankings?category=stock') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '정우성', className: '3반', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, totalAssets: 300000, playerUuid: 'p1' },
      ]) })
    }
    if (url === '/api/rankings?category=realEstate') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '한소희', className: '4반', teamCode: 'GH3456', character: 'toucan', realEstateValue: 90000, totalAssets: 250000, playerUuid: 'p2' },
      ]) })
    }
    if (url === '/api/rankings?classId=class-1&category=stock') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '유아인', className: '1반', teamCode: 'IJ3456', character: 'wolf', stockValue: 88000, totalAssets: 150000, playerUuid: 'p5' },
      ]) })
    }
    if (url.startsWith('/api/results/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        teamCode: 'AB1234',
        classId: 'class-1',
        className: '1반',
        players: [
          { rank: 1, name: '홍길동', className: '1반', teamCode: 'AB1234', character: 'fox', totalAssets: 50000, stockValue: 12000, realEstateValue: 8000, playerUuid: 'p3' },
        ],
      }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([
      { rank: 1, name: '김민준', className: '1반', teamCode: 'AB1234', character: 'lion', totalAssets: 200000, playerUuid: 'p4' },
    ]) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RankingPage', () => {
  it('홈 진입(sessionId 없음)에서는 총자산/주식/부동산 3개 탭만 보이고 전체/수업/팀 서브탭은 없다', async () => {
    renderAt('/ranking')
    await screen.findByText('김민준')
    expect(screen.getByText('총자산')).toBeInTheDocument()
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.getByText('부동산')).toBeInTheDocument()
    expect(screen.queryByText('전체')).toBeNull()
    expect(screen.queryByText('수업')).toBeNull()
    expect(screen.queryByText('팀')).toBeNull()
  })

  it('결과등록 후 진입(sessionId 있음)에서는 총자산/주식/부동산 탭 아래에 전체/수업/팀 서브탭이 보인다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByText('총자산')).toBeInTheDocument()
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.getByText('부동산')).toBeInTheDocument()
    expect(screen.getByText('수업')).toBeInTheDocument()
    expect(screen.getByText('팀')).toBeInTheDocument()
  })

  it('주식 탭 선택 시 /api/rankings?category=stock을 호출한다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('주식'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=stock')
    })
    expect(await screen.findByText('정우성')).toBeInTheDocument()
  })

  it('부동산 탭 선택 시 /api/rankings?category=realEstate를 호출한다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부동산'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=realEstate')
    })
    expect(await screen.findByText('한소희')).toBeInTheDocument()
  })

  it('수업 탭을 선택하면 내 세션의 classId로 /api/rankings를 호출한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    await userEvent.click(screen.getByText('수업'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?classId=class-1')
    })
  })

  it('수업 탭 + 주식 탭을 함께 선택하면 classId와 category를 함께 요청한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    await userEvent.click(screen.getByText('수업'))
    await userEvent.click(screen.getByText('주식'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?classId=class-1&category=stock')
    })
    expect(await screen.findByText('유아인')).toBeInTheDocument()
  })

  it('팀 탭에서는 카테고리와 무관하게 /api/results/:sessionId를 호출하고 선택된 카테고리 값을 보여준다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    await userEvent.click(screen.getByText('팀'))
    await userEvent.click(screen.getByText('주식'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/results/session-1')
    })
    expect(await screen.findByText('12,000원')).toBeInTheDocument()
  })

  it('홈 진입(sessionId 없음)에서는 나의 기록(pinned row)이 보이지 않는다', async () => {
    renderAt('/ranking')
    expect(await screen.findByText('김민준')).toBeInTheDocument()
    expect(screen.queryByTestId('pinned-row')).toBeNull()
    expect(screen.queryByTestId('pinned-row-empty')).toBeNull()
  })

  it('홈 진입(sessionId 없음)에서는 뒤로가기 버튼이 보인다', async () => {
    renderAt('/ranking')
    await screen.findByText('김민준')
    expect(screen.getByLabelText('뒤로 가기')).toBeInTheDocument()
  })

  it('결과등록 후 진입(sessionId 있음)에서는 뒤로가기 버튼이 보이지 않는다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.queryByLabelText('뒤로 가기')).not.toBeInTheDocument()
  })

  it('결과등록 후 진입(sessionId 있음)에서는 처음으로 버튼이 보인다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument()
  })

  it('플레이어 행 클릭 시 관리자 수정화면과 동일한 읽기전용 상세보기를 연다', async () => {
    renderAt('/ranking')
    await userEvent.click(await screen.findByText('김민준'))
    expect(screen.getByText('‹ 뒤로')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-job')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-cash')).not.toBeInTheDocument()
  })

  it('상세보기에서 뒤로 버튼 클릭 시 닫힌다', async () => {
    renderAt('/ranking')
    await userEvent.click(await screen.findByText('김민준'))
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(screen.queryByText('‹ 뒤로')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: FAIL — 여러 건(`총자산` 텍스트 없음, `/api/rankings?category=stock` 미호출 등)

- [ ] **Step 3: `RankingPage.jsx` 재작성**

전체 파일을 다음으로 교체:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import AdminEditModal from '../components/admin/AdminEditModal'
import { getPlayerUuid } from '../utils/playerUuid'
import styles from './RankingPage.module.css'

const CATEGORY_TABS = [
  { key: 'totalAssets', label: '총자산' },
  { key: 'stock', label: '주식' },
  { key: 'realEstate', label: '부동산' },
]

const SCOPE_TABS = [
  { key: 'global', label: '전체' },
  { key: 'class', label: '수업' },
  { key: 'team', label: '팀' },
]

const VALUE_KEYS = { totalAssets: 'totalAssets', stock: 'stockValue', realEstate: 'realEstateValue' }

function toAdminPlayer(row) {
  return {
    playerUuid: row.playerUuid,
    name: row.name,
    character: row.character,
    affiliation: row.affiliation,
    gameState: {
      job: row.job ?? null,
      cash: row.cash ?? 0,
      stocks: row.stockHoldings ?? {},
      realEstate: row.realEstateHoldings ?? {},
      badges: row.badges ?? [false, false, false, false, false, false],
      isCompleted: true,
    },
  }
}

function toAdminPrices(row) {
  return {
    stocks: row.stockPrices ?? {},
    realEstate: row.realEstatePrices ?? {},
  }
}

export default function RankingPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const isV2 = Boolean(sessionId)

  const [category, setCategory] = useState('totalAssets')
  const [scope, setScope] = useState('global')
  const [rows, setRows] = useState([])
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

  useEffect(() => {
    setLoading(true)
    setError(null)

    if (isV2 && scope === 'class' && myClassId === undefined) return

    if (isV2 && scope === 'team') {
      fetch(`/api/results/${sessionId}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(data => { setRows(data.players ?? []); setLoading(false) })
        .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
      return
    }

    const params = new URLSearchParams()
    if (isV2 && scope === 'class') params.set('classId', myClassId)
    if (category !== 'totalAssets') params.set('category', category)
    const query = params.toString()

    fetch(`/api/rankings${query ? `?${query}` : ''}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [category, scope, sessionId, isV2, myClassId])

  const valueKey = VALUE_KEYS[category]
  const podiumRows = rows.slice(0, 3)

  function handleRowClick(row) {
    if (!row || row.isPlaceholder) {
      navigate('/join')
      return
    }
    setViewingPlayer(row)
  }

  return (
    <div className={styles.page}>
      {isV2 ? <BackButton to="/" label="처음으로" /> : <BackButton />}
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>랭킹</h1>
          <p className={styles.subtitle}>총 자산 순위를 확인하세요</p>
        </div>
        <hr className={styles.divider} />
        <div className={styles.topTabs}>
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.topTab} ${category === tab.key ? styles.topTabActive : ''}`}
              onClick={() => {
                // rows를 함께 비워야 이전 탭의 데이터(다른 valueKey 형태)가
                // 새 탭의 렌더에 잘못 섞여 RankingPodium이 깨지는 것을 막는다.
                setRows([])
                setCategory(tab.key)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isV2 && (
          <div className={styles.tabs}>
            {SCOPE_TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${scope === tab.key ? styles.tabActive : ''}`}
                onClick={() => {
                  setRows([])
                  setScope(tab.key)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {loading && <p className={styles.message}>불러오는 중...</p>}
        {error && <p className={styles.message}>{error}</p>}
        {!loading && !error && (
          <RankingTable
            rows={rows}
            valueKey={valueKey}
            highlightPlayerUuid={isV2 ? myPlayerUuid : undefined}
            onRowClick={handleRowClick}
            podium={
              // 순위 1~3위가 모두 있을 때만 시상대를 보여준다. 아래 목록에도 동일한
              // 상위 랭커가 다시 나타나므로, 일부만 채워진 시상대는 오히려 어색하다.
              // 목록과 같은 스크롤 영역 안에 있어야 하므로 RankingTable에 넘겨 그
              // 안에서 렌더링한다.
              podiumRows.length === 3
                ? <RankingPodium rows={podiumRows} valueKey={valueKey} onRowClick={handleRowClick} />
                : null
            }
          />
        )}
      </div>

      {viewingPlayer && (
        <div className={styles.overlay} onClick={() => setViewingPlayer(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <AdminEditModal
              player={toAdminPlayer(viewingPlayer)}
              prices={toAdminPrices(viewingPlayer)}
              onClose={() => setViewingPlayer(null)}
              readOnly
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `BoothCategoryTabs` 삭제**

```bash
git rm src/components/BoothCategoryTabs.jsx src/components/BoothCategoryTabs.module.css src/components/BoothCategoryTabs.test.jsx
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: PASS (전체)

- [ ] **Step 6: 전체 프론트엔드 테스트 실행(회귀 확인)**

Run: `npx vitest run`
Expected: PASS (전체 — `BoothCategoryTabs` 삭제로 인한 다른 참조 깨짐이 없는지 확인)

- [ ] **Step 7: 커밋**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.test.jsx
git commit -m "feat: restructure ranking page into category/scope two-row tabs"
```
