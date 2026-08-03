# Disconnect 재접속 유예 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 소켓 disconnect 시 플레이어를 즉시 방에서 제거하지 않고 10분간 자리를 유지해, 화면 잠김/백그라운드 전환으로 인한 일시적 연결 끊김이 "강제 퇴장"으로 이어지지 않게 한다.

**Architecture:** `server/rooms.js`의 `room.players`에 `connected` 플래그를 추가하고, disconnect 시 즉시 삭제 대신 `playerUuid` 키의 10분 타이머를 건다. 같은 `playerUuid`로 재접속하면 `addPlayer`가 upsert로 기존 자리(및 `gameState`)를 재사용한다. 클라이언트는 `socket.on('connect', ...)`에 재조인 로직을 걸어 재연결마다 자동으로 `join-room`을 다시 보낸다. 재접속 대기 중인 플레이어는 `connected: false`로 표시되어 참가자 목록과 관리자 화면에 "재접속 중" 뱃지로 노출된다.

**Tech Stack:** Node.js/Express/socket.io (서버), React + vitest/@testing-library/react (클라이언트), 인메모리 `Map` 기반 방 상태.

**Spec:** `docs/superpowers/specs/2026-08-03-disconnect-grace-period-design.md`

---

### Task 1: `server/rooms.js` — `addPlayer`에 playerUuid 기반 upsert 추가

**Files:**
- Modify: `server/rooms.js:50-65` (`addPlayer`)
- Test: `server/rooms.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/rooms.test.js`의 `describe('addPlayer', ...)` 블록 바로 뒤에 새 블록을 추가한다:

```js
describe('addPlayer 재접속 (playerUuid upsert)', () => {
  it('같은 playerUuid로 다시 addPlayer를 호출하면 새 항목을 추가하지 않고 socketId만 갱신한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(room.players).toHaveLength(1)
    expect(room.players[0].socketId).toBe('s1-new')
  })

  it('재접속 시 기존 gameState를 보존한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    updatePlayerStateByUuid(code, 'p1', { cash: 5000 })
    const room = addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(room.players[0].gameState.cash).toBe(5000)
  })

  it('playerUuid가 없으면 매번 새 항목으로 추가한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const room = addPlayer(code, { socketId: 's2', name: '영희', character: 'pasc', isHost: false })
    expect(room.players).toHaveLength(2)
  })

  it('신규 참가자에게는 MAX_PLAYERS 제한이 그대로 적용된다', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0, playerUuid: `uuid${i}` })
    }
    expect(() =>
      addPlayer(code, { socketId: 's5', name: 'p5', character: 'c5', isHost: false, playerUuid: 'uuid5' })
    ).toThrow('Room is full')
  })

  it('재접속(같은 playerUuid)은 MAX_PLAYERS 제한을 우회한다', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0, playerUuid: `uuid${i}` })
    }
    const room = addPlayer(code, { socketId: 's0-new', name: 'p0', character: 'c0', isHost: true, playerUuid: 'uuid0' })
    expect(room.players).toHaveLength(4)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: 새로 추가한 5개 테스트 중 upsert 관련 테스트(첫 3개)가 FAIL — 지금 `addPlayer`는 항상 새 항목을 push하므로 `players`가 2개가 되어 `toHaveLength(1)` 등이 깨진다. (MAX_PLAYERS 관련 2개는 이미 통과할 수 있음 — 다음 단계에서 전체 초록 확인)

- [ ] **Step 3: `addPlayer`에 upsert 로직 구현**

`server/rooms.js:50-65`을 다음으로 교체:

```js
export function addPlayer(code, { socketId, name, character, isHost, playerUuid, affiliation = '' }) {
  if (!socketId) throw new Error('player.socketId is required')
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')

  // Cancel any pending room deletion (reconnect within grace period)
  if (roomDeletionTimers.has(code)) {
    clearTimeout(roomDeletionTimers.get(code))
    roomDeletionTimers.delete(code)
  }

  const existing = playerUuid ? room.players.find(p => p.playerUuid === playerUuid) : null
  if (existing) {
    // 재접속: 기존 자리와 gameState를 재사용하고 socketId만 갱신한다
    existing.socketId = socketId
    existing.connected = true
    socketToRoom.set(socketId, code)
    cancelPlayerDisconnectTimer(code, playerUuid)
    return room
  }

  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')
  room.players.push({ socketId, name, character, isHost, playerUuid, affiliation, connected: true, gameState: defaultGameState() })
  socketToRoom.set(socketId, code)
  return room
}
```

이 시점에는 아직 `cancelPlayerDisconnectTimer`가 정의되어 있지 않다. `server/rooms.js` 맨 위, `const roomDeletionTimers = new Map()` 바로 다음 줄에 임시로 no-op을 추가해 둔다 (Task 2에서 실제 구현으로 교체):

```js
const roomDeletionTimers = new Map()
function cancelPlayerDisconnectTimer() {}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: upsert player by playerUuid on rejoin instead of duplicating"
```

---

### Task 2: `server/rooms.js` — disconnect 유예 타이머(`markDisconnected`) + 방 삭제 유예 10분으로 연장

**Files:**
- Modify: `server/rooms.js` (상단 상수/타이머 선언, `removePlayer`, 신규 `markDisconnected`, `clearRooms`)
- Test: `server/rooms.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/rooms.test.js` 상단 import에 `markDisconnected`를 추가:

```js
import {
  createRoom, getRoom, addPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByRecency
} from './rooms.js'
```

기존 `removePlayer` 테스트 중 "마지막 플레이어 제거 시 방을 삭제하고 null을 반환한다"를 30초 기준에서 10분 기준으로 갱신:

```js
  it('마지막 플레이어 제거 시 방을 삭제하고 null을 반환한다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const result = removePlayer('s1')
    expect(result).toBeNull()
    // 그레이스 피리어드(10분) 동안 방 유지
    expect(getRoom(code)).not.toBeNull()
    // 10분 경과 후 방 삭제
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(getRoom(code)).toBeNull()
    vi.useRealTimers()
  })
```

`describe('isCharacterTaken', ...)` 앞에 새 블록을 추가:

```js
describe('markDisconnected', () => {
  it('플레이어를 connected: false로 표시하고 방을 유지한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = markDisconnected('s1')
    expect(room.players).toHaveLength(1)
    expect(room.players[0].connected).toBe(false)
  })

  it('유예 시간(10분) 내 재접속하지 않으면 플레이어를 제거한다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(getRoom(code).players).toHaveLength(0)
    vi.useRealTimers()
  })

  it('유예 시간 내 재접속(addPlayer)하면 제거 타이머가 취소된다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    vi.advanceTimersByTime(5 * 60 * 1000)
    addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(getRoom(code).players).toHaveLength(1)
    expect(getRoom(code).players[0].connected).toBe(true)
    vi.useRealTimers()
  })

  it('알 수 없는 socketId는 null을 반환한다', () => {
    expect(markDisconnected('unknown')).toBeNull()
  })

  it('마지막 플레이어가 유예 만료로 제거되면 방도 10분 후 삭제된다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1) // 플레이어 제거, 방은 비지만 아직 삭제 전
    expect(getRoom(code)).not.toBeNull()
    vi.advanceTimersByTime(10 * 60 * 1000 + 1) // 방 삭제
    expect(getRoom(code)).toBeNull()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `markDisconnected is not a function`, 그리고 30초→10분으로 바꾼 `removePlayer` 테스트도 아직 30초 기준 상수를 쓰는 구현 때문에 원래는 통과하지만 의미상 지금 구현(30000ms)과 어긋나므로 그대로 두면 통과해버릴 수 있음 — Step 3 구현 전까지는 `advanceTimersByTime(30001)`이 아니라 `10*60*1000+1`을 줬으므로 방이 아직 삭제 안 된 채로 FAIL 하는 것이 정상.

- [ ] **Step 3: 구현**

`server/rooms.js` 상단, `const roomDeletionTimers = new Map()` 선언부를 다음으로 교체 (Task 1에서 추가했던 no-op `cancelPlayerDisconnectTimer`도 함께 교체됨):

```js
const roomDeletionTimers = new Map()
const playerDisconnectTimers = new Map()

const PLAYER_DISCONNECT_GRACE_MS = 10 * 60 * 1000
const ROOM_EMPTY_GRACE_MS = 10 * 60 * 1000

function playerTimerKey(code, playerUuid) {
  return `${code}:${playerUuid}`
}

function cancelPlayerDisconnectTimer(code, playerUuid) {
  const key = playerTimerKey(code, playerUuid)
  if (playerDisconnectTimers.has(key)) {
    clearTimeout(playerDisconnectTimers.get(key))
    playerDisconnectTimers.delete(key)
  }
}
```

`removePlayer` 내부의 `setTimeout(..., 30000)`을 `ROOM_EMPTY_GRACE_MS`로 교체 (전체 함수는 그대로 유지, 숫자와 주석만 변경):

```js
export function removePlayer(socketId) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) {
    socketToRoom.delete(socketId)
    return null
  }
  room.players = room.players.filter(p => p.socketId !== socketId)
  socketToRoom.delete(socketId)
  if (room.players.length === 0) {
    // Keep room alive for the grace period so a reconnecting player can rejoin
    const timer = setTimeout(() => {
      if (rooms.get(code)?.players.length === 0) rooms.delete(code)
      roomDeletionTimers.delete(code)
    }, ROOM_EMPTY_GRACE_MS)
    roomDeletionTimers.set(code, timer)
    return null
  }
  return room
}
```

`removePlayer` 함수 바로 뒤에 `markDisconnected`를 신규 추가:

```js
export function markDisconnected(socketId) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  const player = room.players.find(p => p.socketId === socketId)
  if (!player) return null

  player.connected = false
  const key = playerTimerKey(code, player.playerUuid)
  const timer = setTimeout(() => {
    playerDisconnectTimers.delete(key)
    removePlayer(socketId)
  }, PLAYER_DISCONNECT_GRACE_MS)
  playerDisconnectTimers.set(key, timer)
  return room
}
```

`clearRooms()`를 다음으로 교체:

```js
export function clearRooms() {
  for (const timer of roomDeletionTimers.values()) clearTimeout(timer)
  roomDeletionTimers.clear()
  for (const timer of playerDisconnectTimers.values()) clearTimeout(timer)
  playerDisconnectTimers.clear()
  rooms.clear()
  socketToRoom.clear()
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add 10-minute reconnect grace period before removing a disconnected player"
```

---

### Task 3: `server/index.js` — disconnect 핸들러를 `markDisconnected`로 교체

**Files:**
- Modify: `server/index.js:8` (import), `server/index.js:338-341` (disconnect 핸들러)

이 라우팅/소켓 배선 코드는 레포 컨벤션상 단위 테스트하지 않고 수동 확인한다 (`server/rooms.test.js`, `server/classes.test.js` 등도 HTTP/소켓 레이어는 다루지 않음 — 순수 로직만 테스트).

- [ ] **Step 1: import에 `markDisconnected` 추가**

`server/index.js:8`을 다음으로 교체:

```js
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPrices, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByRecency } from './rooms.js'
```

- [ ] **Step 2: disconnect 핸들러 교체**

`server/index.js:338-341`을 다음으로 교체:

```js
  socket.on('disconnect', () => {
    const room = markDisconnected(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })
```

- [ ] **Step 3: 서버 기존 테스트 스위트 전체 실행해 회귀 없는지 확인**

Run: `npx vitest run server`
Expected: PASS (전체) — Task 1/2에서 이미 검증한 `rooms.test.js` 포함, `admins.test.js`/`classes.test.js`/`db.test.js`/`adminAuth.test.js`는 이번 변경과 무관하므로 그대로 통과해야 함.

- [ ] **Step 4: 커밋**

```bash
git add server/index.js
git commit -m "feat: keep disconnected players in the room during the reconnect grace period"
```

---

### Task 4: `PlayerSlot.jsx` — "재접속 중" 뱃지

**Files:**
- Modify: `src/components/PlayerSlot.jsx`, `src/components/PlayerSlot.module.css`
- Test: `src/components/PlayerSlot.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/PlayerSlot.test.jsx`의 `describe('PlayerSlot', ...)` 블록 안, "입력완료 시..." 테스트 뒤에 추가:

```js
  it('connected가 false면 재접속 중 뱃지를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, connected: false }} />)
    expect(screen.getByText('재접속 중')).toBeInTheDocument()
  })

  it('connected가 true(기본)면 재접속 중 뱃지를 표시하지 않는다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, connected: true }} />)
    expect(screen.queryByText('재접속 중')).toBeNull()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/PlayerSlot.test.jsx`
Expected: 첫 번째 신규 테스트 FAIL (`재접속 중` 텍스트 없음)

- [ ] **Step 3: 구현**

`src/components/PlayerSlot.jsx`의 return 블록에서, `{onEdit && <span className={styles.editIcon} ...>}` 바로 뒤에 추가:

```jsx
      {player.connected === false && (
        <span className={styles.reconnectingBadge}>재접속 중</span>
      )}
```

`src/components/PlayerSlot.module.css` 맨 끝에 추가:

```css
.reconnectingBadge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: #fff3e0;
  color: #e65100;
  font-size: 10px;
  font-weight: 700;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/PlayerSlot.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/components/PlayerSlot.jsx src/components/PlayerSlot.module.css src/components/PlayerSlot.test.jsx
git commit -m "feat: show reconnecting badge on disconnected player slots"
```

---

### Task 5: `AdminPlayerCard.jsx` — "재접속 중" 뱃지

**Files:**
- Modify: `src/components/admin/AdminPlayerCard.jsx`, `src/components/admin/AdminPlayerCard.module.css`
- Test: `src/components/admin/AdminPlayerCard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/admin/AdminPlayerCard.test.jsx`의 `describe('AdminPlayerCard', ...)` 블록 안에 추가:

```js
  it('connected가 false면 재접속 중 뱃지를 표시한다', () => {
    const player = { ...PLAYER, connected: false }
    render(<AdminPlayerCard player={player} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('재접속 중')).toBeInTheDocument()
  })

  it('connected가 명시되지 않으면 재접속 중 뱃지를 표시하지 않는다', () => {
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.queryByText('재접속 중')).toBeNull()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/admin/AdminPlayerCard.test.jsx`
Expected: 첫 번째 신규 테스트 FAIL

- [ ] **Step 3: 구현**

`src/components/admin/AdminPlayerCard.jsx`의 `.identity` 블록을 다음으로 교체:

```jsx
        <div className={styles.identity}>
          <span className={styles.name}>{player.name}</span>
          {player.connected === false && (
            <span className={styles.reconnectingBadge}>재접속 중</span>
          )}
          <span className={styles.job}>{gameState.job ? JOB_LABELS[gameState.job] : '직업 미입력'}</span>
        </div>
```

`src/components/admin/AdminPlayerCard.module.css` 맨 끝에 추가:

```css
.reconnectingBadge {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: #fff3e0;
  color: #e65100;
  font-size: 10px;
  font-weight: 700;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/admin/AdminPlayerCard.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/AdminPlayerCard.jsx src/components/admin/AdminPlayerCard.module.css src/components/admin/AdminPlayerCard.test.jsx
git commit -m "feat: show reconnecting badge on admin spectate player cards"
```

---

### Task 6: `Lobby.jsx` — 재연결 시 자동 재조인

**Files:**
- Modify: `src/pages/Lobby.jsx:1` (import), `src/pages/Lobby.jsx:51` (ref 제거), `src/pages/Lobby.jsx:70-90` (재조인 effect)
- Test: `src/pages/Lobby.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/Lobby.test.jsx` 상단에 `io` import 추가:

```js
import { io } from 'socket.io-client'
```

(기존 `vi.mock('socket.io-client', ...)` 아래, `import { SocketProvider } from '../contexts/SocketContext'` 옆에 추가)

`describe('Lobby', ...)` 블록의 `afterEach`를 다음으로 교체 (sessionStorage 정리 추가):

```js
  afterEach(() => {
    mockRoomUpdatePlayers = DEFAULT_PLAYERS
    sessionStorage.clear()
  })
```

같은 블록 안에 새 테스트 추가:

```js
  it('소켓이 재연결되면 저장된 프로필로 join-room을 다시 보낸다', () => {
    renderLobby()
    const socket = io()
    const [, connectHandler] = socket.on.mock.calls.find(([ev]) => ev === 'connect')

    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'ABC123', name: '철수', character: 'Adventurer-강아지', affiliation: '', isHost: true,
    }))
    sessionStorage.setItem('player_uuid', 'p1')
    socket.emit.mockClear()

    connectHandler()

    expect(socket.emit).toHaveBeenCalledWith('join-room', {
      code: 'ABC123', name: '철수', affiliation: '', character: 'Adventurer-강아지', isHost: true, playerUuid: 'p1',
    })
  })

  it('저장된 프로필의 방 코드가 다르면 재연결 시 join-room을 보내지 않는다', () => {
    renderLobby()
    const socket = io()
    const [, connectHandler] = socket.on.mock.calls.find(([ev]) => ev === 'connect')

    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'OTHER1', name: '철수', character: 'Adventurer-강아지', affiliation: '', isHost: true,
    }))
    sessionStorage.setItem('player_uuid', 'p1')
    socket.emit.mockClear()

    connectHandler()

    expect(socket.emit).not.toHaveBeenCalledWith('join-room', expect.anything())
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/Lobby.test.jsx`
Expected: 첫 번째 신규 테스트 FAIL — `socket.on.mock.calls.find(([ev]) => ev === 'connect')`가 `undefined`를 반환해 구조분해 시 에러가 나거나, `connectHandler`가 없어 TypeError 발생 (지금 `Lobby.jsx`는 `'connect'` 이벤트를 구독하지 않음).

- [ ] **Step 3: 구현**

`src/pages/Lobby.jsx:1`의 import를 다음으로 교체 (`useRef` 제거):

```jsx
import { useState, useEffect } from 'react'
```

`src/pages/Lobby.jsx:51`의 `const rejoinAttempted = useRef(false)` 줄을 삭제한다.

`src/pages/Lobby.jsx:70-90`의 재조인 `useEffect`를 다음 두 개의 effect로 교체:

```jsx
  useEffect(() => {
    if (readOnly) return
    if (!socket || !roomFetched) return
    if (players.find(p => p.socketId === socket.id)) return

    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const playerUuid = sessionStorage.getItem('player_uuid')
    if (!stored || stored.code !== code) return

    socket.emit('join-room', {
      code,
      name: stored.name,
      affiliation: stored.affiliation,
      character: stored.character,
      isHost: stored.isHost ?? false,
      playerUuid,
    })
  }, [socket, roomFetched, players, code, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return

    function rejoin() {
      const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
      const playerUuid = sessionStorage.getItem('player_uuid')
      if (!stored || stored.code !== code) return

      socket.emit('join-room', {
        code,
        name: stored.name,
        affiliation: stored.affiliation,
        character: stored.character,
        isHost: stored.isHost ?? false,
        playerUuid,
      })
    }

    socket.on('connect', rejoin)
    return () => socket.off('connect', rejoin)
  }, [socket, code, readOnly])
```

첫 번째 effect는 최초 입장(마운트 시점, 소켓은 이미 연결돼 있지만 아직 이 방에 join하지 않은 경우)을 처리하고, 두 번째 effect는 이후의 모든 재연결(`connect` 이벤트)마다 저장된 프로필로 다시 join한다. 서버의 `addPlayer`가 `playerUuid` 기준 upsert이므로 이미 참가 중이어도 중복 emit이 안전하다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/Lobby.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.test.jsx
git commit -m "feat: rejoin the room automatically on socket reconnect"
```

---

### Task 7: `IndividualPage.jsx` — 재연결 시 참가자 정보 다시 동기화

**Files:**
- Modify: `src/pages/IndividualPage.jsx:41-78`
- Test: `src/pages/IndividualPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/IndividualPage.test.jsx` 상단에 `io` import 추가:

```js
import { io } from 'socket.io-client'
```

`describe('IndividualPage', ...)` 블록 안에 새 테스트 추가:

```js
  it('소켓이 재연결되면 참가자 정보를 다시 불러온다', async () => {
    renderPage()
    await screen.findByText('직업 선택')

    const socket = io()
    const [, connectHandler] = socket.on.mock.calls.find(([ev]) => ev === 'connect')

    fetch.mockClear()
    connectHandler()

    expect(fetch).toHaveBeenCalledWith('/api/rooms/AB1234')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: FAIL — `socket.on.mock.calls.find(([ev]) => ev === 'connect')`가 `undefined`라 구조분해 에러 (지금 `IndividualPage.jsx`는 `'connect'`를 구독하지 않고 마운트 시 1회만 조회함).

- [ ] **Step 3: 구현**

`src/pages/IndividualPage.jsx:41-78`의 `useEffect`를 다음으로 교체 (내부 로직을 `syncPlayer` 함수로 추출하고, 마운트 시 1회 호출 + `connect` 이벤트마다 재호출):

```jsx
  useEffect(() => {
    if (!socket) return

    function syncPlayer() {
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
          const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
          const playerUuid = sessionStorage.getItem('player_uuid')
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
    }

    syncPlayer()
    socket.on('connect', syncPlayer)
    return () => socket.off('connect', syncPlayer)
  }, [code, socket, navigate])
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.test.jsx
git commit -m "feat: re-sync individual page state on socket reconnect"
```

---

### Task 8: 전체 회귀 테스트

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npm test -- run`
Expected: PASS (전체) — 지금까지 만든 모든 신규/수정 테스트를 포함해 기존 스위트가 회귀 없이 통과해야 한다.

- [ ] **Step 2: 수동 확인 (선택, 여유가 있으면)**

`npm run dev`로 서버/클라이언트를 띄우고, 방을 만들어 참가한 뒤 브라우저 개발자 도구에서 소켓 연결을 강제로 끊었다가(예: Network 탭에서 오프라인 토글) 다시 연결해, 팀원 화면에 "재접속 중" 뱃지가 떴다가 재연결 시 사라지는지 확인한다.
