# 순자산 랭킹 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 페이지와 관리자 랭킹 뷰에 성공카드 배수를 뺀 "순자산(현금+주식평가액+부동산평가액)" 기준 순위 탭을 추가한다.

**Architecture:** 서버 `getRankings`에 `category: 'netWorth'` 분기를 추가해 세 자산값의 합으로 정렬하고, `mapRankingRow`가 모든 랭킹 행에 `netWorth` 숫자 필드를 실어 보낸다. 프론트 두 화면은 카테고리 탭 한 줄과 `VALUE_KEYS` 항목만 추가하면 기존 fetch/정렬/렌더 로직이 그대로 동작한다. 팀 스코프(`/api/results/:sessionId`)만 클라이언트에서 `netWorth`를 계산해 재정렬한다.

**Tech Stack:** Node + Express + Supabase (server), React + Vite + CSS Modules (client), Vitest (test).

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `server/db.js` | 랭킹 조회/정렬, 행 매핑 | `getRankings` netWorth 분기, `netWorthOf` 헬퍼, `mapRankingRow`에 `netWorth` 필드 |
| `server/db.test.js` | `getRankings` 단위 테스트 | netWorth 정렬/null 처리/`netWorth` 필드 케이스 추가, 기존 `toEqual` 케이스 갱신 |
| `src/pages/RankingPage.jsx` | 참가자용 랭킹 화면 | `CATEGORY_TABS`/`VALUE_KEYS`에 netWorth, 팀 스코프 매핑에 `netWorth` 계산 |
| `src/pages/RankingPage.test.jsx` | 랭킹 화면 테스트 | 순자산 탭 노출/요청/팀 재정렬 케이스 추가, 탭 개수 단언 갱신 |
| `src/pages/AdminRankingView.jsx` | 관리자용 랭킹 화면 | `CATEGORY_TABS`/`VALUE_KEYS`에 netWorth |

`RankingTable.jsx` / `RankingPodium.jsx` / `server/index.js` — 변경 없음.

---

## Task 1: 서버 — `getRankings`에 netWorth 카테고리 추가

**Files:**
- Modify: `server/db.js` (`getRankings` ~259-278, `mapRankingRow` ~233-255, `RANKING_ORDER_COLUMN` ~257)
- Test: `server/db.test.js` (`describe('getRankings')` ~188-349)

- [ ] **Step 1: netWorth 정렬 실패 테스트 작성**

`server/db.test.js`의 `describe('getRankings', () => {` 블록 안, `it('알 수 없는 category는 에러를 던진다', ...)` 앞에 추가:

```js
  it('category가 netWorth이면 현금+주식+부동산 값의 합으로 내림차순 정렬해 반환한다', async () => {
    const rows = [
      {
        player_uuid: 'p1', name: 'A', affiliation: '', character: 'lion', job: 'a',
        cash: 10000, stock_holdings: {}, real_estate_holdings: {},
        badges: [true, true, true, true, true, true],
        total_assets: 300000, stock_value: 5000, real_estate_value: 5000,
        session_id: 's1',
        game_sessions: { team_code: 'AB', title: null, stock_prices: {}, real_estate_prices: {}, class_id: null, classes: null },
      },
      {
        player_uuid: 'p2', name: 'B', affiliation: '', character: 'fox', job: 'b',
        cash: 90000, stock_holdings: {}, real_estate_holdings: {},
        badges: [true, true, false, false, false, false],
        total_assets: 100000, stock_value: 10000, real_estate_value: 20000,
        session_id: 's2',
        game_sessions: { team_code: 'CD', title: null, stock_prices: {}, real_estate_prices: {}, class_id: null, classes: null },
      },
    ]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getRankings } = await import('./db.js')
    const result = await getRankings({ category: 'netWorth' })

    // A 순자산 20,000 / B 순자산 120,000 → B가 1위 (총자산 순서와 반대)
    expect(result.map(r => r.name)).toEqual(['B', 'A'])
    expect(result.map(r => r.rank)).toEqual([1, 2])
    expect(result[0].netWorth).toBe(120000)
    expect(result[1].netWorth).toBe(20000)
  })

  it('category가 netWorth일 때 stock_value/real_estate_value가 null인 행은 0으로 취급한다', async () => {
    const rows = [
      {
        player_uuid: 'p1', name: 'A', affiliation: '', character: 'lion', job: 'a',
        cash: 5000, stock_holdings: {}, real_estate_holdings: {},
        badges: [false, false, false, false, false, false],
        total_assets: 0, stock_value: null, real_estate_value: null,
        session_id: 's1',
        game_sessions: { team_code: 'AB', title: null, stock_prices: {}, real_estate_prices: {}, class_id: null, classes: null },
      },
      {
        player_uuid: 'p2', name: 'B', affiliation: '', character: 'fox', job: 'b',
        cash: 1000, stock_holdings: {}, real_estate_holdings: {},
        badges: [false, false, false, false, false, false],
        total_assets: 0, stock_value: 2000, real_estate_value: 500,
        session_id: 's2',
        game_sessions: { team_code: 'CD', title: null, stock_prices: {}, real_estate_prices: {}, class_id: null, classes: null },
      },
    ]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getRankings } = await import('./db.js')
    const result = await getRankings({ category: 'netWorth' })

    // A 순자산 5,000 / B 순자산 3,500 → A가 1위
    expect(result.map(r => r.name)).toEqual(['A', 'B'])
    expect(result[0].netWorth).toBe(5000)
    expect(result[1].netWorth).toBe(3500)
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/db.test.js -t "getRankings"`
Expected: FAIL — 새 두 케이스가 `netWorth`가 `undefined`이거나 정렬이 총자산 순서(`['A','B']` 첫 케이스)로 나와 실패.

- [ ] **Step 3: `netWorthOf` 헬퍼 + `getRankings` 분기 구현**

`server/db.js`의 `const RANKING_ORDER_COLUMN = ...` 줄 바로 위에 헬퍼 추가:

```js
function netWorthOf(r) {
  return (Number(r.cash) || 0) + (Number(r.stock_value) || 0) + (Number(r.real_estate_value) || 0)
}
```

`getRankings` 함수를 아래로 교체:

```js
export async function getRankings({ classId = null, category = null } = {}) {
  const isNetWorth = category === 'netWorth'
  const column = isNetWorth
    ? 'total_assets'
    : category ? RANKING_ORDER_COLUMN[category] : 'total_assets'
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

  const sorted = isNetWorth
    ? [...data].sort((a, b) => netWorthOf(b) - netWorthOf(a))
    : data

  return sorted.map(mapRankingRow)
}
```

- [ ] **Step 4: `mapRankingRow`에 `netWorth` 필드 추가**

`server/db.js`의 `mapRankingRow` 반환 객체에서 `realEstateValue: ...` 줄 다음에 추가:

```js
    netWorth: netWorthOf(r),
```

- [ ] **Step 5: 기존 `toEqual` 케이스 갱신**

`server/db.test.js`의 `it('teamCode, className, stockValue, realEstateValue를 포함해 반환한다', ...)` 안
`expect(result).toEqual([{ ... }])`의 기대 객체에서 `realEstateValue: 10000,` 다음 줄에 추가:

```js
      netWorth: 24000,
```

(해당 케이스 입력: `cash: 10000, stock_value: 4000, real_estate_value: 10000` → 합 24000)

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (전체 파일 — getRankings 신규/갱신 케이스 포함)

- [ ] **Step 7: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add netWorth category to getRankings"
```

---

## Task 2: 프론트 — `RankingPage`에 순자산 탭 추가

**Files:**
- Modify: `src/pages/RankingPage.jsx` (`CATEGORY_TABS` ~12-16, `VALUE_KEYS` ~24, 팀 스코프 `.then` ~62-80)
- Test: `src/pages/RankingPage.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/pages/RankingPage.test.jsx`의 `beforeEach` 안 `global.fetch = vi.fn((url) => {` 블록에서
`if (url === '/api/rankings?category=realEstate') {` 블록 다음에 추가:

```js
    if (url === '/api/rankings?category=netWorth') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '순자산王', className: '2반', teamCode: 'NW0001', character: 'bear', netWorth: 123000, totalAssets: 90000, playerUuid: 'pnw' },
      ]) })
    }
```

같은 파일 팀 스코프 mock(`if (url.startsWith('/api/results/'))`)의 `players` 배열을 아래로 교체
(순자산 순서가 총자산 순서와 반대가 되도록 `cash` 추가):

```js
        players: [
          { rank: 1, name: '홍길동', className: '1반', teamCode: 'AB1234', character: 'fox', cash: 0, totalAssets: 50000, stockValue: 12000, realEstateValue: 8000, playerUuid: 'p3' },
          { rank: 2, name: '김철수', className: '1반', teamCode: 'AB1234', character: 'wolf', cash: 40000, totalAssets: 30000, stockValue: 99000, realEstateValue: 1000, playerUuid: 'p9' },
        ],
```

`describe('RankingPage', () => {` 안, `it('부동산 탭 선택 시 ...')` 다음에 추가:

```js
  it('홈 진입에서 순자산 탭이 보이고 선택 시 /api/rankings?category=netWorth를 호출한다', async () => {
    renderAt('/ranking')
    await screen.findByText('김민준')
    await userEvent.click(screen.getByText('순자산'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=netWorth')
    })
    expect(await screen.findByText('순자산王')).toBeInTheDocument()
  })

  it('팀 탭에서 순자산을 선택하면 현금+주식+부동산 합 기준으로 재정렬되고 등수도 다시 매겨진다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    await userEvent.click(screen.getByText('팀'))
    await userEvent.click(screen.getByText('순자산'))

    // 홍길동 순자산 20,000 / 김철수 순자산 140,000 → 김철수 1위 (총자산 순서와 반대)
    await waitFor(() => expect(screen.getByText('140,000원')).toBeInTheDocument())
    const rows = [...document.querySelectorAll('[class*="row"]')]
      .map(el => el.textContent)
      .filter(t => t.includes('위'))
    const kimIdx = rows.findIndex(t => t.includes('김철수'))
    const hongIdx = rows.findIndex(t => t.includes('홍길동'))
    expect(kimIdx).toBeGreaterThanOrEqual(0)
    expect(kimIdx).toBeLessThan(hongIdx)
    expect(rows[kimIdx]).toContain('1위')
    expect(rows[hongIdx]).toContain('2위')
  })
```

`it('홈 진입(sessionId 없음)에서는 총자산/주식/부동산 3개 탭만 보이고 ...')` 케이스의 본문에 순자산 탭 단언 추가:

```js
    expect(screen.getByText('순자산')).toBeInTheDocument()
```

(제목을 `'... 3개 탭만 보이고 ...'` → `'... 탭만 보이고 ...'`로 바꿔도 무방하지만 필수 아님.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: FAIL — `순자산` 텍스트 없음 / `/api/rankings?category=netWorth` 미호출 / 팀 재정렬 안 됨.

- [ ] **Step 3: `CATEGORY_TABS`·`VALUE_KEYS` 수정**

`src/pages/RankingPage.jsx`:

```js
const CATEGORY_TABS = [
  { key: 'totalAssets', label: '총자산' },
  { key: 'stock', label: '주식' },
  { key: 'realEstate', label: '부동산' },
  { key: 'netWorth', label: '순자산' },
]
```

```js
const VALUE_KEYS = { totalAssets: 'totalAssets', stock: 'stockValue', realEstate: 'realEstateValue', netWorth: 'netWorth' }
```

- [ ] **Step 4: 팀 스코프 매핑에 `netWorth` 계산 추가**

`src/pages/RankingPage.jsx` 팀 스코프 `.then` 콜백의 `.map(p => ({ ... }))` 블록을 아래로 교체:

```js
          const players = (data.players ?? [])
            .map(p => ({
              ...p,
              netWorth: (p.cash ?? 0) + (p.stockValue ?? 0) + (p.realEstateValue ?? 0),
              stockPrices: data.stockPrices,
              realEstatePrices: data.realEstatePrices,
            }))
            .sort((a, b) => (b[vk] ?? 0) - (a[vk] ?? 0))
            .map((p, i) => ({ ...p, rank: i + 1 }))
```

`전체/수업` 스코프 fetch는 `if (category !== 'totalAssets') params.set('category', category)`가 이미
`netWorth`에 대해 `category=netWorth`를 붙이므로 변경 없음.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.test.jsx
git commit -m "feat: add net-worth tab to ranking page"
```

---

## Task 3: 프론트 — `AdminRankingView`에 순자산 탭 추가

**Files:**
- Modify: `src/pages/AdminRankingView.jsx` (`CATEGORY_TABS` ~17-22, `VALUE_KEYS` ~24)

(테스트 파일 없음 — 레포 컨벤션상 이 화면은 자동 테스트 대상 아님.)

- [ ] **Step 1: `CATEGORY_TABS`·`VALUE_KEYS` 수정**

`src/pages/AdminRankingView.jsx`:

```js
const CATEGORY_TABS = [
  { key: 'totalAssets', label: '총자산' },
  { key: 'netWorth', label: '순자산' },
  { key: 'cash', label: '현금' },
  { key: 'realEstate', label: '부동산' },
  { key: 'stock', label: '주식' },
]

const VALUE_KEYS = { totalAssets: 'totalAssets', netWorth: 'netWorth', cash: 'cash', stock: 'stockValue', realEstate: 'realEstateValue' }
```

fetch 로직(`if (category !== 'totalAssets') params.set('category', category)`)은 그대로 두면
`netWorth` 선택 시 `?classId=X&category=netWorth`가 전송되고 서버가 정렬한다. 포디움/테이블은
`row[valueKey]`(= `row.netWorth`)로 자동 렌더된다.

- [ ] **Step 2: 전체 테스트 스위트 확인**

Run: `npx vitest run`
Expected: PASS (기존 테스트 전부 — 회귀 없음)

- [ ] **Step 3: 수동 확인**

`npm run dev` 후:
- `/ranking` → "순자산" 탭 클릭 → 목록이 순자산 순서로 정렬되는지, 값이 배수 미적용 합계인지
- 게임 결과 화면(`/result/:sessionId`) → 전체/수업/팀 각 스코프에서 순자산 탭 동작
- 관리자 로그인 → 자산 랭킹 → "순자산" 탭 노출·정렬, 부제가 "순자산 기준"으로 표기

- [ ] **Step 4: 커밋**

```bash
git add src/pages/AdminRankingView.jsx
git commit -m "feat: add net-worth tab to admin ranking view"
```

---

## Self-Review 결과

- **Spec coverage:** 서버 netWorth 분기(Task 1) / `mapRankingRow` 필드(Task 1) / RankingPage 4번째 탭(Task 2) / 팀 스코프 클라 계산(Task 2) / AdminRankingView 탭(Task 3) / 테스트(Task 1-2) — 스펙 전 항목 커버. 범위 제외 항목(부제 동적화, Figma, 배수 로직)은 그대로 제외.
- **Placeholder scan:** 없음 — 모든 코드 스텝에 실제 코드 포함.
- **Type consistency:** `netWorth` 필드명, `netWorthOf(r)` 헬퍼, `category === 'netWorth'` 문자열, `VALUE_KEYS.netWorth = 'netWorth'` — Task 1-3 전반에서 일관.
