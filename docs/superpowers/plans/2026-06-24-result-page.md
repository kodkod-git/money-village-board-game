# Result Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 테이블 행 클릭 시 해당 플레이어의 게임 결과 상세를 보여주는 ResultPage를 구현한다.

**Architecture:** RankingTable에 `onRowClick` prop을 추가하고, RankingPage에서 `/result/:sessionId/player/:playerUuid` 라우트로 navigate한다. ResultPage는 `/api/results/:sessionId`를 호출해 플레이어 데이터를 가져와 2열 레이아웃으로 렌더링한다. `getAllRankings()`는 이미 `sessionId`를 반환하므로 백엔드 변경 불필요.

**Tech Stack:** React 18, React Router v6, Vitest + @testing-library/react, CSS Modules

---

## File Map

| 파일 | 변경 |
|------|------|
| `src/components/RankingTable.jsx` | `onRowClick` prop 추가, `<tr>`에 onClick |
| `src/components/RankingTable.test.jsx` | 클릭 테스트 추가 |
| `src/pages/RankingPage.jsx` | `onRowClick` 핸들러 → navigate |
| `src/App.jsx` | 신규 라우트 등록 |
| `src/pages/ResultPage.jsx` | 신규 — 결과 상세 페이지 |
| `src/pages/ResultPage.module.css` | 신규 — 2열 레이아웃 스타일 |
| `src/pages/ResultPage.test.jsx` | 신규 — ResultPage 단위 테스트 |

---

## Task 1: RankingTable에 onRowClick prop 추가

**Files:**
- Modify: `src/components/RankingTable.jsx`
- Test: `src/components/RankingTable.test.jsx`

- [ ] **Step 1: 클릭 테스트 작성**

`src/components/RankingTable.test.jsx` 파일 상단 import를 아래로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RankingTable from './RankingTable'
```

파일 끝 `describe` 블록 안에 테스트 추가:

```jsx
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/components/RankingTable.test.jsx
```

Expected: FAIL — "onRowClick이 있을 때 행 클릭 시..."

- [ ] **Step 3: RankingTable.jsx에 onRowClick 구현**

`src/components/RankingTable.jsx`의 컴포넌트 시그니처와 `<tr>` 렌더링을 아래로 교체:

```jsx
export default function RankingTable({ rows, highlightPlayerUuid, onRowClick }) {
```

`<tbody>` 내 `<tr>`를 아래로 교체:

```jsx
<tr
  key={row.playerUuid ?? `${row.rank}-${row.name}`}
  className={styles.tr}
  onClick={onRowClick ? () => onRowClick(row) : undefined}
  style={onRowClick ? { cursor: 'pointer' } : undefined}
>
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/components/RankingTable.test.jsx
```

Expected: PASS (기존 3개 + 신규 1개)

- [ ] **Step 5: 커밋**

```bash
git add src/components/RankingTable.jsx src/components/RankingTable.test.jsx
git commit -m "feat: add onRowClick prop to RankingTable"
```

---

## Task 2: RankingPage에 navigate 핸들러 연결

**Files:**
- Modify: `src/pages/RankingPage.jsx`

- [ ] **Step 1: RankingPage.jsx 수정**

`RankingTable` 컴포넌트 호출 부분을 아래로 교체:

```jsx
<RankingTable
  rows={rows}
  highlightPlayerUuid={isV2 ? myPlayerUuid : undefined}
  onRowClick={row => {
    if (row.sessionId && row.playerUuid) {
      navigate(`/result/${row.sessionId}/player/${row.playerUuid}`)
    }
  }}
/>
```

- [ ] **Step 2: 테스트 실행**

```bash
npx vitest run src/components/RankingTable.test.jsx
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/pages/RankingPage.jsx
git commit -m "feat: navigate to result page on ranking row click"
```

---

## Task 3: App.jsx에 ResultPage 라우트 등록

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: App.jsx 수정**

파일 상단 import에 추가:

```jsx
import ResultPage from './pages/ResultPage'
```

`<Routes>` 안에 아래 라우트 추가 (기존 라우트들 뒤):

```jsx
<Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
```

- [ ] **Step 2: 커밋**

```bash
git add src/App.jsx
git commit -m "feat: register ResultPage route"
```

---

## Task 4: ResultPage.jsx 구현

**Files:**
- Create: `src/pages/ResultPage.jsx`
- Create: `src/pages/ResultPage.module.css`
- Create: `src/pages/ResultPage.test.jsx`

- [ ] **Step 1: ResultPage.test.jsx 작성**

`src/pages/ResultPage.test.jsx` 파일 생성:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultPage from './ResultPage'

const mockSession = {
  stockPrices: { semiconductor: 10000, finance: 8000, industrial: 6000, auto: 7000, bio: 9000, content: 5000 },
  realEstatePrices: { gaon: 50000, nuri: 60000, dami: 40000, maru: 45000, chorong: 80000, hani: 75000 },
  players: [
    {
      rank: 1,
      name: '홍길동',
      affiliation: '경영학과',
      character: 'fox',
      job: 'a',
      cash: 50000,
      stockHoldings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstateHoldings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, true, false, false, false],
      totalAssets: 230000,
      playerUuid: 'uuid-1',
    },
  ],
}

function renderWithRoute(sessionId = 'sess-1', playerUuid = 'uuid-1') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockSession),
  })
  return render(
    <MemoryRouter initialEntries={[`/result/${sessionId}/player/${playerUuid}`]}>
      <Routes>
        <Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResultPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('플레이어 이름과 소속을 렌더링한다', async () => {
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    expect(screen.getByText('경영학과')).toBeInTheDocument()
  })

  it('총 자산을 렌더링한다', async () => {
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('230,000원')).toBeInTheDocument())
  })

  it('획득한 성공카드 이미지만 렌더링한다', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('홍길동'))
    const imgs = screen.getAllByRole('img').filter(img => img.src?.includes('/badges/success/'))
    expect(imgs).toHaveLength(2)
    expect(imgs[0].alt).toBe('communication')
    expect(imgs[1].alt).toBe('idea')
  })

  it('부동산 소계를 헤더에 표시한다', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('홍길동'))
    // gaon 1개 × 50000 = 50,000원
    expect(screen.getByText('50,000원')).toBeInTheDocument()
  })

  it('fetch 실패 시 에러 메시지를 표시한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    render(
      <MemoryRouter initialEntries={['/result/bad/player/bad']}>
        <Routes>
          <Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('결과를 불러올 수 없습니다.')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/pages/ResultPage.test.jsx
```

Expected: FAIL — "Cannot find module './ResultPage'"

- [ ] **Step 3: ResultPage.module.css 작성**

`src/pages/ResultPage.module.css` 파일 생성:

```css
.page {
  min-height: 100vh;
  background: #0f0f1a;
  color: #eee;
  position: relative;
}

.backBtn {
  position: absolute;
  top: 16px;
  left: 16px;
  background: none;
  border: none;
  color: #aaa;
  font-size: 14px;
  cursor: pointer;
  z-index: 1;
  padding: 4px 8px;
}

.backBtn:hover { color: #fff; }

.columns {
  display: flex;
  min-height: 100vh;
}

.leftCol {
  width: 40%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  padding: 60px 24px 24px;
  gap: 12px;
}

.characterImg {
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.playerName {
  font-size: 22px;
  font-weight: bold;
  color: #fff;
  text-align: center;
}

.playerAffiliation {
  font-size: 14px;
  color: #aaa;
  text-align: center;
}

.rightCol {
  width: 60%;
  overflow-y: auto;
  padding: 60px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sectionHeader {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.sectionLabel {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.subtotal {
  font-size: 14px;
  color: #ffd700;
  font-weight: 600;
}

.totalAssets {
  font-size: 28px;
  font-weight: bold;
  color: #ffd700;
}

.jobRow {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  color: #eee;
}

.jobImg {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.badgeGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badgeImg {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.assetGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.assetImg {
  width: 44px;
  height: 44px;
  object-fit: contain;
  cursor: help;
}

.cashValue {
  font-size: 20px;
  font-weight: 600;
  color: #eee;
}

.message {
  color: #888;
  text-align: center;
  padding: 40px;
}
```

- [ ] **Step 4: ResultPage.jsx 작성**

`src/pages/ResultPage.jsx` 파일 생성:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import styles from './ResultPage.module.css'

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}
const JOB_IMAGES = {
  a: '경영금융', b: '연구기술', c: '보건교육',
  d: '문화콘텐츠', e: '서비스판매', f: '생산운송',
}
const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']
const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

export default function ResultPage() {
  const { sessionId, playerUuid } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState(null)
  const [stockPrices, setStockPrices] = useState({})
  const [realEstatePrices, setRealEstatePrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/results/${sessionId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const found = data.players?.find(p => p.playerUuid === playerUuid)
        if (!found) throw new Error('Player not found')
        setPlayer(found)
        setStockPrices(data.stockPrices ?? {})
        setRealEstatePrices(data.realEstatePrices ?? {})
        setLoading(false)
      })
      .catch(() => { setError('결과를 불러올 수 없습니다.'); setLoading(false) })
  }, [sessionId, playerUuid])

  if (loading) return <div className={styles.page}><p className={styles.message}>불러오는 중...</p></div>
  if (error) return <div className={styles.page}><p className={styles.message}>{error}</p></div>

  const earnedBadges = BADGE_NAMES.filter((_, i) => player.badges?.[i])
  const estateItems = Object.entries(player.realEstateHoldings ?? {}).filter(([, qty]) => qty > 0)
  const stockItems = Object.entries(player.stockHoldings ?? {}).filter(([, qty]) => qty > 0)
  const estateSubtotal = estateItems.reduce((sum, [key, qty]) => sum + (realEstatePrices[key] ?? 0) * qty, 0)
  const stockSubtotal = stockItems.reduce((sum, [key, qty]) => sum + (stockPrices[key] ?? 0) * qty, 0)

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← 뒤로</button>
      <div className={styles.columns}>
        <div className={styles.leftCol}>
          <img
            src={`/characters/${player.character}.png`}
            alt={player.character}
            className={styles.characterImg}
          />
          <div className={styles.playerName}>{player.name}</div>
          <div className={styles.playerAffiliation}>{player.affiliation}</div>
        </div>

        <div className={styles.rightCol}>
          <section className={styles.section}>
            <div className={styles.sectionLabel}>총 자산</div>
            <div className={styles.totalAssets}>{player.totalAssets.toLocaleString()}원</div>
          </section>

          {player.job && (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>직업</div>
              <div className={styles.jobRow}>
                <img
                  src={`/badges/job/${JOB_IMAGES[player.job]}.png`}
                  alt={JOB_LABELS[player.job]}
                  className={styles.jobImg}
                />
                <span>{JOB_LABELS[player.job]}</span>
              </div>
            </section>
          )}

          {earnedBadges.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>성공카드</div>
              <div className={styles.badgeGrid}>
                {earnedBadges.map(name => (
                  <img
                    key={name}
                    src={`/badges/success/${name}.png`}
                    alt={name}
                    className={styles.badgeImg}
                  />
                ))}
              </div>
            </section>
          )}

          {estateItems.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>부동산</span>
                <span className={styles.subtotal}>{estateSubtotal.toLocaleString()}원</span>
              </div>
              <div className={styles.assetGrid}>
                {estateItems.flatMap(([key, qty]) =>
                  Array.from({ length: qty }, (_, i) => (
                    <img
                      key={`${key}-${i}`}
                      src={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                      alt={ESTATE_IMAGES[key]}
                      className={styles.assetImg}
                      title={`${(realEstatePrices[key] ?? 0).toLocaleString()}원`}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          {stockItems.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>주식</span>
                <span className={styles.subtotal}>{stockSubtotal.toLocaleString()}원</span>
              </div>
              <div className={styles.assetGrid}>
                {stockItems.flatMap(([key, qty]) =>
                  Array.from({ length: qty }, (_, i) => (
                    <img
                      key={`${key}-${i}`}
                      src={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                      alt={STOCK_IMAGES[key]}
                      className={styles.assetImg}
                      title={`${(stockPrices[key] ?? 0).toLocaleString()}원`}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionLabel}>현금</div>
            <div className={styles.cashValue}>{(player.cash ?? 0).toLocaleString()}원</div>
          </section>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/pages/ResultPage.test.jsx
```

Expected: PASS (5개 테스트 모두)

- [ ] **Step 6: 전체 테스트 실행**

```bash
npx vitest run
```

Expected: 모든 기존 테스트 포함 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/pages/ResultPage.jsx src/pages/ResultPage.module.css src/pages/ResultPage.test.jsx
git commit -m "feat: implement ResultPage with 2-column layout"
```

---

## 완료 체크리스트

- [ ] `npx vitest run` — 전체 PASS
- [ ] 개발 서버에서 랭킹 테이블 행 클릭 → ResultPage 진입 확인
- [ ] 뒤로가기 버튼으로 랭킹 페이지 복귀 확인
- [ ] 부동산/주식 이미지 hover 시 단가 툴팁 확인
