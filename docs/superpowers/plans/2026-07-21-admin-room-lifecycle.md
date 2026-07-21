# 관리자 모드 — 방 생명주기 상태 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진행중인 방(라이브 룸)에 `stale`/`abandoned`/`completed-but-unregistered` 상태를 도입하고, 관리자가 해당 방을 숨기거나 삭제할 수 있게 한다.

**Architecture:** `server/rooms.js`의 room 객체에 `updatedAt`/`hidden` 필드를 추가하고, `GET /api/admin/rooms` 응답 시점에 순수 함수 `computeLiveRoomStatus()`로 상태를 동적 계산한다. 관리자 대시보드는 계산된 상태를 배지로 표시하고, `AdminSpectateModal`에 숨김/삭제 버튼을 추가해 새 라우트(`PATCH .../visibility`, `DELETE ...`)를 호출한다.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, Express 5, socket.io.

**Spec:** `docs/superpowers/specs/2026-07-21-admin-room-lifecycle-design.md`
**Worktree/branch:** `.worktrees/admin-room-lifecycle` on `feat/2026-07-21-admin-room-lifecycle` (already created)

---

## File Structure Overview

**Modified files:**
- `server/rooms.js`, `server/rooms.test.js` — `updatedAt`/`hidden` 필드, `computeLiveRoomStatus`, `setRoomHidden`, `deleteRoomByCode` 추가
- `server/index.js` — `GET /api/admin/rooms`에 상태/숨김 반영, `PATCH /api/admin/rooms/:code/visibility`, `DELETE /api/admin/rooms/:code` 라우트 추가
- `src/index.css` — 상태 배지용 색상 변수 추가
- `src/constants/gameData.js`, `src/constants/gameData.test.js` — `ROOM_STATUS_LABELS` 추가
- `src/components/admin/AdminGridView.jsx`, `.module.css`, `.test.jsx` — 상태 배지 렌더링
- `src/components/admin/AdminTableView.jsx`, `.test.jsx` — "방 상태" 컬럼 추가
- `src/components/admin/AdminSpectateModal.jsx`, `.module.css`, `.test.jsx` — 폴링 조건 버그 수정, 숨김/삭제 버튼 추가
- `src/pages/AdminDashboard.jsx`, `.module.css`, `.test.jsx` — "숨김 항목 보기" 토글 추가

---

### Task 1: `server/rooms.js` — `createRoom`에 `updatedAt`/`hidden` 필드 추가

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

`server/rooms.test.js`의 `describe('createRoom', ...)` 블록 안에 테스트 추가:

```js
// server/rooms.test.js — describe('createRoom', ...) 블록 안에 추가
it('updatedAt을 createdAt과 동일하게, hidden을 false로 초기화한다', () => {
  const room = createRoom()
  expect(room.hidden).toBe(false)
  expect(room.updatedAt).toBeInstanceOf(Date)
  expect(room.updatedAt.getTime()).toBe(room.createdAt.getTime())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `expect(received).toBe(false)` / `room.hidden` is `undefined`

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `createRoom` 함수를 교체:

```js
export function createRoom() {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const now = new Date()
  const room = { code, createdAt: now, updatedAt: now, hidden: false, players: [], prices: defaultPrices() }
  rooms.set(code, room)
  return room
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all tests including the new one)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: initialize updatedAt/hidden fields on room creation"
```

---

### Task 2: `server/rooms.js` — `gameState` 변경 시 `updatedAt` 갱신

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

`server/rooms.test.js` 파일 끝에 추가:

```js
describe('updatedAt 갱신', () => {
  it('updatePlayerState 호출 시 room.updatedAt이 갱신된다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const before = getRoom(code).updatedAt
    vi.useFakeTimers()
    vi.setSystemTime(new Date(before.getTime() + 1000))
    updatePlayerState('s1', { cash: 1000 })
    vi.useRealTimers()
    expect(getRoom(code).updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })

  it('updatePlayerStateByUuid 호출 시 room.updatedAt이 갱신된다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const before = getRoom(code).updatedAt
    vi.useFakeTimers()
    vi.setSystemTime(new Date(before.getTime() + 1000))
    updatePlayerStateByUuid(code, 'p1', { cash: 1000 })
    vi.useRealTimers()
    expect(getRoom(code).updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })
})
```

`server/rooms.test.js` 상단 import에 `updatePlayerState`를 추가:

```js
// server/rooms.test.js — import 라인 수정
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState
} from './rooms.js'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — 두 새 테스트 모두 `updatedAt`이 갱신되지 않아 `toBeGreaterThan` 실패

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `updatePlayerState`와 `updatePlayerStateByUuid`를 수정:

```js
export function updatePlayerState(socketId, gameState) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  const player = room.players.find(p => p.socketId === socketId)
  if (!player) return null
  player.gameState = gameState
  room.updatedAt = new Date()
  return room
}
```

```js
export function updatePlayerStateByUuid(code, playerUuid, partialGameState) {
  const room = rooms.get(code)
  if (!room) return null
  const player = room.players.find(p => p.playerUuid === playerUuid)
  if (!player) return null
  player.gameState = { ...player.gameState, ...partialGameState }
  room.updatedAt = new Date()
  return room
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: bump room.updatedAt on gameState changes"
```

---

### Task 3: `server/rooms.js` — `computeLiveRoomStatus()`

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

`server/rooms.test.js` 파일 끝에 추가:

```js
describe('computeLiveRoomStatus', () => {
  function makeRoom({ updatedAt, isCompleted = false, noPlayers = false } = {}) {
    const { code } = createRoom()
    if (!noPlayers) {
      addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    }
    const room = getRoom(code)
    if (updatedAt) room.updatedAt = updatedAt
    if (isCompleted) room.players[0].gameState.isCompleted = true
    return room
  }

  const NOW = new Date('2026-01-01T00:00:00Z')

  it('29분 경과 시 live', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 29 * 60 * 1000) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('live')
  })

  it('정확히 30분 경과 시 stale', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 30 * 60 * 1000) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('stale')
  })

  it('1시간 59분 경과 시 stale', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - (119 * 60 * 1000)) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('stale')
  })

  it('정확히 2시간 경과 시 abandoned', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('abandoned')
  })

  it('전원 완료 시 방치 시간과 무관하게 completed-but-unregistered', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000), isCompleted: true })
    expect(computeLiveRoomStatus(room, NOW)).toBe('completed-but-unregistered')
  })

  it('플레이어가 없으면 completed-but-unregistered로 판정하지 않는다', () => {
    const room = makeRoom({ noPlayers: true, updatedAt: NOW })
    expect(computeLiveRoomStatus(room, NOW)).toBe('live')
  })
})
```

`server/rooms.test.js` 상단 import에 `computeLiveRoomStatus` 추가:

```js
// server/rooms.test.js — import 라인 수정
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus
} from './rooms.js'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `computeLiveRoomStatus is not a function`

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `updatePlayerStateByUuid` 함수 아래에 추가:

```js
const STALE_THRESHOLD_MS = 30 * 60 * 1000
const ABANDONED_THRESHOLD_MS = 2 * 60 * 60 * 1000

export function computeLiveRoomStatus(room, now = new Date()) {
  const allCompleted = room.players.length > 0 && room.players.every(p => p.gameState?.isCompleted)
  if (allCompleted) return 'completed-but-unregistered'

  const elapsedMs = now - new Date(room.updatedAt)
  if (elapsedMs < STALE_THRESHOLD_MS) return 'live'
  if (elapsedMs < ABANDONED_THRESHOLD_MS) return 'stale'
  return 'abandoned'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add computeLiveRoomStatus for stale/abandoned detection"
```

---

### Task 4: `server/rooms.js` — `setRoomHidden()`

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

`server/rooms.test.js` 파일 끝에 추가:

```js
describe('setRoomHidden', () => {
  it('방을 숨김 처리하고 방 객체를 반환한다', () => {
    const { code } = createRoom()
    const room = setRoomHidden(code, true)
    expect(room.hidden).toBe(true)
    expect(getRoom(code).hidden).toBe(true)
  })

  it('숨김을 해제할 수 있다', () => {
    const { code } = createRoom()
    setRoomHidden(code, true)
    const room = setRoomHidden(code, false)
    expect(room.hidden).toBe(false)
  })

  it('존재하지 않는 방 코드는 null을 반환한다', () => {
    expect(setRoomHidden('XXXXXX', true)).toBeNull()
  })
})
```

`server/rooms.test.js` 상단 import에 `setRoomHidden` 추가:

```js
// server/rooms.test.js — import 라인 수정
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus, setRoomHidden
} from './rooms.js'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `setRoomHidden is not a function`

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `computeLiveRoomStatus` 함수 아래에 추가:

```js
export function setRoomHidden(code, hidden) {
  const room = rooms.get(code)
  if (!room) return null
  room.hidden = hidden
  return room
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add setRoomHidden for admin room visibility control"
```

---

### Task 5: `server/rooms.js` — `deleteRoomByCode()`

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Write the failing test**

`server/rooms.test.js` 파일 끝에 추가:

```js
describe('deleteRoomByCode', () => {
  it('방을 삭제하고 true를 반환한다', () => {
    const { code } = createRoom()
    expect(deleteRoomByCode(code)).toBe(true)
    expect(getRoom(code)).toBeNull()
  })

  it('존재하지 않는 방 코드는 false를 반환한다', () => {
    expect(deleteRoomByCode('XXXXXX')).toBe(false)
  })
})
```

`server/rooms.test.js` 상단 import에 `deleteRoomByCode` 추가:

```js
// server/rooms.test.js — import 라인 수정
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  setRoomHidden, deleteRoomByCode
} from './rooms.js'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `deleteRoomByCode is not a function`

- [ ] **Step 3: Write the implementation**

`server/rooms.js`의 `setRoomHidden` 함수 아래에 추가:

```js
export function deleteRoomByCode(code) {
  return rooms.delete(code)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add deleteRoomByCode for admin room deletion"
```

---

### Task 6: `server/index.js` — `GET /api/admin/rooms`에 상태/숨김 반영

**Files:**
- Modify: `server/index.js`

기존 레포 컨벤션대로 HTTP 라우팅 자체는 단위 테스트하지 않는다(순수 로직은 Task 1~5에서 이미 검증). 이 태스크는 수동 확인으로 검증한다.

- [ ] **Step 1: import 목록 갱신**

```js
// server/index.js — 상단 import 수정
import { createRoom, getRoom, addPlayer, removePlayer, updatePlayerState, updateRoomPrices, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, setRoomHidden, deleteRoomByCode } from './rooms.js'
```

- [ ] **Step 2: `GET /api/admin/rooms` 핸들러 교체**

```js
// server/index.js — 기존 app.get('/api/admin/rooms', ...) 전체 교체
app.get('/api/admin/rooms', async (req, res) => {
  try {
    const includeHidden = req.query.includeHidden === 'true'
    const now = new Date()
    const liveRooms = listAllRooms()
      .filter(room => includeHidden || !room.hidden)
      .map(room => ({
        code: room.code,
        status: computeLiveRoomStatus(room, now),
        registered: false,
        hidden: room.hidden,
        updatedAt: room.updatedAt,
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
```

- [ ] **Step 3: 수동으로 서버를 띄워 확인**

Run: `npm run dev`

다른 터미널에서 방을 하나 만들고 상태를 확인:

```bash
curl -X POST http://localhost:3001/api/rooms
curl http://localhost:3001/api/admin/rooms
```

Expected: 응답 배열에 방금 만든 방이 `status: "live"`, `hidden: false`, `updatedAt`이 포함된 형태로 나타난다.

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: compute live room status and expose hidden/updatedAt in admin rooms API"
```

---

### Task 7: `server/index.js` — 숨김/삭제 라우트 연결

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: `GET /api/admin/rooms` 라우트 아래에 두 라우트 추가**

```js
// server/index.js — app.get('/api/admin/rooms', ...) 블록 다음에 추가
app.patch('/api/admin/rooms/:code/visibility', (req, res) => {
  const code = req.params.code.toUpperCase()
  const room = setRoomHidden(code, !!req.body.hidden)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({ code: room.code, hidden: room.hidden })
})

app.delete('/api/admin/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase()
  const deleted = deleteRoomByCode(code)
  if (!deleted) return res.status(404).json({ error: 'Room not found' })
  res.json({ ok: true })
})
```

- [ ] **Step 2: 수동으로 서버를 띄워 확인**

Run: `npm run dev`

```bash
curl -X POST http://localhost:3001/api/rooms
# 위 응답의 code를 사용
curl -X PATCH http://localhost:3001/api/admin/rooms/<CODE>/visibility \
  -H "Content-Type: application/json" -d '{"hidden": true}'
curl http://localhost:3001/api/admin/rooms
# 숨긴 방이 목록에서 빠지는지 확인
curl "http://localhost:3001/api/admin/rooms?includeHidden=true"
# includeHidden=true면 다시 나타나는지 확인
curl -X DELETE http://localhost:3001/api/admin/rooms/<CODE>
curl "http://localhost:3001/api/admin/rooms?includeHidden=true"
# 삭제한 방이 완전히 사라졌는지 확인
```

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: wire visibility PATCH and DELETE routes for admin rooms"
```

---

### Task 8: 상태 배지 색상 변수 추가

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: 색상 변수 추가**

`src/index.css`의 `--purple-ink` 변수 다음 줄에 추가:

```css
/* src/index.css — :root 블록 안, --purple-ink 다음 줄 */
--amber:       #f0a93a;
--red:         #e5484d;
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "chore: add amber/red color variables for status badges"
```

---

### Task 9: `ROOM_STATUS_LABELS` 상수 추가

**Files:**
- Modify: `src/constants/gameData.js`
- Modify: `src/constants/gameData.test.js`

- [ ] **Step 1: Write the failing test**

`src/constants/gameData.test.js`의 `import` 라인과 `describe` 블록 안에 추가:

```js
// src/constants/gameData.test.js — import 라인 수정
import {
  JOB_LABELS, JOB_ICONS, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES,
  STOCK_LABELS, STOCK_IMAGES, ROOM_STATUS_LABELS,
} from './gameData'
```

```js
// src/constants/gameData.test.js — describe('gameData constants', ...) 블록 안에 추가
it('방 상태 라벨은 stale/abandoned/completed-but-unregistered 키를 갖는다', () => {
  expect(Object.keys(ROOM_STATUS_LABELS)).toEqual(['stale', 'abandoned', 'completed-but-unregistered'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/constants/gameData.test.js`
Expected: FAIL — `ROOM_STATUS_LABELS` is undefined

- [ ] **Step 3: Write the implementation**

`src/constants/gameData.js` 파일 끝에 추가:

```js
export const ROOM_STATUS_LABELS = {
  stale: '정체',
  abandoned: '방치',
  'completed-but-unregistered': '등록 대기',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/constants/gameData.test.js`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/constants/gameData.js src/constants/gameData.test.js
git commit -m "feat: add ROOM_STATUS_LABELS constant"
```

---

### Task 10: `AdminGridView` — 상태 배지 렌더링

**Files:**
- Modify: `src/components/admin/AdminGridView.jsx`
- Modify: `src/components/admin/AdminGridView.module.css`
- Modify: `src/components/admin/AdminGridView.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminGridView.test.jsx` 파일 끝에 추가:

```js
// src/components/admin/AdminGridView.test.jsx — describe 블록 안, 파일 끝에 추가
it('stale 상태 방에는 정체 배지를 보여준다', () => {
  const staleRooms = [{
    code: 'AB1234', registered: false, status: 'stale',
    players: [{ character: 'Adventurer-강아지', name: '김민준' }],
  }]
  render(<AdminGridView rooms={staleRooms} onSpectate={vi.fn()} />)
  expect(screen.getByText('정체')).toBeInTheDocument()
})

it('abandoned 상태 방에는 방치 배지를 보여준다', () => {
  const abandonedRooms = [{
    code: 'AB1234', registered: false, status: 'abandoned',
    players: [{ character: 'Adventurer-강아지', name: '김민준' }],
  }]
  render(<AdminGridView rooms={abandonedRooms} onSpectate={vi.fn()} />)
  expect(screen.getByText('방치')).toBeInTheDocument()
})

it('completed-but-unregistered 상태 방에는 등록 대기 배지를 보여준다', () => {
  const unregisteredRooms = [{
    code: 'AB1234', registered: false, status: 'completed-but-unregistered',
    players: [{ character: 'Adventurer-강아지', name: '김민준' }],
  }]
  render(<AdminGridView rooms={unregisteredRooms} onSpectate={vi.fn()} />)
  expect(screen.getByText('등록 대기')).toBeInTheDocument()
})

it('live 상태 방에는 상태 배지를 보여주지 않는다', () => {
  const liveRooms = [{
    code: 'AB1234', registered: false, status: 'live',
    players: [{ character: 'Adventurer-강아지', name: '김민준' }],
  }]
  render(<AdminGridView rooms={liveRooms} onSpectate={vi.fn()} />)
  expect(screen.queryByText('정체')).not.toBeInTheDocument()
  expect(screen.queryByText('방치')).not.toBeInTheDocument()
  expect(screen.queryByText('등록 대기')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: FAIL — 새 4개 테스트에서 배지 텍스트를 찾지 못함

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/AdminGridView.jsx (전체 교체)
import { ROOM_STATUS_LABELS } from '../../constants/gameData'
import styles from './AdminGridView.module.css'

const STATUS_BADGE_CLASS = {
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

export default function AdminGridView({ rooms, onSpectate }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => {
        const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)
        const badgeClassKey = !room.registered ? STATUS_BADGE_CLASS[room.status] : undefined
        return (
          <button
            key={room.code}
            className={`${styles.card} ${room.registered ? styles.registered : ''}`}
            onClick={() => onSpectate(room)}
            type="button"
          >
            {room.registered && <span className={styles.badge}>등록 완료</span>}
            {badgeClassKey && (
              <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
                {ROOM_STATUS_LABELS[room.status]}
              </span>
            )}
            <div className={styles.slots}>
              {slots.map((player, i) => (
                <div key={i} className={styles.slot} data-testid="admin-player-slot">
                  {player ? (
                    <>
                      <img
                        src={`/characters/${player.character}.png`}
                        alt={player.name}
                        className={styles.slotImg}
                      />
                      <span className={styles.slotName}>{player.name}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.slotEmpty}>?</span>
                      <span className={styles.emptyName}>대기중</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

`src/components/admin/AdminGridView.module.css`의 `.badge` 규칙 다음에 추가:

```css
/* src/components/admin/AdminGridView.module.css — .badge 규칙 다음에 추가 */
.badgeStale { background: var(--amber); }

.badgeAbandoned { background: var(--red); }

.badgeUnregistered { background: var(--violet); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminGridView.jsx src/components/admin/AdminGridView.module.css src/components/admin/AdminGridView.test.jsx
git commit -m "feat: render room lifecycle status badges in AdminGridView"
```

---

### Task 11: `AdminTableView` — "방 상태" 컬럼 추가

**Files:**
- Modify: `src/components/admin/AdminTableView.jsx`
- Modify: `src/components/admin/AdminTableView.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminTableView.test.jsx` 파일 끝에 추가:

```js
// src/components/admin/AdminTableView.test.jsx — describe 블록 안, 파일 끝에 추가
it('방 상태 컬럼에 정체/등록 완료를 표시한다', () => {
  const mixedRooms = [
    {
      code: 'A1', registered: false, status: 'stale', prices,
      players: [{ playerUuid: 'x1', name: '가나다', affiliation: '', gameState: blankGameState }],
    },
    {
      code: 'A2', registered: true, prices,
      players: [{ playerUuid: 'x2', name: '라마바', affiliation: '', gameState: blankGameState }],
    },
  ]
  render(<AdminTableView rooms={mixedRooms} />)
  expect(screen.getByText('방 상태')).toBeInTheDocument()
  expect(screen.getByText('정체')).toBeInTheDocument()
  expect(screen.getByText('등록 완료')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminTableView.test.jsx`
Expected: FAIL — "방 상태" 헤더/값을 찾지 못함

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/AdminTableView.jsx (전체 교체)
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import { JOB_LABELS, ROOM_STATUS_LABELS } from '../../constants/gameData'
import styles from './AdminTableView.module.css'

function hasAnyInput(gameState) {
  if (!gameState) return false
  if (gameState.job) return true
  if (gameState.cash != null) return true
  if (Object.values(gameState.stocks ?? {}).some(count => count > 0)) return true
  if (Object.values(gameState.realEstate ?? {}).some(count => count > 0)) return true
  if ((gameState.badges ?? []).some(Boolean)) return true
  return false
}

function getInputStatus(gameState) {
  if (gameState?.isCompleted) return '✅ 입력완료'
  if (hasAnyInput(gameState)) return '🟡 입력중'
  return '❌ 미입력'
}

function roomStatusLabel(room) {
  if (room.registered) return '등록 완료'
  return ROOM_STATUS_LABELS[room.status] ?? '-'
}

function formatWon(value) {
  return value != null ? `${value.toLocaleString()}원` : '-'
}

function flattenRows(rooms) {
  return rooms.flatMap(room =>
    room.players.map(player => {
      const isCompleted = Boolean(player.gameState?.isCompleted)
      const breakdown = isCompleted
        ? calculateAssetBreakdown(player.gameState, room.prices)
        : null
      return {
        key: `${room.code}-${player.playerUuid}`,
        name: player.name,
        affiliation: player.affiliation,
        job: isCompleted ? JOB_LABELS[player.gameState.job] : null,
        cash: breakdown?.cash ?? null,
        realEstateValue: breakdown?.realEstateValue ?? null,
        stockValue: breakdown?.stockValue ?? null,
        totalAssets: breakdown?.totalAssets ?? null,
        status: getInputStatus(player.gameState),
        roomStatus: roomStatusLabel(room),
      }
    })
  )
}

export default function AdminTableView({ rooms }) {
  const rows = flattenRows(rooms)
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>이름</th>
            <th className={styles.th}>소속</th>
            <th className={styles.th}>직업</th>
            <th className={styles.th}>현금</th>
            <th className={styles.th}>부동산총액</th>
            <th className={styles.th}>주식총액</th>
            <th className={styles.th}>총자산</th>
            <th className={styles.th}>상태</th>
            <th className={styles.th}>방 상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className={styles.tr}>
              <td className={styles.td}>{row.name}</td>
              <td className={styles.td}>{row.affiliation}</td>
              <td className={styles.td}>{row.job ?? '-'}</td>
              <td className={styles.td}>{formatWon(row.cash)}</td>
              <td className={styles.td}>{formatWon(row.realEstateValue)}</td>
              <td className={styles.td}>{formatWon(row.stockValue)}</td>
              <td className={styles.td}>{formatWon(row.totalAssets)}</td>
              <td className={`${styles.td} ${styles.status}`}>{row.status}</td>
              <td className={styles.td}>{row.roomStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminTableView.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminTableView.jsx src/components/admin/AdminTableView.test.jsx
git commit -m "feat: add room status column to AdminTableView"
```

---

### Task 12: `AdminSpectateModal` — 폴링 조건 버그 수정

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`
- Modify: `src/components/admin/AdminSpectateModal.test.jsx`

현재 폴링 조건은 `room.status !== 'live'`일 때 폴링을 멈추는데, Task 6 이후 라이브 룸의 `status`는 `stale`/`abandoned`/`completed-but-unregistered`일 수도 있다. 이 방들도 여전히 메모리 룸(미등록)이므로 계속 폴링해야 한다. 폴링을 멈춰야 하는 조건은 `room.registered === true`(Supabase 등록 완료, 더 이상 바뀌지 않음)일 때뿐이다.

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminSpectateModal.test.jsx` 파일 끝에 추가:

```js
// src/components/admin/AdminSpectateModal.test.jsx — 파일 끝에 추가
it('stale 상태(미등록 라이브 룸)에서도 계속 폴링한다', async () => {
  vi.useFakeTimers()
  const staleRoom = { ...makeRoom('AB1234', '김민준'), status: 'stale' }
  const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  global.fetch = fetchMock

  render(<AdminSpectateModal rooms={[staleRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  fetchMock.mockClear()
  await vi.advanceTimersByTimeAsync(3000)

  expect(fetchMock).toHaveBeenCalledWith('/api/rooms/AB1234')
  vi.useRealTimers()
})

it('등록 완료된 방은 폴링하지 않는다', async () => {
  vi.useFakeTimers()
  const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
  const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  global.fetch = fetchMock

  render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  fetchMock.mockClear()
  await vi.advanceTimersByTimeAsync(3000)

  expect(fetchMock).not.toHaveBeenCalled()
  vi.useRealTimers()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: FAIL — "stale 상태에서도 계속 폴링한다" 테스트가 실패(현재 조건은 `status !== 'live'`이면 폴링을 멈춤)

- [ ] **Step 3: Write the implementation**

`src/components/admin/AdminSpectateModal.jsx`의 폴링 `useEffect`를 수정:

```jsx
// src/components/admin/AdminSpectateModal.jsx — 기존 useEffect 교체
useEffect(() => {
  if (room.registered) return undefined
  pollTimer.current = setInterval(() => {
    fetch(`/api/rooms/${room.code}`)
      .then(r => r.json())
      .then(data => {
        data.players?.forEach(player => onPlayerUpdate(room.code, player))
      })
      .catch(() => {})
  }, POLL_INTERVAL_MS)
  return () => clearInterval(pollTimer.current)
}, [room.code, room.registered, onPlayerUpdate])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.test.jsx
git commit -m "fix: keep polling stale/abandoned live rooms in AdminSpectateModal"
```

---

### Task 13: `AdminSpectateModal` — 숨김/삭제 버튼

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`
- Modify: `src/components/admin/AdminSpectateModal.module.css`
- Modify: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminSpectateModal.test.jsx` 파일 끝에 추가:

```js
// src/components/admin/AdminSpectateModal.test.jsx — 파일 끝에 추가
it('라이브 룸(미등록)에는 숨김/삭제 버튼을 보여준다', () => {
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.getByText('숨김')).toBeInTheDocument()
  expect(screen.getByText('삭제')).toBeInTheDocument()
})

it('등록 완료된 팀에는 숨김/삭제 버튼을 보여주지 않는다', () => {
  const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
  render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.queryByText('숨김')).not.toBeInTheDocument()
  expect(screen.queryByText('삭제')).not.toBeInTheDocument()
})

it('숨김 버튼 클릭 시 visibility PATCH 요청 후 onRoomChanged와 onClose를 호출한다', async () => {
  const onClose = vi.fn()
  const onRoomChanged = vi.fn()
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'AB1234', hidden: true }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })

  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={onClose} onRoomChanged={onRoomChanged} />)
  await userEvent.click(screen.getByText('숨김'))

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/rooms/AB1234/visibility',
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: true }),
    })
  )
  expect(onRoomChanged).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

it('삭제 버튼 클릭 시 확인 팝업을 보여주고, 확인 시 DELETE 요청 후 onRoomChanged와 onClose를 호출한다', async () => {
  const onClose = vi.fn()
  const onRoomChanged = vi.fn()
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })

  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={onClose} onRoomChanged={onRoomChanged} />)
  await userEvent.click(screen.getByText('삭제'))
  expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument()

  await userEvent.click(screen.getByText('정말 삭제'))

  expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms/AB1234', expect.objectContaining({ method: 'DELETE' }))
  expect(onRoomChanged).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

it('삭제 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  await userEvent.click(screen.getByText('삭제'))
  await userEvent.click(screen.getByText('취소'))
  expect(screen.queryByText(/되돌릴 수 없습니다/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: FAIL — 숨김/삭제 버튼을 찾지 못함

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/admin/AdminSpectateModal.jsx (전체 교체)
import { useState, useEffect, useRef } from 'react'
import AdminPlayerCard from './AdminPlayerCard'
import AdminEditModal from './AdminEditModal'
import styles from './AdminSpectateModal.module.css'

const POLL_INTERVAL_MS = 3000

export default function AdminSpectateModal({ rooms, initialIndex, onPlayerUpdate, onClose, onRoomChanged }) {
  const [index, setIndex] = useState(initialIndex)
  const [editingPlayerUuid, setEditingPlayerUuid] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const room = rooms[index]
  const pollTimer = useRef(null)

  useEffect(() => {
    if (room.registered) return undefined
    pollTimer.current = setInterval(() => {
      fetch(`/api/rooms/${room.code}`)
        .then(r => r.json())
        .then(data => {
          data.players?.forEach(player => onPlayerUpdate(room.code, player))
        })
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(pollTimer.current)
  }, [room.code, room.registered, onPlayerUpdate])

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

  async function handleToggleHidden() {
    const res = await fetch(`/api/admin/rooms/${room.code}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: !room.hidden }),
    })
    if (!res.ok) return
    onRoomChanged()
    onClose()
  }

  async function handleDelete() {
    const res = await fetch(`/api/admin/rooms/${room.code}`, { method: 'DELETE' })
    setConfirmDelete(false)
    if (!res.ok) return
    onRoomChanged()
    onClose()
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

  return (
    <div className={styles.page}>
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

      {!room.registered && (
        <div className={styles.dangerZone}>
          <button type="button" className={styles.hideBtn} onClick={handleToggleHidden}>
            {room.hidden ? '숨김 해제' : '숨김'}
          </button>
          <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
        </div>
      )}

      <div className={styles.grid}>
        {room.players.map((player, i) => (
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

      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDelete(false)}>
          <div className={styles.confirmPopup} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmText}>이 방을 삭제하면 되돌릴 수 없습니다.<br />삭제하시겠습니까?</p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmDelete(false)}>취소</button>
              <button type="button" className={styles.confirmDeleteBtn} onClick={handleDelete}>정말 삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

`src/components/admin/AdminSpectateModal.module.css` 파일 끝에 추가:

```css
/* src/components/admin/AdminSpectateModal.module.css — 파일 끝에 추가 */
.dangerZone { display: flex; justify-content: center; gap: 8px; }

.hideBtn,
.deleteBtn {
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--r-pill);
  padding: 6px 14px;
  background: var(--slot-empty);
  color: var(--ink-2);
}

.deleteBtn { color: var(--red); }

.confirmOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
}

.confirmPopup {
  background: var(--white);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  padding: 24px;
  width: min(320px, 88vw);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirmText { font-size: 14px; font-weight: 700; color: var(--ink); text-align: center; line-height: 1.5; }

.confirmActions { display: flex; gap: 8px; }

.confirmCancelBtn,
.confirmDeleteBtn {
  flex: 1;
  height: 44px;
  border-radius: var(--r-sm);
  font-size: 14px;
  font-weight: 700;
}

.confirmCancelBtn { background: var(--slot-empty); color: var(--ink-2); }

.confirmDeleteBtn { background: var(--red); color: var(--white); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "feat: add hide/delete controls to AdminSpectateModal"
```

---

### Task 14: `AdminDashboard` — "숨김 항목 보기" 토글

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`
- Modify: `src/pages/AdminDashboard.module.css`
- Modify: `src/pages/AdminDashboard.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/pages/AdminDashboard.test.jsx` 파일 끝에 추가:

```js
// src/pages/AdminDashboard.test.jsx — describe 블록 안, 파일 끝에 추가
it('숨김 항목 보기 토글 클릭 시 includeHidden=true로 다시 조회한다', async () => {
  renderDashboard()
  await screen.findByText('홍길동')
  global.fetch.mockClear()
  await userEvent.click(screen.getByLabelText('숨김 항목 보기'))
  expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms?includeHidden=true')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/AdminDashboard.test.jsx`
Expected: FAIL — "숨김 항목 보기" 라벨을 가진 요소를 찾지 못함

- [ ] **Step 3: Write the implementation**

```jsx
// src/pages/AdminDashboard.jsx (전체 교체)
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
  const [showHidden, setShowHidden] = useState(false)

  const loadRooms = useCallback(() => {
    const query = showHidden ? '?includeHidden=true' : ''
    fetch(`/api/admin/rooms${query}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [showHidden])

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
          <label className={styles.hiddenToggle}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
            />
            숨김 항목 보기
          </label>
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
              onRoomChanged={loadRooms}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

`src/pages/AdminDashboard.module.css`의 `.headerActions` 규칙 다음에 추가:

```css
/* src/pages/AdminDashboard.module.css — .headerActions 규칙 다음에 추가 */
.hiddenToggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/AdminDashboard.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminDashboard.jsx src/pages/AdminDashboard.module.css src/pages/AdminDashboard.test.jsx
git commit -m "feat: add hidden-rooms toggle and wire hide/delete refresh to AdminDashboard"
```

---

### Task 15: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run --exclude '**/.worktrees/**' --exclude '**/node_modules/**'`
Expected: PASS (전체) — 다른 워크트리를 스캔하지 않도록 exclude 플래그를 반드시 사용한다 (레포에 `.worktrees/` 하위 다른 작업 브랜치들이 있어 vitest 기본 설정으로는 그것들까지 스캔됨).

- [ ] **Step 2: 관리자 대시보드 수동 확인**

Run: `npm run dev`

브라우저에서 `/admin` 접속 후:
1. 방을 하나 만들고 플레이어 없이 30분+ 방치했다고 가정할 수 없으므로, `server/rooms.js`의 `computeLiveRoomStatus`가 이미 테스트로 검증됐음을 신뢰하고 UI만 확인한다.
2. 그리드 뷰 카드에 배지가 없는 상태(신규 방)를 확인.
3. "숨김 항목 보기" 체크박스를 켜고 꺼서 새로고침이 정상 동작하는지 확인.
4. 카드를 클릭해 관전 팝업을 열고, 하단 "숨김" 버튼을 눌러 팝업이 닫히고 목록이 갱신되는지 확인.
5. "숨김 항목 보기"를 켜면 방금 숨긴 방이 "숨김" 상태로 다시 나타나는지 확인.
6. 같은 방을 다시 열어 "삭제" 클릭 → 확인 팝업 → "정말 삭제" 클릭 시 목록에서 완전히 사라지는지 확인.

- [ ] **Step 3: Commit (필요 시)**

검증 단계에서 코드 변경이 없었다면 커밋할 것이 없다. 수동 확인 중 문제를 발견해 수정했다면 해당 변경을 커밋한다.

---
