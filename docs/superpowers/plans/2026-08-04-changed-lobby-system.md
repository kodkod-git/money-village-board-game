# 로비 시스템 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미배정 수업 진입 경로를 없애고, 캐릭터 선택 후 "팀 만들기/참여 선택" 화면 대신 해당 수업의 팀 목록을 카드 그리드로 보여주는 새 로비 화면을 도입하며, 기존에 "로비"라 불리던 팀원 현황 화면을 "팀 화면"으로 이름을 정리한다.

**Architecture:** 서버(`server/rooms.js`, `server/index.js`)에 수업별 공개 팀 목록 조회 API와 소켓 기반 실시간 브로드캐스트를 추가한다. 프론트엔드는 기존 `src/pages/Lobby.jsx`(팀원 현황 화면)를 `src/pages/Team.jsx`로 이름을 바꾸고, `src/pages/Home.jsx`(팀 만들기/참여 선택)를 삭제한 뒤 그 역할을 흡수하는 새 `src/pages/Lobby.jsx`(팀 목록 그리드)를 만든다.

**Tech Stack:** React 18 + react-router-dom 7, Express 5 + socket.io 4, Vitest + Testing Library.

**참고 문서:** `docs/superpowers/specs/2026-08-04-changed-lobby-system-design.md`, `proposal/20260804_changed_lobby_system.md`

---

## Task 1: 서버 — 수업별 공개 팀 목록 헬퍼 (`server/rooms.js`)

**Files:**
- Modify: `server/rooms.js`
- Test: `server/rooms.test.js`

- [ ] **Step 1: 실패하는 테스트 작성 — `listPublicRoomsByClassId`**

`server/rooms.test.js` 맨 아래(`describe('deleteRoomsByClassId', ...)` 블록 뒤)에 추가:

```js
describe('listPublicRoomsByClassId', () => {
  it('해당 classId의 방만 반환하며 민감 정보는 제외한다', () => {
    const room = createRoom({ classId: 'class-1' })
    addPlayer(room.code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, affiliation: '경영학과' })
    createRoom({ classId: 'class-2' })

    const result = listPublicRoomsByClassId('class-1')

    expect(result).toEqual([
      { code: room.code, status: 'live', playerCount: 1, characters: ['ptsc'] },
    ])
  })

  it("classId가 'unassigned'면 classId가 null인 방을 반환한다", () => {
    const room = createRoom()
    const result = listPublicRoomsByClassId('unassigned')
    expect(result.map(r => r.code)).toEqual([room.code])
  })

  it('일치하는 방이 없으면 빈 배열을 반환한다', () => {
    expect(listPublicRoomsByClassId('no-such-class')).toEqual([])
  })

  it('최근 갱신순으로 정렬한다', () => {
    const older = createRoom({ classId: 'class-1' })
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)
    const newer = createRoom({ classId: 'class-1' })
    vi.useRealTimers()
    const result = listPublicRoomsByClassId('class-1')
    expect(result.map(r => r.code)).toEqual([newer.code, older.code])
  })
})
```

Import 목록(파일 상단)에 `listPublicRoomsByClassId`를 추가:

```js
import {
  createRoom, getRoom, addPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByRecency,
  listPublicRoomsByClassId
} from './rooms.js'
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- server/rooms.test.js`
Expected: FAIL — `listPublicRoomsByClassId is not a function` (또는 `undefined` 관련 에러)

- [ ] **Step 3: 최소 구현 작성**

`server/rooms.js`의 `sortRoomsByRecency` 함수 바로 뒤에 추가:

```js
export function listPublicRoomsByClassId(classId) {
  const now = new Date()
  const matches = room => (classId === 'unassigned' ? !room.classId : room.classId === classId)
  return sortRoomsByRecency(listAllRooms().filter(matches)).map(room => ({
    code: room.code,
    status: computeLiveRoomStatus(room, now),
    playerCount: room.players.length,
    characters: room.players.map(p => p.character),
  }))
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- server/rooms.test.js`
Expected: PASS (전체 스위트)

- [ ] **Step 5: 실패하는 테스트 작성 — `getRoomBySocketId`**

`server/rooms.test.js`의 `describe('listPublicRoomsByClassId', ...)` 블록 뒤에 추가:

```js
describe('getRoomBySocketId', () => {
  it('socketId로 소속된 방을 반환한다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(getRoomBySocketId('s1').code).toBe(code)
  })

  it('알 수 없는 socketId는 null을 반환한다', () => {
    expect(getRoomBySocketId('unknown')).toBeNull()
  })
})
```

import 목록에 `getRoomBySocketId` 추가(Step 1의 import 블록에 이어서).

- [ ] **Step 6: 테스트 실행해 실패 확인**

Run: `npm test -- server/rooms.test.js`
Expected: FAIL — `getRoomBySocketId is not a function`

- [ ] **Step 7: 최소 구현 작성**

`server/rooms.js`의 `removePlayer` 함수 바로 앞에 추가:

```js
export function getRoomBySocketId(socketId) {
  const code = socketToRoom.get(socketId)
  return code ? rooms.get(code) ?? null : null
}
```

- [ ] **Step 8: 테스트 실행해 통과 확인**

Run: `npm test -- server/rooms.test.js`
Expected: PASS (전체 스위트)

- [ ] **Step 9: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat(server): add classId-scoped public room listing and socket lookup helper"
```

---

## Task 2: 서버 — 공개 API + 실시간 브로드캐스트 (`server/index.js`)

**Files:**
- Modify: `server/index.js`

이 파일은 기존에도 HTTP 통합 테스트가 없는 파일이다(`server/rooms.js`, `server/classes.js` 등 로직 모듈만 단위 테스트됨). 이 태스크는 Task 1에서 이미 테스트된 헬퍼를 배선하는 작업이므로, 자동 테스트 대신 Step 6의 수동 검증으로 확인한다.

- [ ] **Step 1: import에 신규 헬퍼 추가**

`server/index.js` 8번째 줄을 다음으로 교체:

```js
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPrices, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByRecency, listPublicRoomsByClassId, getRoomBySocketId } from './rooms.js'
```

- [ ] **Step 2: `broadcastClassRooms` 헬퍼와 신규 공개 엔드포인트 추가**

`app.post('/api/rooms', ...)` 핸들러 바로 위에 추가:

```js
function broadcastClassRooms(classId) {
  io.to(`class:${classId ?? 'unassigned'}`).emit('class-rooms-updated')
}
```

`app.post('/api/rooms', ...)` 핸들러를 다음으로 교체(broadcast 호출 추가):

```js
app.post('/api/rooms', (req, res) => {
  const room = createRoom({ classId: req.body?.classId ?? null })
  broadcastClassRooms(room.classId)
  res.json({ code: room.code })
})

app.get('/api/rooms', (req, res) => {
  const { classId } = req.query
  if (!classId) return res.status(400).json({ error: 'classId 쿼리 파라미터가 필요합니다' })
  res.json(listPublicRoomsByClassId(classId))
})
```

- [ ] **Step 3: `join-room`, `kick-player`, `leave-room` 소켓 핸들러에 브로드캐스트 연결**

`io.on('connection', ...)` 블록 내 `join-room` 핸들러를 다음으로 교체:

```js
  socket.on('join-room', ({ code, name, character, isHost, playerUuid, affiliation }, callback) => {
    try {
      const room = addPlayer(code.toUpperCase(), {
        socketId: socket.id, name, character, isHost: !!isHost, playerUuid, affiliation,
      })
      socket.join(code.toUpperCase())
      io.to(code.toUpperCase()).emit('room-updated', { players: room.players })
      broadcastClassRooms(room.classId)
      callback?.({ ok: true })
    } catch (err) {
      callback?.({ ok: false, error: err.message })
    }
  })
```

`kick-player` 핸들러를 다음으로 교체:

```js
  socket.on('kick-player', ({ targetSocketId: tid }) => {
    const result = kickPlayer(socket.id, tid)
    if (!result) return
    const { room, targetSocketId } = result
    io.to(targetSocketId).emit('you-were-kicked')
    io.to(room.code).emit('room-updated', { players: room.players })
    broadcastClassRooms(room.classId)
  })
```

`leave-room` 핸들러를 다음으로 교체:

```js
  socket.on('leave-room', () => {
    const roomBefore = getRoomBySocketId(socket.id)
    const room = removePlayer(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
    if (roomBefore) broadcastClassRooms(roomBefore.classId)
  })
```

- [ ] **Step 4: `watch-class-rooms` / `unwatch-class-rooms` 핸들러 추가**

`kick-player` 핸들러와 `leave-room` 핸들러 사이(또는 `leave-room` 바로 뒤)에 추가:

```js
  socket.on('watch-class-rooms', ({ classId }) => {
    if (classId) socket.join(`class:${classId}`)
  })

  socket.on('unwatch-class-rooms', ({ classId }) => {
    if (classId) socket.leave(`class:${classId}`)
  })
```

- [ ] **Step 5: 서버 단위 테스트 전체 통과 확인 (회귀 없음 확인)**

Run: `npm test -- server`
Expected: PASS (기존 rooms/classes/db/adminAuth/admins 테스트 전부 통과 — `server/index.js`는 애초에 테스트 대상이 아니므로 이 스위트에 신규 실패가 없어야 함)

- [ ] **Step 6: 수동 검증**

`npm run dev` 실행 후 다음을 curl로 확인:

```bash
curl -X POST http://localhost:3001/api/rooms -H "Content-Type: application/json" -d '{"classId":"smoke-test"}'
# => {"code":"XXXXXX"} 형태 응답 확인

curl "http://localhost:3001/api/rooms?classId=smoke-test"
# => [{"code":"XXXXXX","status":"live","playerCount":0,"characters":[]}] 확인

curl "http://localhost:3001/api/rooms"
# => 400 {"error":"classId 쿼리 파라미터가 필요합니다"} 확인
```

확인 후 `npm run dev`를 중단한다.

- [ ] **Step 7: 커밋**

```bash
git add server/index.js
git commit -m "feat(server): expose public per-class room listing and realtime class-rooms-updated broadcast"
```

---

## Task 3: `Lobby.jsx`(팀원 현황 화면)를 `Team.jsx`로 이름 변경

**Files:**
- Rename: `src/pages/Lobby.jsx` → `src/pages/Team.jsx`
- Rename: `src/pages/Lobby.module.css` → `src/pages/Team.module.css`
- Rename: `src/pages/Lobby.test.jsx` → `src/pages/Team.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 파일 이름 변경(내용 변경 없이 이동)**

```bash
git mv src/pages/Lobby.jsx src/pages/Team.jsx
git mv src/pages/Lobby.module.css src/pages/Team.module.css
git mv src/pages/Lobby.test.jsx src/pages/Team.test.jsx
```

- [ ] **Step 2: `Team.jsx` 내부 참조 갱신**

`src/pages/Team.jsx`에서:
- CSS import: `import styles from './Lobby.module.css'` → `import styles from './Team.module.css'`
- export 함수명: `export default function Lobby(...)` → `export default function Team(...)`

- [ ] **Step 3: `Team.test.jsx` 내부 참조 갱신**

`src/pages/Team.test.jsx`에서:
- `import Lobby from './Lobby'` → `import Team from './Team'`
- `<Route path="/lobby/:code" element={<Lobby />} />` → `<Route path="/team/:code" element={<Team />} />`
- `initialEntries={['/lobby/ABC123']}` → `initialEntries={['/team/ABC123']}`
- `<Lobby readOnly mockRoom={mockRoom} />` (readOnly 모드 describe 블록) → `<Team readOnly mockRoom={mockRoom} />`

파일 내 `Lobby`라는 식별자가 남아있지 않은지 확인:

```bash
grep -n "Lobby" src/pages/Team.test.jsx
```

Expected: 결과 없음(모두 `Team`으로 치환됨)

- [ ] **Step 4: `App.jsx` 라우트 갱신**

`src/App.jsx`를 다음으로 교체:

```jsx
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Home from './pages/Home'
import Team from './pages/Team'
import IndividualPage from './pages/IndividualPage'
import RankingPage from './pages/RankingPage'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/team/:code" element={<Team />} />
      <Route path="/team/:code/individual" element={<IndividualPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/result/:sessionId" element={<RankingPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}
```

(`Home`은 Task 8에서 삭제되기 전까지 `/team` 경로를 그대로 유지한다.)

- [ ] **Step 5: `IndividualPage.jsx`와 그 테스트를 새 경로로 갱신**

`src/pages/IndividualPage.jsx`에서 `/lobby/${code}`로 되어 있는 6곳을 모두 `/team/${code}`로 변경한다(59, 64, 69, 76, 79, 110번째 줄 — `navigate` 호출부).

`src/pages/IndividualPage.test.jsx`에서:
- `initialEntries={['/lobby/AB1234/individual']}` → `initialEntries={['/team/AB1234/individual']}`
- `<Route path="/lobby/:code/individual" element={<IndividualPage />} />` → `<Route path="/team/:code/individual" element={<IndividualPage />} />`

- [ ] **Step 6: 테스트 실행해 통과 확인**

Run: `npm test -- src/pages/Team.test.jsx src/pages/IndividualPage.test.jsx`
Expected: PASS

- [ ] **Step 7: 전체 프론트엔드 테스트로 다른 참조 누락 확인**

```bash
grep -rn "'/lobby" src --include=*.jsx
grep -rn '"/lobby' src --include=*.jsx
```

Expected: 결과 없음(이번 태스크에서 남겨둔 것 없이 모두 `/team`으로 치환됨 — 단, 이 시점엔 아직 신규 `/lobby` 그리드 화면이 없으므로 새로 생기는 참조는 없어야 정상)

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor: rename Lobby screen to Team screen (route /lobby/:code -> /team/:code)"
```

---

## Task 4: 추방(kick) 시 새 로비로 복귀하도록 수정

**Files:**
- Modify: `src/pages/Team.jsx`, `src/pages/Team.test.jsx`
- Modify: `src/pages/IndividualPage.jsx`, `src/pages/IndividualPage.test.jsx`

Home.jsx가 삭제되면 `/team`(선택 화면)이 사라지므로, 추방된 사용자는 세션에 저장된 프로필 정보를 이용해 `/lobby?classId=...&name=...&character=...`로 돌아가야 한다. 아직 신규 `/lobby` 그리드 화면(Task 6)이 존재하지 않지만, 이 태스크는 두 파일의 kicked 핸들러 로직과 그 단위 테스트만 다룬다(라우트 자체는 Task 6에서 생김).

- [ ] **Step 1: `Team.test.jsx`에 실패하는 테스트 추가**

`src/pages/Team.test.jsx` 상단에 `useNavigate` 모킹을 추가한다(파일 최상단, `vi.mock('socket.io-client', ...)` 앞):

```jsx
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
```

`describe('Team', ...)` 블록(기존 `describe('Lobby', ...)`) 안, `afterEach` 다음에 추가:

```jsx
  it('추방당하면 저장된 프로필 정보를 담아 로비로 이동한다', () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'ABC123', name: '철수', character: 'Adventurer-강아지', affiliation: '경영학과', isHost: false, classId: 'class-1',
    }))
    renderTeam()
    const socket = io()
    const [, kickedHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'you-were-kicked')

    kickedHandler()

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/lobby?'))
    const [calledWith] = mockNavigate.mock.calls[0]
    expect(calledWith).toContain('classId=class-1')
    expect(calledWith).toContain('name=%EC%B2%A0%EC%88%98')
    expect(calledWith).toContain('character=Adventurer-%EA%B0%95%EC%95%84%EC%A7%80')
  })
```

(함수명 `renderLobby`는 Task 3에서 이미 `renderTeam`으로 이름이 바뀌어 있어야 한다 — 아직 안 바뀌었다면 이 스텝에서 `renderLobby` → `renderTeam`으로 함께 변경한다.)

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- src/pages/Team.test.jsx`
Expected: FAIL — `mockNavigate`가 `/team`으로 호출됨(기존 동작)

- [ ] **Step 3: `Team.jsx`의 kicked 핸들러 구현**

`src/pages/Team.jsx`의 다음 블록:

```jsx
  useEffect(() => {
    if (readOnly || !socket) return
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate, readOnly])
```

을 다음으로 교체:

```jsx
  useEffect(() => {
    if (readOnly || !socket) return
    function handler() {
      const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
      const params = new URLSearchParams({ name: stored?.name ?? '', character: stored?.character ?? '' })
      if (stored?.affiliation) params.set('affiliation', stored.affiliation)
      if (stored?.classId) params.set('classId', stored.classId)
      navigate(`/lobby?${params}`)
    }
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate, readOnly])
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- src/pages/Team.test.jsx`
Expected: PASS

- [ ] **Step 5: `IndividualPage.test.jsx`에 동일한 실패하는 테스트 추가**

`src/pages/IndividualPage.test.jsx` 상단에 `useNavigate` 모킹 추가(`vi.mock('socket.io-client', ...)` 다음):

```jsx
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
```

`describe('IndividualPage', ...)` 블록 안에 추가:

```jsx
  it('추방당하면 저장된 프로필 정보를 담아 로비로 이동한다', async () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'AB1234', name: '김민준', character: 'Innovator-사자', affiliation: '', classId: 'class-1',
    }))
    renderPage()
    await screen.findByText('직업 선택')

    const socket = io()
    const [, kickedHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'you-were-kicked')
    kickedHandler()

    const [calledWith] = mockNavigate.mock.calls.find(([url]) => url.startsWith('/lobby?'))
    expect(calledWith).toContain('classId=class-1')
  })
```

- [ ] **Step 6: 테스트 실행해 실패 확인**

Run: `npm test -- src/pages/IndividualPage.test.jsx`
Expected: FAIL

- [ ] **Step 7: `IndividualPage.jsx`의 kicked 핸들러 구현**

`src/pages/IndividualPage.jsx`의 다음 블록(89번째 줄 부근):

```jsx
  useEffect(() => {
    if (!socket) return
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate])
```

을 다음으로 교체:

```jsx
  useEffect(() => {
    if (!socket) return
    function handler() {
      const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
      const params = new URLSearchParams({ name: stored?.name ?? '', character: stored?.character ?? '' })
      if (stored?.affiliation) params.set('affiliation', stored.affiliation)
      if (stored?.classId) params.set('classId', stored.classId)
      navigate(`/lobby?${params}`)
    }
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate])
```

- [ ] **Step 8: 테스트 실행해 통과 확인**

Run: `npm test -- src/pages/IndividualPage.test.jsx`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add src/pages/Team.jsx src/pages/Team.test.jsx src/pages/IndividualPage.jsx src/pages/IndividualPage.test.jsx
git commit -m "fix: return kicked players to the class lobby with their profile preserved"
```

---

## Task 5: `RoomCard` 컴포넌트

**Files:**
- Create: `src/components/RoomCard.jsx`
- Create: `src/components/RoomCard.module.css`
- Test: `src/components/RoomCard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/RoomCard.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RoomCard from './RoomCard'

const BASE_PROPS = { code: 'A3F9C1', status: 'live', playerCount: 2, characters: ['Adventurer-강아지', 'Guardian-판다'], onClick: () => {} }

describe('RoomCard', () => {
  it('방 코드를 제목으로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getByText('A3F9C1')).toBeInTheDocument()
  })

  it('참여인원을 n/4 형태로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} playerCount={3} />)
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('참여자 수만큼 캐릭터 이미지를 렌더링한다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('상태 뱃지 라벨을 관리자 화면과 동일하게 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} status="stale" />)
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  it('완료 후 미등록 상태 라벨을 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} status="completed-but-unregistered" />)
    expect(screen.getByText('등록 대기')).toBeInTheDocument()
  })

  it('클릭 시 onClick을 호출한다', () => {
    const onClick = vi.fn()
    render(<RoomCard {...BASE_PROPS} onClick={onClick} />)
    fireEvent.click(screen.getByText('A3F9C1'))
    expect(onClick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- src/components/RoomCard.test.jsx`
Expected: FAIL — `Cannot find module './RoomCard'`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/RoomCard.jsx`:

```jsx
import { ROOM_STATUS_LABELS } from '../constants/gameData'
import styles from './RoomCard.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

export default function RoomCard({ code, status, playerCount, characters, onClick }) {
  const badgeClassKey = STATUS_BADGE_CLASS[status]
  return (
    <button className={styles.card} onClick={onClick} type="button">
      {badgeClassKey && (
        <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
          {ROOM_STATUS_LABELS[status]}
        </span>
      )}
      <span className={styles.title}>{code}</span>
      <div className={styles.characters}>
        {characters.map((character, i) => (
          <img key={i} src={`/characters/${character}.png`} alt="" className={styles.characterImg} />
        ))}
      </div>
      <span className={styles.count}>{playerCount}/4</span>
    </button>
  )
}
```

`src/components/RoomCard.module.css`:

```css
.card {
  background: var(--white);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--divider);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
  min-height: 160px;
}

.card:hover {
  border-color: var(--purple);
}

.badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: var(--purple);
  border-radius: var(--r-pill);
  padding: 4px 10px;
}

.badgeLive { background: var(--muted); }
.badgeStale { background: var(--amber); }
.badgeAbandoned { background: var(--red); }
.badgeUnregistered { background: var(--violet); }

.title {
  font-size: 16px;
  font-weight: 900;
  color: var(--ink);
  margin-top: 8px;
}

.characters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.characterImg {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.count {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- src/components/RoomCard.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/RoomCard.jsx src/components/RoomCard.module.css src/components/RoomCard.test.jsx
git commit -m "feat: add RoomCard component for the class lobby grid"
```

---

## Task 6: 신규 로비 화면 (`src/pages/Lobby.jsx`) — 팀 목록 그리드

**Files:**
- Create: `src/pages/Lobby.jsx`
- Create: `src/pages/Lobby.module.css`
- Test: `src/pages/Lobby.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/Lobby.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

import { io } from 'socket.io-client'
import { SocketProvider } from '../contexts/SocketContext'
import Lobby from './Lobby'

function renderLobby(path = '/lobby?classId=class-1&name=철수&character=c1') {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={[path]}>
        <Lobby />
      </MemoryRouter>
    </SocketProvider>
  )
}

describe('Lobby (team grid)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    fetch.mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('마운트 시 classId로 팀 목록을 조회한다', async () => {
    renderLobby()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/rooms?classId=class-1'))
  })

  it('조회된 팀을 카드로 렌더링한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 2, characters: ['c1', 'c2'] }],
    })
    renderLobby()
    expect(await screen.findByText('A3F9C1')).toBeInTheDocument()
  })

  it('팀 만들기와 코드로 참가 버튼을 렌더링한다', () => {
    renderLobby()
    expect(screen.getByText('+ 팀 만들기')).toBeInTheDocument()
    expect(screen.getByText('코드로 참가')).toBeInTheDocument()
  })

  it('코드로 참가 버튼 클릭 시 CodeModal이 열린다', () => {
    renderLobby()
    fireEvent.click(screen.getByText('코드로 참가'))
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })

  it('URL에 code가 있으면 CodeModal이 자동으로 열린다', () => {
    renderLobby('/lobby?classId=class-1&name=철수&character=c1&code=ABC123')
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })

  it('마운트 시 watch-class-rooms를 emit하고 언마운트 시 unwatch-class-rooms를 emit한다', () => {
    const socket = io()
    const { unmount } = renderLobby()
    expect(socket.emit).toHaveBeenCalledWith('watch-class-rooms', { classId: 'class-1' })
    unmount()
    expect(socket.emit).toHaveBeenCalledWith('unwatch-class-rooms', { classId: 'class-1' })
  })

  it('class-rooms-updated 이벤트를 받으면 목록을 다시 조회한다', async () => {
    renderLobby()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const socket = io()
    const [, updateHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'class-rooms-updated')
    fetch.mockClear()
    updateHandler()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/rooms?classId=class-1'))
  })

  it('카드를 클릭하면 join-room을 emit하고 팀 화면으로 이동한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'] }],
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(await screen.findByText('A3F9C1'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/team/A3F9C1'))
  })

  it('팀 만들기 클릭 시 방장으로 새 팀을 만들어 팀 화면으로 이동한다', async () => {
    fetch.mockImplementation((url, opts) => {
      if (opts?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ code: 'NEW001' }) })
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(screen.getByText('+ 팀 만들기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/team/NEW001'))
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- src/pages/Lobby.test.jsx`
Expected: FAIL — `Cannot find module './Lobby'`

- [ ] **Step 3: 화면 구현**

`src/pages/Lobby.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CodeModal from '../components/CodeModal'
import RoomCard from '../components/RoomCard'
import { useSocketContext } from '../contexts/SocketContext'
import { resetPlayerUuid } from '../utils/playerUuid'
import styles from './Lobby.module.css'

export default function Lobby() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocketContext()
  const [rooms, setRooms] = useState([])
  const [showCodeModal, setShowCodeModal] = useState(false)

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const classId = searchParams.get('classId') ?? ''
  const character = searchParams.get('character') ?? ''
  const initialCode = searchParams.get('code') ?? ''

  const loadRooms = useCallback(() => {
    if (!classId) return
    fetch(`/api/rooms?classId=${encodeURIComponent(classId)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [classId])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  useEffect(() => {
    if (initialCode) setShowCodeModal(true)
  }, [initialCode])

  useEffect(() => {
    if (!socket || !classId) return
    socket.emit('watch-class-rooms', { classId })
    socket.on('class-rooms-updated', loadRooms)
    return () => {
      socket.emit('unwatch-class-rooms', { classId })
      socket.off('class-rooms-updated', loadRooms)
    }
  }, [socket, classId, loadRooms])

  function joinRoom(code, isHost) {
    const playerUuid = resetPlayerUuid()
    socket.emit('join-room', { code, name, affiliation, character, isHost, playerUuid }, ({ ok, error }) => {
      if (ok) {
        sessionStorage.setItem('player_profile', JSON.stringify({ name, affiliation, character, code, isHost, classId }))
        navigate(`/team/${code}`)
      } else alert(error)
    })
  }

  async function handleCreate() {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: classId || null }),
    })
    const { code } = await res.json()
    joinRoom(code, true)
  }

  function handleJoinByCode(code) {
    setShowCodeModal(false)
    joinRoom(code, false)
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>로비</h1>
        <p className={styles.subtitle}>참여할 팀을 선택하거나 새 팀을 만드세요</p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.actions}>
        <button className={styles.createBtn} onClick={handleCreate} type="button">
          + 팀 만들기
        </button>
        <button className={styles.codeBtn} onClick={() => setShowCodeModal(true)} type="button">
          코드로 참가
        </button>
      </div>

      <div className={styles.grid}>
        {rooms.map(room => (
          <RoomCard
            key={room.code}
            code={room.code}
            status={room.status}
            playerCount={room.playerCount}
            characters={room.characters}
            onClick={() => joinRoom(room.code, false)}
          />
        ))}
      </div>

      {showCodeModal && (
        <CodeModal
          initialCode={initialCode}
          onSubmit={handleJoinByCode}
          onClose={() => setShowCodeModal(false)}
        />
      )}
    </div>
  )
}
```

`src/pages/Lobby.module.css`:

```css
.page {
  min-height: 100%;
  height: 100%;
  background: var(--white);
  display: flex;
  flex-direction: column;
  padding: 0 24px 24px;
  position: relative;
}

.header {
  padding-top: 32px;
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

.divider {
  border: none;
  border-top: 1px solid var(--divider);
  margin: 10px 0 20px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.createBtn {
  flex: 1;
  height: 48px;
  border-radius: var(--r-sm);
  background: var(--grad-btn);
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
}

.codeBtn {
  flex: 1;
  height: 48px;
  border-radius: var(--r-sm);
  background: var(--white);
  border: 1px solid var(--divider);
  color: var(--ink);
  font-size: 15px;
  font-weight: 800;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
  overflow-y: auto;
}
```

- [ ] **Step 4: `App.jsx`에 `/lobby` 라우트 추가**

`src/App.jsx`의 import에 `import Lobby from './pages/Lobby'` 추가, `<Route path="/team" element={<Home />} />` 바로 위에 다음 라우트 추가:

```jsx
      <Route path="/lobby" element={<Lobby />} />
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npm test -- src/pages/Lobby.test.jsx`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.module.css src/pages/Lobby.test.jsx src/App.jsx
git commit -m "feat: add class lobby screen showing all teams as a card grid"
```

---

## Task 7: 캐릭터 선택 화면이 새 로비를 향하도록 변경

**Files:**
- Modify: `src/pages/CharacterSelect.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/pages/CharacterSelect.test.jsx`의 마지막 테스트(`'URL에 classId가 있으면...'`) 뒤에 추가:

```jsx
  it('캐릭터 선택 완료 시 새 로비 화면으로 이동한다', () => {
    render(
      <MemoryRouter initialEntries={['/select?name=철수&classId=class-1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/lobby\?/))
  })
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- src/pages/CharacterSelect.test.jsx`
Expected: FAIL — 실제 호출은 `/team?...`

- [ ] **Step 3: 구현 변경**

`src/pages/CharacterSelect.jsx`의 `handleSubmit`:

```jsx
  function handleSubmit() {
    if (!selected) return
    const params = new URLSearchParams({ affiliation, name, character: selected })
    if (code) params.set('code', code)
    if (classId) params.set('classId', classId)
    navigate(`/lobby?${params}`)
  }
```

(`/team?${params}` → `/lobby?${params}`로만 변경)

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- src/pages/CharacterSelect.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/CharacterSelect.jsx src/pages/CharacterSelect.test.jsx
git commit -m "feat: send players to the class lobby after picking a character"
```

---

## Task 8: `Home.jsx`(팀 만들기/참여 선택) 삭제

**Files:**
- Delete: `src/pages/Home.jsx`, `src/pages/Home.module.css`, `src/pages/Home.test.jsx`
- Modify: `src/App.jsx`

이 시점에서 `/team`으로 진입하는 코드 경로는 더 이상 없다(Task 7에서 `CharacterSelect`가 `/lobby`로 이동하도록 바뀌었고, 관리자 QR·팀 QR 모두 `/join`을 거쳐 `/select` → `/lobby`로 이어짐).

- [ ] **Step 1: 파일 삭제**

```bash
git rm src/pages/Home.jsx src/pages/Home.module.css src/pages/Home.test.jsx
```

- [ ] **Step 2: `App.jsx`에서 라우트와 import 제거**

`src/App.jsx`에서 `import Home from './pages/Home'` 줄과 `<Route path="/team" element={<Home />} />` 줄을 제거한다. 최종 라우트 테이블:

```jsx
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'
import Team from './pages/Team'
import IndividualPage from './pages/IndividualPage'
import RankingPage from './pages/RankingPage'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/team/:code" element={<Team />} />
      <Route path="/team/:code/individual" element={<IndividualPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/result/:sessionId" element={<RankingPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}
```

- [ ] **Step 3: 전체 프론트엔드 테스트 실행**

Run: `npm test -- src`
Expected: PASS (Home 관련 테스트 파일은 삭제되어 더 이상 실행되지 않음)

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: remove the old team-creation/join chooser screen (superseded by the class lobby)"
```

---

## Task 9: 랜딩페이지 — "참여하기" 버튼 제거

**Files:**
- Modify: `src/pages/LandingPage.jsx`, `src/pages/LandingPage.module.css`
- Test: `src/pages/LandingPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/pages/LandingPage.test.jsx`의 `describe('LandingPage', ...)` 블록에 추가:

```jsx
  it('참여하기 버튼이 더 이상 없다', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.queryByText('참여하기')).toBeNull()
  })

  it('QR 스캔 안내 문구를 보여준다', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText('선생님이 보여주는 QR 코드를 스캔해 참여해주세요')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- src/pages/LandingPage.test.jsx`
Expected: FAIL — "참여하기" 버튼이 아직 존재

- [ ] **Step 3: 구현 변경**

`src/pages/LandingPage.jsx`의 `<div className={styles.buttons}>` 블록을 다음으로 교체:

```jsx
      <div className={styles.buttons}>
        <p className={styles.hint}>선생님이 보여주는 QR 코드를 스캔해 참여해주세요</p>
        <button className={styles.secondaryBtn} onClick={() => navigate('/ranking')}>
          랭킹 보기
        </button>
      </div>
```

`src/pages/LandingPage.module.css`에서 `.primaryBtn` 규칙(더 이상 쓰이지 않음)을 삭제하고, `.buttons` 규칙 뒤에 추가:

```css
.hint {
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.5;
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm test -- src/pages/LandingPage.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/LandingPage.jsx src/pages/LandingPage.module.css src/pages/LandingPage.test.jsx
git commit -m "feat: replace the generic join button with QR-scan guidance on the landing page"
```

---

## Task 10: 전체 검증

**Files:** 없음(검증 전용)

- [ ] **Step 1: 전체 자동 테스트 스위트 실행**

Run: `npm test`
Expected: PASS — 모든 테스트(서버 + 프론트엔드) 통과, 실패/스킵 없음

- [ ] **Step 2: 남은 옛 이름 참조 검색**

```bash
grep -rn "'/lobby/" src server --include=*.jsx --include=*.js
grep -rln "from './Lobby'" src/pages
grep -rn "pages/Home" src
```

Expected: 모두 결과 없음(첫 번째 grep은 `/lobby` 자체는 남아있어야 정상이므로 `/lobby/`처럼 code가 붙는 옛 패턴만 검색한다)

- [ ] **Step 3: 개발 서버로 수동 시나리오 점검**

`npm run dev` 실행 후 브라우저로:
1. `/` 접속 → "참여하기" 버튼이 없고 QR 안내 문구만 보이는지 확인
2. `/admin`으로 로그인 → 수업 생성 → QR 코드 확인(내부적으로 `/join?classId=...` 인코딩)
3. 해당 QR URL을 새 탭에 직접 입력해 접속 → 이름 입력 → 캐릭터 선택 → **새 로비(팀 목록 그리드, "+ 팀 만들기" 버튼)**가 뜨는지 확인
4. "+ 팀 만들기" 클릭 → `/team/:code`(팀 화면)로 이동해 QR/코드/팀원 현황이 보이는지 확인
5. 다른 탭에서 같은 `classId`로 다시 진입 → 방금 만든 팀 카드가 그리드에 나타나는지, 소켓 갱신으로 인원수가 실시간으로 바뀌는지 확인
6. 팀 화면에서 호스트가 팀원을 추방 → 추방된 사용자가 새 로비 화면으로 돌아가는지 확인

확인 후 `npm run dev` 중단.

- [ ] **Step 4: 최종 상태 확인**

```bash
git status
git log --oneline main..HEAD
```

Expected: 작업 트리 깨끗함, `feature/lobby-system-redesign` 브랜치에 이번 계획의 커밋들이 순서대로 쌓여 있음
