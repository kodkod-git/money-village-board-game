# 팀(클랜) 통계 스토리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트로피 탭 배너를 누르면 어두운 오버레이 위에 인스타그램 스토리처럼 넘겨 보는 6장짜리 클랜 대결 결과(인트로 → 현금 → 주식 → 부동산 → 총 자산 → 최종 순위)를 띄운다.

**Architecture:** 서버의 순수 함수 `buildClanRecap`이 결과 행과 메모리 클랜으로 클랜별 합계를 만들고 `GET …/clans/recap`이 돌려준다. 화면은 `AdminClassDashboard`가 배너 클릭 때 recap을 불러와 portal 오버레이 `ClanRecapStory`를 띄우고, 장 컴포넌트는 `src/components/admin/recap/`에 둔다. 지난 작업의 "준비 중" section(`ClanRecapPage`)은 지운다.

**Tech Stack:** React 18 + Vite, CSS Modules(애니메이션은 CSS keyframes), Express, Vitest + Testing Library

**설계 문서:** `docs/superpowers/specs/2026-10-30-clan-recap-story-design.md`

**테스트 실행:** `npx vitest run <경로>`

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `server/clanRecap.js` (새) | `buildClanRecap(rows, clans)` 클랜별 합계 |
| `server/index.js` | `GET /api/admin/classes/:classId/clans/recap` |
| `src/utils/clanRecap.js` (새) | `RECAP_CATEGORIES`, `rankTeams`, `topTeams`, `formatWon` |
| `src/components/admin/recap/RecapCategorySlide.jsx` (새) | 카테고리 장(막대 차례 공개) |
| `src/components/admin/recap/RecapIntroSlide.jsx` (새) | 인트로 장 |
| `src/components/admin/recap/RecapFinalSlide.jsx` (새) | 최종 순위 장(시상대 + 목록) |
| `src/components/admin/ClanRecapStory.jsx` (새) | 오버레이, 진행 막대, 넘기기, 키보드 |
| `src/components/admin/ClanRecapBanner.jsx` | `disabled` prop |
| `src/pages/AdminClassDashboard.jsx` | recap 불러오기·오버레이 열기, `initialTab`/`onOpenClanRecap` 삭제 |
| `src/pages/AdminDashboard.jsx` | `clan-recap` section·`teamStatusTab` 삭제 |
| `src/pages/ClanRecapPage.*` | 삭제 |

---

### Task 1: 서버 `buildClanRecap`

**Files:**
- Create: `server/clanRecap.js`
- Test: `server/clanRecap.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/clanRecap.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildClanRecap } from './clanRecap.js'

const row = (resultId, values = {}) => ({
  resultId, cash: 0, stockValue: 0, realEstateValue: 0, totalAssets: 0, ...values,
})

describe('buildClanRecap', () => {
  it('클랜별 합계를 내고, 빈 클랜과 사라진 결과는 빼며, null은 0으로 센다', () => {
    const recap = buildClanRecap(
      [
        row('r1', { cash: 100, stockValue: 200, realEstateValue: 300, totalAssets: 700 }),
        row('r2', { cash: 50, stockValue: null, realEstateValue: 10, totalAssets: 60 }),
        row('r3', { cash: 1 }),
      ],
      [
        { id: 'k1', name: '팀 1', memberIds: ['r1', 'r2'] },
        { id: 'k2', name: '팀 2', memberIds: [] },
        { id: 'k3', name: '팀 3', memberIds: ['gone', 'r3'] },
      ],
    )
    expect(recap).toEqual({
      teamCount: 2,
      memberCount: 3,
      teams: [
        { id: 'k1', name: '팀 1', memberCount: 2, cash: 150, stockValue: 200, realEstateValue: 310, totalAssets: 760 },
        { id: 'k3', name: '팀 3', memberCount: 1, cash: 1, stockValue: 0, realEstateValue: 0, totalAssets: 0 },
      ],
    })
  })

  it('클랜이 없으면 0개', () => {
    expect(buildClanRecap([row('r1')], [])).toEqual({ teamCount: 0, memberCount: 0, teams: [] })
  })

  it('소수 합계는 반올림한다', () => {
    const recap = buildClanRecap(
      [row('r1', { totalAssets: 100.4 }), row('r2', { totalAssets: 0.4 })],
      [{ id: 'k1', name: '팀 1', memberIds: ['r1', 'r2'] }],
    )
    expect(recap.teams[0].totalAssets).toBe(101)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/clanRecap.test.js`
Expected: FAIL — `Failed to resolve import "./clanRecap.js"`

- [ ] **Step 3: 구현**

`server/clanRecap.js`:

```js
// 트로피 탭 "팀 대결 결과" 스토리: 클랜별 합계. 결과 행이 없는(삭제된) 멤버는 세지 않고,
// 멤버가 한 명도 없는 클랜은 비교에서 뺀다. 구 데이터의 null 값은 0으로 더한다.
const SUM_KEYS = ['cash', 'stockValue', 'realEstateValue', 'totalAssets']

export function buildClanRecap(rows, clans) {
  const byId = new Map(rows.map(row => [row.resultId, row]))
  const teams = clans
    .map(clan => {
      const members = clan.memberIds.map(id => byId.get(id)).filter(Boolean)
      const team = { id: clan.id, name: clan.name, memberCount: members.length }
      for (const key of SUM_KEYS) {
        team[key] = Math.round(members.reduce((sum, m) => sum + (Number(m[key]) || 0), 0))
      }
      return team
    })
    .filter(team => team.memberCount > 0)
  return {
    teamCount: teams.length,
    memberCount: teams.reduce((sum, team) => sum + team.memberCount, 0),
    teams,
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/clanRecap.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/clanRecap.js server/clanRecap.test.js
git commit -m "feat: sum clan results for the recap story"
```

---

### Task 2: recap API

**Files:**
- Modify: `server/index.js`

이 저장소는 `server/index.js` 라우트를 단위 테스트하지 않는다(로직은 Task 1에서 테스트).

- [ ] **Step 1: import 추가**

`import { buildClanView } from './clanView.js'` 줄 아래에:

```js
import { buildClanRecap } from './clanRecap.js'
```

- [ ] **Step 2: 라우트 추가**

`app.get('/api/admin/classes/:classId/clans', ...)` 핸들러 바로 아래에:

```js
app.get('/api/admin/classes/:classId/clans/recap', requireAdmin, async (req, res) => {
  const { classId } = req.params
  try {
    if (await denyClassAccess(req, res)) return
    const rows = await loadClanRows(classId)
    res.json(buildClanRecap(rows, listClans(classId)))
  } catch (err) {
    console.error('clan recap error:', err)
    res.status(500).json({ error: '팀 대결 결과를 불러오지 못했어요' })
  }
})
```

- [ ] **Step 3: 확인**

Run: `node --check server/index.js` → 출력 없음
Run: `npx vitest run server` → 모두 PASS

- [ ] **Step 4: 커밋**

```bash
git add server/index.js
git commit -m "feat: add clan recap API"
```

---

### Task 3: 화면 순위 유틸 `src/utils/clanRecap.js`

**Files:**
- Create: `src/utils/clanRecap.js`
- Test: `src/utils/clanRecap.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest'
import { rankTeams, topTeams, formatWon, RECAP_CATEGORIES } from './clanRecap'

const T = [
  { id: 'a', name: 'A', cash: 100 },
  { id: 'b', name: 'B', cash: 300 },
  { id: 'c', name: 'C', cash: 300 },
  { id: 'd', name: 'D', cash: 0 },
]

describe('clanRecap utils', () => {
  it('rankTeams: 값 내림차순, 동점이면 원래 순서', () => {
    expect(rankTeams(T, 'cash').map(t => t.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(T.map(t => t.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('topTeams: 1위 값과 같은 팀 모두, 빈 배열이면 []', () => {
    expect(topTeams(T, 'cash').map(t => t.id)).toEqual(['b', 'c'])
    expect(topTeams([], 'cash')).toEqual([])
  })

  it('formatWon: 천 단위 쉼표 + 원', () => {
    expect(formatWon(1234567)).toBe('1,234,567원')
    expect(formatWon(0)).toBe('0원')
  })

  it('카테고리 4개를 현금 → 주식 → 부동산 → 총 자산 순서로 둔다', () => {
    expect(RECAP_CATEGORIES.map(c => c.valueKey)).toEqual(['cash', 'stockValue', 'realEstateValue', 'totalAssets'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/utils/clanRecap.test.js`
Expected: FAIL — import 실패

- [ ] **Step 3: 구현**

`src/utils/clanRecap.js`:

```js
// 팀 대결 결과 스토리(ClanRecapStory)의 장 정의와 순위 계산.
export const RECAP_CATEGORIES = [
  { valueKey: 'cash', title: '현금을 가장 많이 모은 팀은?', theme: 'cash' },
  { valueKey: 'stockValue', title: '주식으로 가장 많이 번 팀은?', theme: 'stock' },
  { valueKey: 'realEstateValue', title: '부동산으로 가장 많이 번 팀은?', theme: 'estate' },
  { valueKey: 'totalAssets', title: '총 자산이 가장 많은 팀은?', theme: 'total' },
]

// 값이 큰 순서. Array.prototype.sort는 안정 정렬이라 동점이면 원래(클랜) 순서를 지킨다.
export function rankTeams(teams, valueKey) {
  return [...teams].sort((a, b) => b[valueKey] - a[valueKey])
}

export function topTeams(teams, valueKey) {
  if (teams.length === 0) return []
  const top = Math.max(...teams.map(team => team[valueKey]))
  return teams.filter(team => team[valueKey] === top)
}

export function formatWon(value) {
  return `${value.toLocaleString('ko-KR')}원`
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/utils/clanRecap.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/utils/clanRecap.js src/utils/clanRecap.test.js
git commit -m "feat: add clan recap ranking helpers"
```

---

### Task 4: `RecapCategorySlide`

**Files:**
- Create: `src/components/admin/recap/RecapCategorySlide.jsx`, `src/components/admin/recap/RecapCategorySlide.module.css`
- Test: `src/components/admin/recap/RecapCategorySlide.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapCategorySlide from './RecapCategorySlide'

const team = (id, name, cash) => ({ id, name, memberCount: 2, cash, stockValue: 0, realEstateValue: 0, totalAssets: 0 })

describe('RecapCategorySlide', () => {
  it('제목, 큰 값부터 줄, 1위 기준 막대 너비, 동점 1위를 보여준다', () => {
    render(
      <RecapCategorySlide
        title="현금을 가장 많이 모은 팀은?"
        valueKey="cash"
        teams={[team('k1', '팀 1', 100), team('k2', '팀 2', 200), team('k3', '팀 3', 200)]}
      />
    )
    expect(screen.getByRole('heading', { name: '현금을 가장 많이 모은 팀은?' })).toBeInTheDocument()
    const rows = screen.getAllByTestId('recap-row')
    expect(rows.map(r => r.textContent)).toEqual(['팀 2200원', '팀 3200원', '팀 1100원'])
    expect(screen.getAllByTestId('recap-bar').map(b => b.style.width)).toEqual(['100%', '100%', '50%'])
    expect(screen.getByTestId('recap-winner')).toHaveTextContent('🏆 팀 2 · 팀 3')
  })

  it('꼴찌 줄의 막대가 먼저(지연 0), 1위가 마지막에 차오른다', () => {
    render(
      <RecapCategorySlide title="t" valueKey="cash" teams={[team('k1', 'A', 300), team('k2', 'B', 200), team('k3', 'C', 100)]} />
    )
    const delays = screen.getAllByTestId('recap-bar').map(b => b.style.getPropertyValue('--delay'))
    expect(delays).toEqual(['700ms', '350ms', '0ms'])
    expect(screen.getByTestId('recap-winner').style.getPropertyValue('--delay')).toBe('1200ms')
  })

  it('모두 0원이면 막대 0%, "0원", 전원 1위', () => {
    render(<RecapCategorySlide title="t" valueKey="cash" teams={[team('k1', 'A', 0), team('k2', 'B', 0)]} />)
    expect(screen.getAllByTestId('recap-bar').map(b => b.style.width)).toEqual(['0%', '0%'])
    expect(screen.getAllByText('0원')).toHaveLength(2)
    expect(screen.getByTestId('recap-winner')).toHaveTextContent('🏆 A · B')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/recap/RecapCategorySlide.test.jsx`
Expected: FAIL — import 실패

- [ ] **Step 3: 구현**

`src/components/admin/recap/RecapCategorySlide.jsx`:

```jsx
import { rankTeams, topTeams, formatWon } from '../../../utils/clanRecap'
import styles from './RecapCategorySlide.module.css'

const MAX_STEP_MS = 350
const TOTAL_STEP_MS = 2400
const FILL_MS = 500

// 한 가지 수치로 클랜을 비교하는 장. 맨 아래(꼴찌) 막대부터 차례로 차오르고,
// 1위 막대가 다 찬 뒤 위쪽에 1위 팀 이름이 떠오른다. 지연 시간은 CSS 변수 --delay로 넘긴다.
export default function RecapCategorySlide({ title, valueKey, teams }) {
  const ranked = rankTeams(teams, valueKey)
  const topValue = ranked[0]?.[valueKey] ?? 0
  const winners = topTeams(teams, valueKey).map(team => team.name)
  const step = Math.min(MAX_STEP_MS, TOTAL_STEP_MS / Math.max(ranked.length, 1))
  const delayOf = index => Math.round((ranked.length - 1 - index) * step)

  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.winner} data-testid="recap-winner" style={{ '--delay': `${delayOf(0) + FILL_MS}ms` }}>
        🏆 {winners.join(' · ')}
      </p>
      <ol className={styles.bars}>
        {ranked.map((team, index) => (
          <li key={team.id} className={styles.row} data-testid="recap-row" style={{ '--delay': `${delayOf(index)}ms` }}>
            <span className={styles.name}>{team.name}</span>
            <span className={styles.track}>
              <span
                className={styles.bar}
                data-testid="recap-bar"
                style={{
                  width: `${topValue > 0 ? (team[valueKey] / topValue) * 100 : 0}%`,
                  '--delay': `${delayOf(index)}ms`,
                }}
              />
            </span>
            <span className={styles.value}>{formatWon(team[valueKey])}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
```

`src/components/admin/recap/RecapCategorySlide.module.css`:

```css
.slide {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  padding: 24px 4px 8px;
}

.title { font-size: 24px; font-weight: 900; line-height: 1.3; color: #fff; text-align: center; }

.winner {
  min-height: 40px;
  font-size: 26px;
  font-weight: 900;
  color: #ffe27a;
  text-align: center;
  animation: pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) var(--delay) both;
}

.bars { list-style: none; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }

.row {
  display: grid;
  grid-template-columns: minmax(64px, 30%) 1fr auto;
  align-items: center;
  gap: 10px;
}

.name { font-size: 15px; font-weight: 800; color: #fff; overflow-wrap: anywhere; }

.track { height: 18px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); overflow: hidden; }

.bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  transform-origin: left center;
  animation: fill 0.5s ease-out var(--delay) both;
}

.value {
  font-size: 13px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  animation: fade 0.3s ease-out var(--delay) both;
}

@keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop {
  from { opacity: 0; transform: translateY(10px) scale(0.85); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .winner, .bar, .value { animation: none; }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/admin/recap/RecapCategorySlide.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/recap/RecapCategorySlide.*
git commit -m "feat: add recap category slide with staggered reveal"
```

---

### Task 5: `RecapIntroSlide`, `RecapFinalSlide`

**Files:**
- Create: `src/components/admin/recap/RecapIntroSlide.jsx`, `src/components/admin/recap/RecapIntroSlide.module.css`, `src/components/admin/recap/RecapFinalSlide.jsx`, `src/components/admin/recap/RecapFinalSlide.module.css`
- Test: `src/components/admin/recap/RecapIntroSlide.test.jsx`, `src/components/admin/recap/RecapFinalSlide.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/admin/recap/RecapIntroSlide.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapIntroSlide from './RecapIntroSlide'

describe('RecapIntroSlide', () => {
  it('수업 이름, 팀 수·인원, 넘기기 안내를 보여준다', () => {
    render(<RecapIntroSlide className="3학년 2반" teamCount={3} memberCount={12} />)
    expect(screen.getByRole('heading', { name: '3학년 2반 팀 대결 결과' })).toBeInTheDocument()
    expect(screen.getByText('3개 팀 · 12명이 겨뤘어요')).toBeInTheDocument()
    expect(screen.getByText('오른쪽으로 넘겨 결과를 확인하세요 ›')).toBeInTheDocument()
  })
})
```

`src/components/admin/recap/RecapFinalSlide.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapFinalSlide from './RecapFinalSlide'

const t = (id, name, totalAssets) => ({ id, name, memberCount: 1, cash: 0, stockValue: 0, realEstateValue: 0, totalAssets })

describe('RecapFinalSlide', () => {
  it('총 자산 1·2·3위를 시상대에, 4위부터 목록에 보여준다', () => {
    render(<RecapFinalSlide teams={[t('a', '가', 100), t('b', '나', 400), t('c', '다', 300), t('d', '라', 200), t('e', '마', 50)]} />)
    expect(screen.getByRole('heading', { name: '최종 순위' })).toBeInTheDocument()
    expect(screen.getByTestId('podium-1')).toHaveTextContent('나')
    expect(screen.getByTestId('podium-1')).toHaveTextContent('400원')
    expect(screen.getByTestId('podium-2')).toHaveTextContent('다')
    expect(screen.getByTestId('podium-3')).toHaveTextContent('라')
    const rest = screen.getAllByTestId('recap-rest-row').map(r => r.textContent)
    expect(rest).toEqual(['4위가100원', '5위마50원'])
  })

  it('팀이 하나면 1위 자리만 있고 목록은 없다', () => {
    render(<RecapFinalSlide teams={[t('a', '가', 100)]} />)
    expect(screen.getByTestId('podium-1')).toHaveTextContent('가')
    expect(screen.queryByTestId('podium-2')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('recap-rest-row')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/recap/RecapIntroSlide.test.jsx src/components/admin/recap/RecapFinalSlide.test.jsx`
Expected: FAIL — import 실패

- [ ] **Step 3: 구현**

`src/components/admin/recap/RecapIntroSlide.jsx`:

```jsx
import styles from './RecapIntroSlide.module.css'

export default function RecapIntroSlide({ className, teamCount, memberCount }) {
  return (
    <div className={styles.slide}>
      <span className={styles.trophy} aria-hidden="true">🏆</span>
      <h2 className={styles.title}>{className} 팀 대결 결과</h2>
      <p className={styles.summary}>{teamCount}개 팀 · {memberCount}명이 겨뤘어요</p>
      <p className={styles.hint}>오른쪽으로 넘겨 결과를 확인하세요 ›</p>
    </div>
  )
}
```

`src/components/admin/recap/RecapIntroSlide.module.css`:

```css
.slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  text-align: center;
}
.trophy { font-size: 88px; line-height: 1; animation: rise 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) both; }
.title { font-size: 30px; font-weight: 900; line-height: 1.3; color: #fff; animation: fade 0.5s ease-out 0.2s both; }
.summary { font-size: 17px; font-weight: 700; color: rgba(255, 255, 255, 0.85); animation: fade 0.5s ease-out 0.4s both; }
.hint { margin-top: 24px; font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.6); animation: fade 0.5s ease-out 0.8s both; }

@keyframes rise { from { opacity: 0; transform: translateY(24px) scale(0.7); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .trophy, .title, .summary, .hint { animation: none; }
}
```

`src/components/admin/recap/RecapFinalSlide.jsx`:

```jsx
import { rankTeams, formatWon } from '../../../utils/clanRecap'
import styles from './RecapFinalSlide.module.css'

// 시상대는 가운데 1위, 왼쪽 2위, 오른쪽 3위. 순위는 총 자산 정렬 순서 그대로(동점이어도 앞선 팀이 높은 순위).
const PODIUM_ORDER = [1, 0, 2]
const MEDALS = ['🥇', '🥈', '🥉']

export default function RecapFinalSlide({ teams }) {
  const ranked = rankTeams(teams, 'totalAssets')
  const podium = PODIUM_ORDER.filter(i => ranked[i]).map(i => ({ team: ranked[i], rank: i + 1 }))
  const rest = ranked.slice(3)

  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>최종 순위</h2>
      <p className={styles.subtitle}>총 자산 기준</p>
      <div className={styles.podium}>
        {podium.map(({ team, rank }) => (
          <div key={team.id} className={`${styles.slot} ${styles[`rank${rank}`]}`} data-testid={`podium-${rank}`}>
            <span className={styles.medal} aria-hidden="true">{MEDALS[rank - 1]}</span>
            <span className={styles.name}>{team.name}</span>
            <span className={styles.value}>{formatWon(team.totalAssets)}</span>
            <div className={styles.block}>{rank}위</div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className={styles.rest}>
          {rest.map((team, i) => (
            <li key={team.id} className={styles.restRow} data-testid="recap-rest-row">
              <span className={styles.restRank}>{i + 4}위</span>
              <span className={styles.restName}>{team.name}</span>
              <span className={styles.restValue}>{formatWon(team.totalAssets)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
```

`src/components/admin/recap/RecapFinalSlide.module.css`:

```css
.slide { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 24px 4px 8px; }
.title { font-size: 26px; font-weight: 900; color: #fff; text-align: center; }
.subtitle { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.7); text-align: center; }

.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}
.slot {
  flex: 1;
  max-width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  animation: rise 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
.rank3 { animation-delay: 0.1s; }
.rank2 { animation-delay: 0.4s; }
.rank1 { animation-delay: 0.8s; }
.medal { font-size: 32px; line-height: 1; }
.name { font-size: 14px; font-weight: 800; color: #fff; text-align: center; overflow-wrap: anywhere; }
.value { font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.85); white-space: nowrap; }
.block {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
  border-radius: 10px 10px 0 0;
  background: rgba(255, 255, 255, 0.16);
  font-size: 16px;
  font-weight: 900;
  color: #fff;
}
.rank1 .block { height: 120px; background: rgba(255, 226, 122, 0.35); }
.rank2 .block { height: 88px; }
.rank3 .block { height: 64px; }

.rest {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
  overflow-y: auto;
  animation: fade 0.4s ease-out 1.2s both;
}
.restRow {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
}
.restRank { font-size: 13px; font-weight: 800; color: rgba(255, 255, 255, 0.7); }
.restName { font-size: 14px; font-weight: 700; color: #fff; overflow-wrap: anywhere; }
.restValue { font-size: 13px; font-weight: 700; color: rgba(255, 255, 255, 0.85); white-space: nowrap; }

@keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .slot, .rest { animation: none; }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/admin/recap`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/recap/RecapIntroSlide.* src/components/admin/recap/RecapFinalSlide.*
git commit -m "feat: add recap intro and final ranking slides"
```

---

### Task 6: `ClanRecapStory` 오버레이

**Files:**
- Create: `src/components/admin/ClanRecapStory.jsx`, `src/components/admin/ClanRecapStory.module.css`
- Test: `src/components/admin/ClanRecapStory.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClanRecapStory from './ClanRecapStory'

const RECAP = {
  teamCount: 2,
  memberCount: 4,
  teams: [
    { id: 'k1', name: '호랑이반', memberCount: 2, cash: 100, stockValue: 300, realEstateValue: 0, totalAssets: 500 },
    { id: 'k2', name: '토끼반', memberCount: 2, cash: 200, stockValue: 100, realEstateValue: 0, totalAssets: 400 },
  ],
}

function renderStory() {
  const onClose = vi.fn()
  const utils = render(<ClanRecapStory className="3학년 2반" recap={RECAP} onClose={onClose} />)
  return { onClose, ...utils }
}

const progressStates = () => screen.getAllByTestId('recap-progress').map(s => s.dataset.state)
const heading = () => screen.getAllByRole('heading')[0].textContent

describe('ClanRecapStory', () => {
  it('대화상자로 열리고 인트로부터 시작하며 진행 막대는 6칸이다', () => {
    renderStory()
    expect(screen.getByRole('dialog', { name: '팀 대결 결과' })).toBeInTheDocument()
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
    expect(screen.getByText('2개 팀 · 4명이 겨뤘어요')).toBeInTheDocument()
    expect(progressStates()).toEqual(['current', 'todo', 'todo', 'todo', 'todo', 'todo'])
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeInTheDocument()
  })

  it('다음·이전 버튼으로 넘기고, 마지막 장에서는 다음 버튼이 없다', async () => {
    renderStory()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(heading()).toBe('현금을 가장 많이 모은 팀은?')
    expect(progressStates()).toEqual(['done', 'current', 'todo', 'todo', 'todo', 'todo'])
    await userEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(heading()).toBe('최종 순위')
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument()
  })

  it('장 순서는 인트로 → 현금 → 주식 → 부동산 → 총 자산 → 최종 순위', async () => {
    renderStory()
    const titles = [heading()]
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      titles.push(heading())
    }
    expect(titles).toEqual([
      '3학년 2반 팀 대결 결과',
      '현금을 가장 많이 모은 팀은?',
      '주식으로 가장 많이 번 팀은?',
      '부동산으로 가장 많이 번 팀은?',
      '총 자산이 가장 많은 팀은?',
      '최종 순위',
    ])
  })

  it('키보드 →/← 로 넘기고 Esc로 닫는다', () => {
    const { onClose } = renderStory()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(heading()).toBe('현금을 가장 많이 모은 팀은?')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('카드의 왼쪽 1/3을 누르면 이전, 나머지를 누르면 다음', () => {
    renderStory()
    const card = screen.getByTestId('recap-card')
    card.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 500, right: 300, bottom: 500 })
    fireEvent.click(card, { clientX: 200 })
    expect(heading()).toBe('현금을 가장 많이 모은 팀은?')
    fireEvent.click(card, { clientX: 50 })
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
  })

  it('닫기 버튼은 onClose를 부른다', async () => {
    const { onClose } = renderStory()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('열려 있는 동안 body 스크롤을 막고 닫히면 되돌린다', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderStory()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/ClanRecapStory.test.jsx`
Expected: FAIL — import 실패

- [ ] **Step 3: 구현**

`src/components/admin/ClanRecapStory.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import RecapIntroSlide from './recap/RecapIntroSlide'
import RecapCategorySlide from './recap/RecapCategorySlide'
import RecapFinalSlide from './recap/RecapFinalSlide'
import { RECAP_CATEGORIES } from '../../utils/clanRecap'
import styles from './ClanRecapStory.module.css'

// 팀 대결 결과 스토리: 어두운 오버레이 위 세로 카드를 인스타그램 스토리처럼 넘겨 본다.
// 자동으로 넘어가지 않는다(선생님이 설명하며 넘긴다). 배경을 눌러도 닫히지 않는다.
export default function ClanRecapStory({ className, recap, onClose }) {
  const [index, setIndex] = useState(0)

  const slides = [
    {
      key: 'intro',
      theme: 'intro',
      content: <RecapIntroSlide className={className} teamCount={recap.teamCount} memberCount={recap.memberCount} />,
    },
    ...RECAP_CATEGORIES.map(category => ({
      key: category.valueKey,
      theme: category.theme,
      content: <RecapCategorySlide title={category.title} valueKey={category.valueKey} teams={recap.teams} />,
    })),
    { key: 'final', theme: 'final', content: <RecapFinalSlide teams={recap.teams} /> },
  ]
  const last = slides.length - 1
  const slide = slides[index]

  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex(i => Math.min(last, i + 1)), [last])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prev, next, onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  // 인스타그램처럼 카드 왼쪽 1/3은 이전, 나머지는 다음.
  function handleCardClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.clientX - rect.left < rect.width / 3) prev()
    else next()
  }

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="팀 대결 결과">
      <button type="button" className={styles.closeBtn} aria-label="닫기" onClick={onClose}>×</button>
      <div className={styles.stage}>
        {index > 0
          ? <button type="button" className={styles.navBtn} aria-label="이전" onClick={prev}>‹</button>
          : <span className={styles.navSpacer} aria-hidden="true" />}
        <div className={`${styles.card} ${styles[slide.theme]}`} data-testid="recap-card" onClick={handleCardClick}>
          <div className={styles.progress}>
            {slides.map((s, i) => (
              <span
                key={s.key}
                className={styles.segment}
                data-testid="recap-progress"
                data-state={i < index ? 'done' : i === index ? 'current' : 'todo'}
              />
            ))}
          </div>
          <p className={styles.className}>{className}</p>
          {/* key로 다시 마운트해서 장에 들어올 때마다 애니메이션을 처음부터 재생한다 */}
          <div key={slide.key} className={styles.content}>{slide.content}</div>
        </div>
        {index < last
          ? <button type="button" className={styles.navBtn} aria-label="다음" onClick={next}>›</button>
          : <span className={styles.navSpacer} aria-hidden="true" />}
      </div>
    </div>,
    document.body,
  )
}
```

`src/components/admin/ClanRecapStory.module.css`:

```css
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 12, 0.92);
  animation: fadeIn 0.4s ease-out both;
}

.closeBtn {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #fff;
  font-size: 34px;
  line-height: 1;
  cursor: pointer;
}
.closeBtn:hover { background: rgba(255, 255, 255, 0.1); }

.stage { display: flex; align-items: center; gap: 24px; }

.navBtn, .navSpacer { flex: none; width: 44px; height: 44px; }
.navBtn {
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: #111;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.navBtn:hover { background: #fff; }

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  height: min(88vh, 820px);
  aspect-ratio: 9 / 16;
  padding: 16px 20px 24px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  animation: cardIn 0.45s ease-out 0.1s both;
  transition: background 0.4s ease;
}
.intro, .final { background: linear-gradient(160deg, #0b1f14 0%, #0f3b24 55%, #1d7a45 100%); }
.cash { background: linear-gradient(160deg, #06281a 0%, #0b5a34 60%, #23a35f 100%); }
.stock { background: linear-gradient(160deg, #0a1633 0%, #123d8a 60%, #2f6fe0 100%); }
.estate { background: linear-gradient(160deg, #2b1405 0%, #8a3f0c 60%, #e07a1f 100%); }
.total { background: linear-gradient(160deg, #1c0b33 0%, #4b1d8a 60%, #8a4fe0 100%); }

.progress { display: flex; gap: 4px; }
.segment { flex: 1; height: 3px; border-radius: 2px; background: rgba(255, 255, 255, 0.3); }
.segment[data-state='done'] { background: rgba(255, 255, 255, 0.85); }
.segment[data-state='current'] { background: #fff; box-shadow: 0 0 6px rgba(255, 255, 255, 0.7); }

.className { margin-top: 10px; font-size: 13px; font-weight: 700; color: rgba(255, 255, 255, 0.8); }

.content { flex: 1; min-height: 0; animation: slideIn 0.3s ease-out both; }

@keyframes fadeIn { from { background: rgba(10, 10, 12, 0); } to { background: rgba(10, 10, 12, 0.92); } }
@keyframes cardIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes slideIn { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .backdrop, .card, .content { animation: none; }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/admin/ClanRecapStory.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/ClanRecapStory.*
git commit -m "feat: add clan recap story overlay"
```

---

### Task 7: 대시보드 연결과 "준비 중" 화면 정리

**Files:**
- Modify: `src/components/admin/ClanRecapBanner.jsx`, `src/pages/AdminClassDashboard.jsx`, `src/pages/AdminClassDashboard.test.jsx`, `src/pages/AdminDashboard.jsx`
- Delete: `src/pages/ClanRecapPage.jsx`, `src/pages/ClanRecapPage.module.css`, `src/pages/ClanRecapPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`src/pages/AdminClassDashboard.test.jsx`에서 `it('배너를 누르면 onOpenClanRecap을 부른다', ...)` 블록을 지우고, 그 자리에 추가:

```jsx
  function mockClanFetch(recapResponse) {
    global.fetch.mockImplementation(url => {
      if (url.includes('/clans/recap')) return Promise.resolve(recapResponse)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/clans') ? { participants: [], clans: [] } : ROOMS),
      })
    })
  }

  async function openTrophyTab() {
    renderDashboard()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByRole('button', { name: '팀 대결' }))
  }

  it('배너를 누르면 recap을 불러와 스토리를 연다', async () => {
    mockClanFetch({
      ok: true,
      json: () => Promise.resolve({
        teamCount: 1,
        memberCount: 2,
        teams: [{ id: 'k1', name: '호랑이반', memberCount: 2, cash: 1, stockValue: 1, realEstateValue: 1, totalAssets: 3 }],
      }),
    })
    await openTrophyTab()
    await userEvent.click(await screen.findByRole('button', { name: /팀 대결 결과/ }))
    expect(await screen.findByRole('dialog', { name: '팀 대결 결과' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3학년 2반 팀 대결 결과' })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1/clans/recap', expect.anything())
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('비교할 팀이 없으면 스토리를 열지 않고 안내한다', async () => {
    mockClanFetch({ ok: true, json: () => Promise.resolve({ teamCount: 0, memberCount: 0, teams: [] }) })
    await openTrophyTab()
    await userEvent.click(await screen.findByRole('button', { name: /팀 대결 결과/ }))
    expect(await screen.findByText('팀에 참여자를 배정하면 결과를 볼 수 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('recap 요청이 실패하면 서버 오류를 안내한다', async () => {
    mockClanFetch({ ok: false, json: () => Promise.resolve({ error: '팀 대결 결과를 불러오지 못했어요' }) })
    await openTrophyTab()
    await userEvent.click(await screen.findByRole('button', { name: /팀 대결 결과/ }))
    expect(await screen.findByText('팀 대결 결과를 불러오지 못했어요')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
```

주의: `renderDashboard()`는 `<Toaster />`를 함께 그린다(파일 위쪽에 정의돼 있음). `mockClanFetch`는 `renderDashboard()` 전에 불러도 된다 — 대시보드의 팀 목록 요청(`/api/admin/rooms?...`)은 `ROOMS`를 받는다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
Expected: 새 테스트 3개 FAIL (`onOpen`이 없어 아무 일도 일어나지 않음)

- [ ] **Step 3: `ClanRecapBanner`에 `disabled`**

`src/components/admin/ClanRecapBanner.jsx`:

```jsx
export default function ClanRecapBanner({ onOpen, disabled = false }) {
  return (
    <button type="button" className={styles.banner} onClick={onOpen} disabled={disabled}>
```

`src/components/admin/ClanRecapBanner.module.css` 끝에 추가:

```css
.banner:disabled { cursor: progress; opacity: 0.7; transform: none; box-shadow: none; }
```

- [ ] **Step 4: `AdminClassDashboard` 연결**

`src/pages/AdminClassDashboard.jsx`:

import 추가(`ClanRecapBanner` import 아래):

```js
import ClanRecapStory from '../components/admin/ClanRecapStory'
```

시그니처와 탭 상태를 되돌린다:

```js
export default function AdminClassDashboard({ classId, initialName }) {
```

```js
  const [activeTab, setActiveTab] = useState('grid')
```

상태 추가(`activeTab` 근처):

```js
  // 팀 대결 결과 스토리: 배너를 누를 때 한 번 불러온다(열려 있는 동안 갱신하지 않음).
  const [recap, setRecap] = useState(null)
  const [isLoadingRecap, setIsLoadingRecap] = useState(false)
```

핸들러 추가(`handleCreateRoom` 위):

```js
  async function handleOpenRecap() {
    if (isLoadingRecap) return
    setIsLoadingRecap(true)
    try {
      const res = await adminFetch(`/api/admin/classes/${encodeURIComponent(classId)}/clans/recap`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(data.error || '팀 대결 결과를 불러오지 못했어요')
        return
      }
      if (data.teamCount === 0) {
        toast('팀에 참여자를 배정하면 결과를 볼 수 있어요')
        return
      }
      setRecap(data)
    } catch {
      toast('팀 대결 결과를 불러오지 못했어요')
    } finally {
      setIsLoadingRecap(false)
    }
  }
```

배너 줄을 바꾼다:

```jsx
      {activeTab === 'clans' && rooms.length > 0 && (
        <ClanRecapBanner onOpen={handleOpenRecap} disabled={isLoadingRecap} />
      )}
```

`{showSurveyQr && <SurveyQRModal ... />}` 줄 아래에 추가:

```jsx
      {recap && <ClanRecapStory className={name} recap={recap} onClose={() => setRecap(null)} />}
```

- [ ] **Step 5: `AdminDashboard` 정리와 `ClanRecapPage` 삭제**

`src/pages/AdminDashboard.jsx`:
- `import ClanRecapPage from './ClanRecapPage'` 삭제
- `teamStatusTab` 상태와 그 위 주석 두 줄(`// 클랜 통계 화면에서 돌아올 때 …`, `const [teamStatusTab, setTeamStatusTab] = useState('grid')`) 삭제
- `handleSelectClass`의 `setTeamStatusTab('grid')` 줄 삭제
- `handleNavigate`의 `if (key === 'team-status') setTeamStatusTab('grid')` 줄 삭제
- `activeSection={section === 'clan-recap' ? 'team-status' : section}` → `activeSection={section}`
- `AdminClassDashboard`의 `initialTab={teamStatusTab}`, `onOpenClanRecap={() => setSection('clan-recap')}` 두 줄 삭제
- `{section === 'clan-recap' && selectedClass && ( <ClanRecapPage … /> )}` 블록 전체 삭제

결과적으로 `AdminClassDashboard` 부분은 다음과 같다:

```jsx
      {section === 'team-status' && selectedClass && (
        <AdminClassDashboard
          classId={selectedClass.id}
          initialName={selectedClass.name}
        />
      )}
```

```bash
git rm -q src/pages/ClanRecapPage.jsx src/pages/ClanRecapPage.module.css src/pages/ClanRecapPage.test.jsx
```

확인: `git grep -n "ClanRecapPage\|clan-recap\|teamStatusTab\|onOpenClanRecap\|initialTab" -- src` → 결과 없음

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/pages src/components/admin`
Expected: 모두 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/components/admin/ClanRecapBanner.jsx src/components/admin/ClanRecapBanner.module.css src/pages/AdminClassDashboard.jsx src/pages/AdminClassDashboard.test.jsx src/pages/AdminDashboard.jsx
git commit -m "feat: open clan recap story from the trophy tab banner"
```

(`git rm`으로 지운 파일은 이미 스테이징되어 함께 커밋된다.)

---

### Task 8: 전체 확인

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `npx vitest run` → 모두 PASS
Run: `npm run build` → 성공

- [ ] **Step 2: 실제 앱 확인(관리자 계정 필요)**

- 트로피 탭에서 팀 2~3개에 참여자를 배정한 뒤 배너 클릭 → 배경이 서서히 어두워지고 카드가 뜬다.
- 인트로 → 현금 → 주식 → 부동산 → 총 자산 → 최종 순위. 카테고리 장마다 막대가 아래부터 차오르고 마지막에 🏆 1위가 뜬다. 다시 돌아가면 처음부터 재생된다.
- ‹ ›, 카드 왼쪽/오른쪽 클릭, 키보드 ←/→, Esc, × 동작. 배경 클릭으로는 닫히지 않는다.
- 클랜이 하나도 없을 때 배너 → 안내 토스트.
- 사이드바까지 오버레이가 덮는다. 프로젝터 해상도(1280×720 등)에서 카드가 화면 안에 들어온다.
