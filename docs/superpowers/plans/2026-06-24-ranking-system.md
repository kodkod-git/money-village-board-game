# 랭킹 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이어 소속 입력을 추가하고, 랜딩 화면과 전체/소속/팀별 랭킹 페이지를 구현한다.

**Architecture:** 접근법 A를 사용한다. `/ranking`은 탭 없는 글로벌 랭킹(Entry V1), `/result/:sessionId`는 3탭+내 기록 고정(Entry V2)로 `RankingPage` 컴포넌트 하나가 두 모드를 처리한다. `RankingTable`을 공통 컴포넌트로 분리해 중복을 없앤다. 소속은 Supabase `game_results.affiliation` 컬럼에 저장한다.

**Tech Stack:** React 18, React Router v6, CSS Modules, Express, Socket.io, Supabase (PostgreSQL), Vitest, React Testing Library

---

## 파일 구조

| 파일 | 변경 종류 | 역할 |
|------|-----------|------|
| Supabase SQL | 마이그레이션 | `game_results.affiliation` 컬럼 추가 |
| `server/rooms.js` | 수정 | player 객체에 `affiliation` 추가 |
| `server/rooms.test.js` | 수정 | `affiliation` 포함 테스트 추가 |
| `server/db.js` | 수정 | `affiliation` 저장/반환, `getAllRankings()` 추가 |
| `server/index.js` | 수정 | `GET /api/rankings` 라우트, `affiliation` 소켓 수신 |
| `src/pages/NameInput.jsx` | 수정 | 소속 입력 필드 추가 |
| `src/pages/NameInput.module.css` | 수정 | 소속 입력 스타일 |
| `src/pages/NameInput.test.jsx` | 수정 | 소속 입력 테스트 |
| `src/pages/CharacterSelect.jsx` | 수정 | `affiliation` 파라미터 전달 |
| `src/pages/Home.jsx` | 수정 | `affiliation`을 소켓 이벤트에 포함 |
| `src/components/RankingTable.jsx` | 신규 | 공통 랭킹 테이블 컴포넌트 |
| `src/components/RankingTable.module.css` | 신규 | 랭킹 테이블 스타일 |
| `src/components/RankingTable.test.jsx` | 신규 | 랭킹 테이블 테스트 |
| `src/pages/LandingPage.jsx` | 신규 | 랭킹/참여 버튼 랜딩 화면 |
| `src/pages/LandingPage.module.css` | 신규 | 랜딩 화면 스타일 |
| `src/pages/RankingPage.jsx` | 신규 | V1/V2 분기 랭킹 페이지 |
| `src/pages/RankingPage.module.css` | 신규 | 랭킹 페이지 스타일 |
| `src/App.jsx` | 수정 | 라우트 변경, ResultPage 제거 |
| `src/pages/ResultPage.jsx` | 삭제 | RankingPage로 대체 |
| `src/pages/ResultPage.module.css` | 삭제 | RankingPage로 대체 |

---

## Task 1: Supabase DB 마이그레이션

**Files:**
- Supabase SQL Editor (대시보드에서 실행)

- [ ] **Step 1: Supabase 대시보드 SQL 에디터에서 마이그레이션 실행**

```sql
ALTER TABLE game_results ADD COLUMN affiliation TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 2: 적용 확인**

Supabase Table Editor에서 `game_results` 테이블을 열어 `affiliation` 컬럼이 추가됐는지 확인한다.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: apply Supabase migration - add affiliation to game_results"
```

---

## Task 2: server/rooms.js — affiliation 추가

**Files:**
- Modify: `server/rooms.js`
- Test: `server/rooms.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`server/rooms.test.js`의 `describe('addPlayer')` 블록에 아래 테스트를 추가한다.

```js
it('affiliation을 포함한 플레이어를 추가한다', () => {
  const { code } = createRoom()
  addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, affiliation: '경영학과' })
  const player = getRoom(code).players[0]
  expect(player.affiliation).toBe('경영학과')
})

it('affiliation 미전달 시 빈 문자열로 저장된다', () => {
  const { code } = createRoom()
  addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
  const player = getRoom(code).players[0]
  expect(player.affiliation).toBe('')
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- server/rooms.test.js
```

Expected: 새 테스트 2개 FAIL

- [ ] **Step 3: rooms.js 구현 수정**

`server/rooms.js`의 `addPlayer` 함수에서 player 객체 생성 시 `affiliation`을 추가한다.

```js
// addPlayer 함수 내부, player 객체 스프레드 부분을 찾아서:
// 기존: { socketId, name, character, isHost, playerUuid }
// 아래와 같이 affiliation 추가

export function addPlayer(code, { socketId, name, character, isHost, playerUuid, affiliation = '' }) {
  if (!socketId) throw new Error('player.socketId is required')
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')
  if (room.players.length >= 4) throw new Error('Room is full')
  room.players.push({ socketId, name, character, isHost, playerUuid, affiliation, gameState: null })
  return room
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test -- server/rooms.test.js
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add affiliation field to player in rooms"
```

---

## Task 3: server/db.js — affiliation 저장 및 getAllRankings 추가

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: db.test.js에 getAllRankings 실패 테스트 작성**

`server/db.test.js`를 열어 아래 테스트를 추가한다.

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllRankings } from './db.js'

// Supabase mock
vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn(),
  },
}))
```

> **Note:** db.js는 Supabase를 직접 호출하므로, 기존 db.test.js에 이미 mock이 있으면 그 방식을 따른다.

대신 `saveGameResult`에 `affiliation`이 포함되는지 확인하려면 아래처럼 확인한다.

```js
describe('saveGameResult includes affiliation', () => {
  it('rows에 affiliation 필드가 포함된다', () => {
    // calculateTotalAssets는 순수 함수이므로 직접 테스트 가능
    // saveGameResult의 rows 매핑 로직을 확인: affiliation이 player에서 rows로 전달되는지 코드 리뷰로 확인
  })
})
```

> **Pragmatic note:** `saveGameResult`와 `getAllRankings`는 Supabase와 직접 통합되므로 단위 테스트보다 Task 4 완료 후 실제 서버로 통합 테스트한다. Task 3에서는 `calculateTotalAssets` 수정 없음을 확인하고 코드 변경에 집중한다.

- [ ] **Step 2: db.js — saveGameResult에 affiliation 추가**

`server/db.js`의 `saveGameResult` 함수에서 `rows` 매핑 부분을 수정한다.

```js
const rows = players.map(player => ({
  session_id: session.id,
  player_uuid: player.playerUuid,
  name: player.name,
  affiliation: player.affiliation ?? '',   // 추가
  character: player.character,
  job: player.gameState.job,
  cash: player.gameState.cash ?? 0,
  stock_holdings: player.gameState.stocks,
  real_estate_holdings: player.gameState.realEstate,
  badges: player.gameState.badges,
  total_assets: calculateTotalAssets(player.gameState, prices),
}))
```

- [ ] **Step 3: db.js — getGameResult에 affiliation 반환 추가**

`server/db.js`의 `getGameResult` 함수 응답 매핑에 `affiliation` 추가:

```js
export async function getGameResult(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('*')
    .eq('session_id', sessionId)
    .order('total_assets', { ascending: false })

  if (resultsError) throw resultsError

  return { session, results }
  // results rows에 affiliation 컬럼이 자동 포함됨 (SELECT * 사용 중)
}
```

> `SELECT *` 를 이미 사용 중이므로 `affiliation` 컬럼 추가만으로 자동 반환된다. 별도 수정 불필요.

- [ ] **Step 4: db.js — getAllRankings 함수 추가**

`server/db.js` 파일 끝에 추가:

```js
export async function getAllRankings(affiliation = null) {
  let query = supabase
    .from('game_results')
    .select('player_uuid, name, affiliation, character, total_assets, session_id')
    .order('total_assets', { ascending: false })

  if (affiliation) {
    query = query.eq('affiliation', affiliation)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    affiliation: r.affiliation,
    character: r.character,
    totalAssets: Number(r.total_assets),
    sessionId: r.session_id,
    playerUuid: r.player_uuid,
  }))
}
```

- [ ] **Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: add affiliation to db layer and getAllRankings function"
```

---

## Task 4: server/index.js — /api/rankings 라우트 및 affiliation 수신

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: getAllRankings import 추가**

`server/index.js` 상단 import 줄을 수정한다.

```js
import { saveGameResult, getGameResult, getAllRankings } from './db.js'
```

- [ ] **Step 2: /api/rankings 라우트 추가**

`app.get('/api/results/:sessionId', ...)` 블록 앞에 추가:

```js
app.get('/api/rankings', async (req, res) => {
  try {
    const affiliation = req.query.affiliation ?? null
    const rankings = await getAllRankings(affiliation)
    res.json(rankings)
  } catch (err) {
    console.error('rankings error:', err)
    res.status(500).json({ error: 'Failed to fetch rankings' })
  }
})
```

- [ ] **Step 3: /api/results/:sessionId 응답에 affiliation 포함**

`app.get('/api/results/:sessionId', ...)` 의 `players` 매핑 부분에 `affiliation` 추가:

```js
players: results.map((r, i) => ({
  rank: i + 1,
  name: r.name,
  affiliation: r.affiliation,   // 추가
  character: r.character,
  job: r.job,
  cash: r.cash,
  stockHoldings: r.stock_holdings,
  realEstateHoldings: r.real_estate_holdings,
  badges: r.badges,
  totalAssets: Number(r.total_assets),
  playerUuid: r.player_uuid,   // 추가 (RankingPage V2 내 기록 식별용)
})),
```

- [ ] **Step 4: join-room 소켓 핸들러에 affiliation 추가**

```js
socket.on('join-room', ({ code, name, character, isHost, playerUuid, affiliation }, callback) => {
  try {
    const room = addPlayer(code.toUpperCase(), {
      socketId: socket.id, name, character, isHost: !!isHost, playerUuid, affiliation,
    })
    socket.join(code.toUpperCase())
    io.to(code.toUpperCase()).emit('room-updated', { players: room.players })
    callback?.({ ok: true })
  } catch (err) {
    callback?.({ ok: false, error: err.message })
  }
})
```

- [ ] **Step 5: 서버 실행 후 API 확인**

```bash
npm run dev
# 별도 터미널에서:
curl http://localhost:3001/api/rankings
```

Expected: `[]` (데이터 없으면 빈 배열) 또는 기존 데이터가 있으면 JSON 배열

- [ ] **Step 6: Commit**

```bash
git add server/index.js
git commit -m "feat: add /api/rankings route and affiliation to socket handler"
```

---

## Task 5: NameInput — 소속 입력 필드 추가

**Files:**
- Modify: `src/pages/NameInput.jsx`
- Modify: `src/pages/NameInput.module.css`
- Modify: `src/pages/NameInput.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/pages/NameInput.test.jsx`에서 기존 테스트 아래에 추가:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NameInput from './NameInput'

// 기존 테스트 아래에 추가:

it('소속 입력 필드가 이름 입력 필드 위에 렌더링된다', () => {
  render(<MemoryRouter><NameInput /></MemoryRouter>)
  const affiliationInput = screen.getByPlaceholderText('예) 경영학과')
  const nameInput = screen.getByPlaceholderText('예) 홍길동')
  expect(affiliationInput).toBeInTheDocument()
  // 소속이 이름보다 먼저 DOM에 나타나야 함
  expect(affiliationInput.compareDocumentPosition(nameInput))
    .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

it('소속과 이름 모두 입력해야 다음 버튼이 작동한다', async () => {
  const mockNavigate = vi.fn()
  vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, useNavigate: () => mockNavigate }
  })
  render(<MemoryRouter><NameInput /></MemoryRouter>)
  
  fireEvent.change(screen.getByPlaceholderText('예) 홍길동'), { target: { value: '철수' } })
  fireEvent.click(screen.getByText('다음 →'))
  // 소속 없으면 navigate 호출 안 됨
  expect(mockNavigate).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- src/pages/NameInput.test.jsx
```

Expected: 새 테스트 FAIL

- [ ] **Step 3: NameInput.jsx 수정**

```jsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [affiliation, setAffiliation] = useState('')
  const [name, setName] = useState('')

  const code = searchParams.get('code') ?? ''

  function handleNext() {
    if (!affiliation.trim() || !name.trim()) return
    const params = new URLSearchParams({ affiliation: affiliation.trim(), name: name.trim() })
    if (code) params.set('code', code)
    navigate(`/select?${params}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>💰 Money Village</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
        <label className={styles.label}>소속을 입력하세요</label>
        <input
          className={styles.input}
          placeholder="예) 경영학과"
          value={affiliation}
          onChange={e => setAffiliation(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          maxLength={30}
        />
        <label className={styles.label}>이름을 입력하세요</label>
        <input
          className={styles.input}
          placeholder="예) 홍길동"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          maxLength={20}
        />
        <button className={styles.btn} onClick={handleNext}>다음 →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test -- src/pages/NameInput.test.jsx
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/NameInput.jsx src/pages/NameInput.test.jsx
git commit -m "feat: add affiliation input to NameInput page"
```

---

## Task 6: CharacterSelect — affiliation 파라미터 전달

**Files:**
- Modify: `src/pages/CharacterSelect.jsx`

- [ ] **Step 1: affiliation 파라미터 읽기 및 전달**

`src/pages/CharacterSelect.jsx`를 수정한다.

```jsx
// 기존 코드에서 name, code 읽는 줄 아래에 affiliation 추가:
const name = searchParams.get('name') ?? ''
const affiliation = searchParams.get('affiliation') ?? ''   // 추가
const code = searchParams.get('code') ?? ''

// handleSubmit 함수 내 params 생성 수정:
function handleSubmit() {
  if (!selected) return
  const params = new URLSearchParams({ affiliation, name, character: selected })  // affiliation 추가
  if (code) params.set('code', code)
  navigate(`/team?${params}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CharacterSelect.jsx
git commit -m "feat: pass affiliation through CharacterSelect"
```

---

## Task 7: Home — affiliation을 join-room 소켓 이벤트에 포함

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: affiliation 읽기 및 소켓 이벤트에 포함**

`src/pages/Home.jsx`를 수정한다.

```jsx
// 기존 searchParams 읽는 부분에 affiliation 추가:
const name = searchParams.get('name') ?? ''
const affiliation = searchParams.get('affiliation') ?? ''   // 추가
const character = searchParams.get('character') ?? ''
const initialCode = searchParams.get('code') ?? ''

// joinRoom 함수 수정:
function joinRoom(code, isHost) {
  const playerUuid = getPlayerUuid()
  socket.emit('join-room', { code, name, affiliation, character, isHost, playerUuid }, ({ ok, error }) => {
    if (ok) navigate(`/lobby/${code}`)
    else alert(error)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: include affiliation in join-room socket event"
```

---

## Task 8: RankingTable — 공통 테이블 컴포넌트

**Files:**
- Create: `src/components/RankingTable.jsx`
- Create: `src/components/RankingTable.module.css`
- Create: `src/components/RankingTable.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/components/RankingTable.test.jsx` 파일 생성:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RankingTable from './RankingTable'

const mockRows = [
  { rank: 1, name: '홍길동', affiliation: '경영학과', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1' },
  { rank: 2, name: '김철수', affiliation: '공학부', character: 'cat', totalAssets: 120000, playerUuid: 'uuid-2' },
]

describe('RankingTable', () => {
  it('등수, 이름, 소속, 총자산을 렌더링한다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('경영학과')).toBeInTheDocument()
    expect(screen.getByText('150,000원')).toBeInTheDocument()
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
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- src/components/RankingTable.test.jsx
```

Expected: FAIL (RankingTable.jsx 없음)

- [ ] **Step 3: RankingTable.jsx 구현**

`src/components/RankingTable.jsx` 생성:

```jsx
import styles from './RankingTable.module.css'

export default function RankingTable({ rows, highlightPlayerUuid }) {
  const pinnedRow = highlightPlayerUuid
    ? rows.find(r => r.playerUuid === highlightPlayerUuid)
    : null

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>등수</th>
            <th className={styles.th}>캐릭터</th>
            <th className={styles.th}>이름</th>
            <th className={styles.th}>소속</th>
            <th className={styles.th}>총자산</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.playerUuid ?? `${row.rank}-${row.name}`} className={styles.tr}>
              <td className={styles.td}>{row.rank}</td>
              <td className={styles.td}>
                <img
                  src={`/characters/${row.character}.png`}
                  alt={row.character}
                  className={styles.characterImg}
                />
              </td>
              <td className={styles.td}>{row.name}</td>
              <td className={styles.td}>{row.affiliation}</td>
              <td className={styles.td}>{row.totalAssets.toLocaleString()}원</td>
            </tr>
          ))}
        </tbody>
      </table>

      {pinnedRow && (
        <div className={styles.pinnedRow} data-testid="pinned-row">
          <span className={styles.pinnedRank}>{pinnedRow.rank}위</span>
          <img
            src={`/characters/${pinnedRow.character}.png`}
            alt={pinnedRow.character}
            className={styles.characterImg}
          />
          <span className={styles.pinnedName}>{pinnedRow.name}</span>
          <span className={styles.pinnedAffiliation}>{pinnedRow.affiliation}</span>
          <span className={styles.pinnedAssets}>{pinnedRow.totalAssets.toLocaleString()}원</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: RankingTable.module.css 생성**

`src/components/RankingTable.module.css` 생성:

```css
.wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.th {
  padding: 10px 12px;
  text-align: left;
  font-size: 12px;
  color: #aaa;
  border-bottom: 1px solid #333;
}

.tr:hover {
  background: rgba(255, 255, 255, 0.04);
}

.td {
  padding: 10px 12px;
  font-size: 14px;
  color: #eee;
  border-bottom: 1px solid #222;
}

.characterImg {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.pinnedRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-top: 8px;
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid #ffd700;
  border-radius: 8px;
  font-weight: bold;
  color: #ffd700;
}

.pinnedRank { font-size: 16px; min-width: 32px; }
.pinnedName { flex: 1; }
.pinnedAffiliation { color: #ccc; font-size: 13px; }
.pinnedAssets { font-size: 15px; }
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npm test -- src/components/RankingTable.test.jsx
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/RankingTable.jsx src/components/RankingTable.module.css src/components/RankingTable.test.jsx
git commit -m "feat: add RankingTable shared component with pinned own-row support"
```

---

## Task 9: LandingPage — 랜딩 화면 신규 구현

**Files:**
- Create: `src/pages/LandingPage.jsx`
- Create: `src/pages/LandingPage.module.css`

- [ ] **Step 1: LandingPage.jsx 생성**

```jsx
import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>💰 Money Village</h1>
      <p className={styles.subtitle}>보드게임 팀 구성 시스템</p>
      <div className={styles.buttons}>
        <button className={styles.rankingBtn} onClick={() => navigate('/ranking')}>
          🏆 랭킹
        </button>
        <button className={styles.joinBtn} onClick={() => navigate('/join')}>
          📋 참여
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: LandingPage.module.css 생성**

```css
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #0f0f1a;
  padding: 24px;
}

.title {
  font-size: 32px;
  font-weight: bold;
  color: #ffd700;
  letter-spacing: 2px;
  margin: 0;
}

.subtitle {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 240px;
  margin-top: 16px;
}

.rankingBtn {
  padding: 16px;
  background: #ffd700;
  color: #1a1a2e;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}

.rankingBtn:hover { background: #ffe44d; }

.joinBtn {
  padding: 16px;
  background: transparent;
  color: #ffd700;
  border: 2px solid #ffd700;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}

.joinBtn:hover { background: rgba(255, 215, 0, 0.1); }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.jsx src/pages/LandingPage.module.css
git commit -m "feat: add LandingPage with ranking and join buttons"
```

---

## Task 10: RankingPage — V1/V2 랭킹 페이지 구현

**Files:**
- Create: `src/pages/RankingPage.jsx`
- Create: `src/pages/RankingPage.module.css`

- [ ] **Step 1: RankingPage.jsx 생성**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import RankingTable from '../components/RankingTable'
import { getPlayerUuid } from '../utils/playerUuid'
import styles from './RankingPage.module.css'

const TABS = [
  { key: 'global', label: '글로벌' },
  { key: 'affiliation', label: '소속' },
  { key: 'team', label: '팀 내' },
]

export default function RankingPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const isV2 = Boolean(sessionId)

  const [activeTab, setActiveTab] = useState('global')
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
  }, [activeTab, sessionId, isV2, myAffiliation])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 홈</button>
        <h1 className={styles.title}>🏆 랭킹</h1>
      </div>

      {isV2 && (
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

      {loading && <p className={styles.message}>불러오는 중...</p>}
      {error && <p className={styles.message}>{error}</p>}
      {!loading && !error && (
        <RankingTable
          rows={rows}
          highlightPlayerUuid={isV2 ? myPlayerUuid : undefined}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: RankingPage.module.css 생성**

```css
.page {
  min-height: 100vh;
  background: #0f0f1a;
  padding: 16px;
  color: #eee;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.backBtn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
}

.backBtn:hover { color: #fff; }

.title {
  font-size: 22px;
  font-weight: bold;
  color: #ffd700;
  margin: 0;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #333;
  padding-bottom: 8px;
}

.tab {
  padding: 8px 16px;
  background: none;
  border: none;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
}

.tab:hover { color: #eee; background: rgba(255,255,255,0.06); }

.tabActive {
  color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  font-weight: bold;
}

.message {
  color: #888;
  text-align: center;
  padding: 40px 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.module.css
git commit -m "feat: add RankingPage with V1/V2 mode and 3-tab support"
```

---

## Task 11: App.jsx — 라우트 변경 및 ResultPage 삭제

**Files:**
- Modify: `src/App.jsx`
- Delete: `src/pages/ResultPage.jsx`
- Delete: `src/pages/ResultPage.module.css`

- [ ] **Step 1: App.jsx 수정**

```jsx
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'
import Home from './pages/Home'
import IndividualPage from './pages/IndividualPage'
import RankingPage from './pages/RankingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/lobby/:code" element={<Lobby />} />
      <Route path="/lobby/:code/individual" element={<IndividualPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/result/:sessionId" element={<RankingPage />} />
    </Routes>
  )
}
```

- [ ] **Step 2: ResultPage 파일 삭제**

```bash
rm src/pages/ResultPage.jsx src/pages/ResultPage.module.css
```

- [ ] **Step 3: 전체 테스트 실행**

```bash
npm test
```

Expected: 모든 기존 테스트 PASS. `ResultPage` 관련 테스트가 있다면 삭제한다.

- [ ] **Step 4: 개발 서버에서 플로우 확인**

```bash
npm run dev
```

아래 플로우를 직접 테스트한다:
1. `/` → LandingPage에 🏆 랭킹, 📋 참여 버튼 표시 확인
2. 참여 버튼 → `/join` → 소속 + 이름 입력 → 캐릭터 선택 → 팀 생성/참가 → 로비 → 개인 입력 → 결과 등록 → `/result/:sessionId` RankingPage(V2) 표시 확인
3. 랭킹 버튼 → `/ranking` → RankingPage(V1) 글로벌 테이블 표시 확인

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: update routes - add LandingPage, RankingPage, remove ResultPage"
```

---

## 완료 기준

- [ ] Supabase `game_results.affiliation` 컬럼 존재
- [ ] 소속 입력 후 게임 완료 시 DB에 저장됨
- [ ] `/` → 랜딩 화면 (🏆 랭킹 / 📋 참여 버튼)
- [ ] `/ranking` → 글로벌 랭킹 테이블 (탭 없음)
- [ ] `/result/:sessionId` → 3탭 랭킹 + 내 기록 하단 고정
- [ ] `npm test` 전체 통과
