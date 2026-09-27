# 관리자 결과 등록 개선 (연결 끊김 허용 + 직접 등록하기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연결이 끊긴 팀원이 있어도 관리자가 경고 후 결과를 등록할 수 있게 하고, 오프라인으로 끝난 게임의 결과를 관리자가 팀원별로 직접 입력해 등록할 수 있는 마법사를 추가한다.

**Architecture:** 서버(`server/index.js`, `server/rooms.js`)에서 연결 끊김 방어 로직을 제거하고 새 플레이어 추가 API를 신설한다. 클라이언트는 `AdminSpectateModal`/`AdminClassDashboard`의 확인 다이얼로그 문구를 상황에 따라 분기하고, 참가자용 "자산 입력" 화면(`IndividualPage.jsx`)이 쓰는 순수 프레젠테이션 컴포넌트(`StepBar`, `JobPicker`, `BadgePicker`, `AssetListEditor`, `NumberInputModal`)를 그대로 재사용해 새 `AdminAddPlayerModal` 팝업 마법사를 만든다.

**Tech Stack:** React 18 + Vite (클라이언트), Express 5 + Socket.IO (서버), Vitest + Testing Library.

**참고 스펙:** `docs/superpowers/specs/2026-09-28-manual-registration-and-disconnect-allow-design.md`

---

## 사전 확인 사항 (모든 태스크에 공통)

- 이 저장소에는 `server/index.js`의 HTTP 라우트를 직접 때리는 테스트 파일이 없다(`server/*.test.js`는 모두 `rooms.js`/`db.js`/`classes.js` 등 순수 로직만 단위 테스트한다). 그래서 이번 계획에서 서버 라우트(`server/index.js`) 변경은 별도 HTTP 테스트를 새로 만들지 않고, 기존 관례대로 (1) `rooms.js`의 순수 로직은 `rooms.test.js`로 단위 테스트하고 (2) 라우트 자체는 그 라우트를 호출하는 클라이언트 쪽 테스트(`global.fetch`를 모킹해 요청 URL/payload를 검증하는 기존 패턴)로 간접 검증한다.
- 모든 새 코드는 기존 커밋 스타일을 따른다: `git log`에서 보이는 `fix:`, `feat:`, `test:`, `style:`, `docs:` 같은 conventional 접두사를 쓴다.
- 커밋 메시지 마지막에는 다음 줄을 추가한다(이 대화의 시스템 지침에 따른 attribution):
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

---

### Task 1: 서버 — 연결 끊김이어도 결과 등록 허용 + 죽은 코드 정리

**Files:**
- Modify: `server/index.js:8` (import), `server/index.js:59-84`(`/api/rooms/:code/submit`), `server/index.js:206-238`(`/api/admin/classes/:classId/submit-pending`)
- Modify: `server/rooms.js:187-189` (`hasDisconnectedPlayer` 함수 삭제)
- Modify: `server/rooms.test.js:1-10`(import), `server/rooms.test.js:470-484`(`describe('hasDisconnectedPlayer', ...)` 블록 삭제)

- [ ] **Step 1: `rooms.test.js`에서 `hasDisconnectedPlayer` 관련 테스트를 삭제한다**

`server/rooms.test.js` 상단 import에서 `hasDisconnectedPlayer`를 제거한다:

```js
// server/rooms.test.js — 기존
import {
  createRoom, getRoom, addPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPricesByCode, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder,
  listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, updateRoomTitle,
  hasDisconnectedPlayer
} from './rooms.js'
```

```js
// server/rooms.test.js — 변경 후
import {
  createRoom, getRoom, addPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPricesByCode, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder,
  listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, updateRoomTitle,
} from './rooms.js'
```

그리고 파일 끝쪽의 다음 블록을 통째로 삭제한다:

```js
describe('hasDisconnectedPlayer', () => {
  it('연결 끊긴 플레이어가 있으면 true를 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    addPlayer(code, { socketId: 's2', name: '영희', character: 'edsu', isHost: false, playerUuid: 'p2' })
    markDisconnected('s1')
    expect(hasDisconnectedPlayer(getRoom(code))).toBe(true)
  })

  it('모든 플레이어가 연결되어 있으면 false를 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(hasDisconnectedPlayer(getRoom(code))).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 이 시점엔 `rooms.js`를 아직 안 건드렸으니 그대로 통과해야 한다**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (전체 통과, `hasDisconnectedPlayer` 관련 테스트는 이제 존재하지 않음)

- [ ] **Step 3: `rooms.js`에서 `hasDisconnectedPlayer` export를 삭제한다**

`server/rooms.js`에서 다음 블록을 삭제한다:

```js
export function hasDisconnectedPlayer(room) {
  return room.players.some(p => p.connected === false)
}
```

- [ ] **Step 4: `server/index.js`에서 연결 끊김 관련 방어 로직을 모두 제거한다**

import 줄(`server/index.js:8`)에서 `hasDisconnectedPlayer`를 제거한다:

```js
// 기존
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPricesByCode, updateRoomTitle, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder, listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, hasDisconnectedPlayer } from './rooms.js'
```

```js
// 변경 후
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPricesByCode, updateRoomTitle, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder, listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid } from './rooms.js'
```

`/api/rooms/:code/submit` 라우트에서 다음 블록을 삭제한다:

```js
// 삭제할 블록
  if (hasDisconnectedPlayer(room)) {
    return res.status(400).json({ error: 'A player is disconnected' })
  }

```

(바로 위의 `if (!room.players.every(p => p.gameState?.isCompleted)) { ... }` 블록은 그대로 둔다.)

`/api/admin/classes/:classId/submit-pending` 라우트를 아래처럼 바꾼다:

```js
// 기존
    const resolvedClassId = classId === 'unassigned' ? null : classId
    const now = new Date()
    const allPendingRooms = listAllRooms().filter(room =>
      room.classId === resolvedClassId && computeLiveRoomStatus(room, now) === 'completed-but-unregistered'
    )
    const pendingRooms = allPendingRooms.filter(room => !hasDisconnectedPlayer(room))
    const skipped = allPendingRooms.length - pendingRooms.length

    let registered = 0
    for (const room of pendingRooms) {
      try {
        const sessionId = await saveGameResult(room)
        deleteRoomByCode(room.code)
        io.to(room.code).emit('game-submitted', { sessionId })
        registered += 1
      } catch (err) {
        console.error(`bulk submit error for room ${room.code}:`, err)
      }
    }

    broadcastClassRooms(resolvedClassId)
    res.json({ registered, total: pendingRooms.length, skipped })
```

```js
// 변경 후
    const resolvedClassId = classId === 'unassigned' ? null : classId
    const now = new Date()
    const pendingRooms = listAllRooms().filter(room =>
      room.classId === resolvedClassId && computeLiveRoomStatus(room, now) === 'completed-but-unregistered'
    )

    let registered = 0
    for (const room of pendingRooms) {
      try {
        const sessionId = await saveGameResult(room)
        deleteRoomByCode(room.code)
        io.to(room.code).emit('game-submitted', { sessionId })
        registered += 1
      } catch (err) {
        console.error(`bulk submit error for room ${room.code}:`, err)
      }
    }

    broadcastClassRooms(resolvedClassId)
    res.json({ registered, total: pendingRooms.length })
```

- [ ] **Step 5: 서버 테스트 전체 실행**

Run: `npx vitest run server/`
Expected: PASS (전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add server/index.js server/rooms.js server/rooms.test.js
git commit -m "$(cat <<'EOF'
fix: allow result registration even with disconnected players

Removes the server-side block that prevented individual and bulk
result registration whenever a team had a disconnected player.
Warning/consent now happens client-side before the request is sent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 클라이언트 — 개별 "결과 등록" 확인 문구 분기 (`AdminSpectateModal`)

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx:178-230`
- Modify: `src/components/admin/AdminSpectateModal.module.css:87-119`
- Test: `src/components/admin/AdminSpectateModal.test.jsx:214-220`

- [ ] **Step 1: 실패하는 테스트로 교체한다**

`src/components/admin/AdminSpectateModal.test.jsx`에서 다음 테스트를 삭제하고:

```js
it('연결 끊긴 팀원이 있으면 결과 등록 버튼을 비활성화하고 안내 문구를 보여준다', () => {
  const pendingRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed-but-unregistered' }
  pendingRoom.players[0] = { ...pendingRoom.players[0], connected: false }
  render(<AdminSpectateModal rooms={[pendingRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.getByText('결과 등록')).toBeDisabled()
  expect(screen.getByText('연결이 끊긴 팀원이 있어 등록할 수 없습니다')).toBeInTheDocument()
})
```

같은 자리에 다음 두 테스트를 추가한다:

```js
it('연결 끊긴 팀원이 있어도 결과 등록 버튼은 활성 상태이고, 클릭 시 경고 문구가 담긴 확인 팝업을 보여준다', async () => {
  const pendingRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed-but-unregistered' }
  pendingRoom.players[0] = { ...pendingRoom.players[0], connected: false }
  render(<AdminSpectateModal rooms={[pendingRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.getByText('결과 등록')).not.toBeDisabled()

  await userEvent.click(screen.getByText('결과 등록'))
  expect(screen.getByText(/일부 참여자에게는 결과화면이 나오지 않을 수 있습니다/)).toBeInTheDocument()
})

it('연결 끊긴 팀원이 있어도 확인 팝업에서 예를 누르면 등록 요청을 보낸다', async () => {
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessionId: 'session-1' }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })
  const pendingRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed-but-unregistered' }
  pendingRoom.players[0] = { ...pendingRoom.players[0], connected: false }
  render(<AdminSpectateModal rooms={[pendingRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)

  await userEvent.click(screen.getByText('결과 등록'))
  await userEvent.click(screen.getByText('예'))

  expect(global.fetch).toHaveBeenCalledWith('/api/rooms/AB1234/submit', expect.objectContaining({ method: 'POST' }))
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: FAIL (새 테스트 2개가 실패 — 버튼이 아직 `disabled`로 남아있고, 확인 문구도 고정 텍스트라서)

- [ ] **Step 3: `AdminSpectateModal.jsx`를 수정한다**

`.actions` 안의 등록 버튼 그룹을 다음처럼 바꾼다:

```jsx
// 기존
        {room.status === 'completed-but-unregistered' && (
          <div className={styles.registerGroup}>
            <button
              type="button"
              className={styles.registerBtn}
              onClick={() => setConfirmRegister(true)}
              disabled={hasDisconnectedPlayer}
            >
              결과 등록
            </button>
            {hasDisconnectedPlayer && (
              <span className={styles.registerWarning}>연결이 끊긴 팀원이 있어 등록할 수 없습니다</span>
            )}
          </div>
        )}
```

```jsx
// 변경 후
        {room.status === 'completed-but-unregistered' && (
          <button type="button" className={styles.registerBtn} onClick={() => setConfirmRegister(true)}>결과 등록</button>
        )}
```

`confirmRegister` `ConfirmDialog`를 다음처럼 바꾼다:

```jsx
// 기존
      {confirmRegister && (
        <ConfirmDialog
          tone="primary"
          title="결과 등록"
          description="이 팀의 결과를 등록하시겠습니까?"
          onCancel={() => setConfirmRegister(false)}
          onConfirm={() => { setConfirmRegister(false); handleRegister() }}
        />
      )}
```

```jsx
// 변경 후
      {confirmRegister && (
        <ConfirmDialog
          tone="primary"
          title="결과 등록"
          description={
            hasDisconnectedPlayer
              ? '연결끊김 상태인 참가자가 존재하고, 일부 참여자에게는 결과화면이 나오지 않을 수 있습니다. 그래도 진행하시겠습니까?'
              : '이 팀의 결과를 등록하시겠습니까?'
          }
          onCancel={() => setConfirmRegister(false)}
          onConfirm={() => { setConfirmRegister(false); handleRegister() }}
        />
      )}
```

(파일 상단의 `const hasDisconnectedPlayer = room.players.some(p => p?.connected === false)`는 그대로 둔다 — 이미 있는 로컬 변수를 재사용한다.)

- [ ] **Step 4: `AdminSpectateModal.module.css`에서 이제 안 쓰는 클래스를 지운다**

다음 두 규칙을 삭제한다:

```css
.registerGroup { display: flex; flex-direction: column; align-items: center; gap: 6px; }

.registerWarning { font-size: 12px; color: #ef4444; }
```

- [ ] **Step 5: 테스트 재실행 — 통과 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "$(cat <<'EOF'
fix: warn instead of blocking result registration when disconnected

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 클라이언트 — "전체 등록" 확인 문구 분기 (`AdminClassDashboard`)

**Files:**
- Modify: `src/pages/AdminClassDashboard.jsx:62,107-126,218-226`
- Test: `src/pages/AdminClassDashboard.test.jsx:337-354` (교체), 새 테스트 추가

- [ ] **Step 1: 실패하는 테스트로 교체한다**

`src/pages/AdminClassDashboard.test.jsx`에서 다음 테스트를 삭제한다:

```js
it('연결 끊긴 팀원이 있는 팀은 제외되었다고 토스트로 안내한다', async () => {
  renderDashboard()
  await screen.findByText('홍길동')

  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ registered: 1, total: 1, skipped: 2 }) })
    }
    return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
  })
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

  await userEvent.click(screen.getByText('전체 등록'))
  await userEvent.click(screen.getByText('예'))

  expect(await screen.findByText('2개 팀은 연결이 끊긴 팀원이 있어 등록되지 않았습니다')).toBeInTheDocument()
  expect(alertSpy).not.toHaveBeenCalled()
})
```

같은 자리에 다음 테스트를 추가한다:

```js
it('연결 끊긴 팀원이 있는 등록 대기 팀이 있으면 전체 등록 확인 문구가 경고로 바뀐다', async () => {
  const disconnectedRooms = [{
    ...ROOMS[0],
    code: 'EF9012',
    status: 'completed-but-unregistered',
    players: [{ ...ROOMS[0].players[0], connected: false }],
  }]
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ registered: 0, total: 0 }) })
    }
    return Promise.resolve({ json: () => Promise.resolve(disconnectedRooms) })
  })

  renderDashboard()
  await screen.findByText('홍길동')

  await userEvent.click(screen.getByText('전체 등록'))
  expect(screen.getByText(/일부 참여자에게는 결과화면이 나오지 않을 수 있습니다/)).toBeInTheDocument()
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
Expected: FAIL (새로 추가한 테스트가 실패 — 확인 문구가 아직 고정 텍스트라서. 삭제한 `skipped` 테스트가 없어졌으니 그 테스트로 인한 실패는 없음)

- [ ] **Step 3: `AdminClassDashboard.jsx`를 수정한다**

`filteredRooms` 바로 아래에 연결 끊긴 등록 대기 팀이 있는지 판별하는 값을 추가한다:

```jsx
// 기존
  const filteredRooms = useMemo(() => rooms.filter(room => matchesSearch(room, search)), [rooms, search])
```

```jsx
// 변경 후
  const filteredRooms = useMemo(() => rooms.filter(room => matchesSearch(room, search)), [rooms, search])
  const hasDisconnectedPendingTeam = rooms.some(room =>
    room.status === 'completed-but-unregistered' && !room.registered &&
    room.players.some(p => p?.connected === false)
  )
```

`handleBulkRegister`의 응답 처리 부분을 수정한다:

```jsx
// 기존
      const { total, skipped } = await res.json()
      if (total === 0 && !skipped) toast('등록 대기 중인 팀이 없습니다')
      else if (skipped > 0) toast(`${skipped}개 팀은 연결이 끊긴 팀원이 있어 등록되지 않았습니다`)
      loadRooms()
```

```jsx
// 변경 후
      const { total } = await res.json()
      if (total === 0) toast('등록 대기 중인 팀이 없습니다')
      loadRooms()
```

`confirmBulkRegister` `ConfirmDialog`를 수정한다:

```jsx
// 기존
      {confirmBulkRegister && (
        <ConfirmDialog
          tone="primary"
          title="전체 등록"
          description="등록 대기 중인 팀을 모두 결과 등록하시겠습니까?"
          onCancel={() => setConfirmBulkRegister(false)}
          onConfirm={() => { setConfirmBulkRegister(false); handleBulkRegister() }}
        />
      )}
```

```jsx
// 변경 후
      {confirmBulkRegister && (
        <ConfirmDialog
          tone="primary"
          title="전체 등록"
          description={
            hasDisconnectedPendingTeam
              ? '연결끊김 상태인 참가자가 존재하고, 일부 참여자에게는 결과화면이 나오지 않을 수 있습니다. 그래도 진행하시겠습니까?'
              : '등록 대기 중인 팀을 모두 결과 등록하시겠습니까?'
          }
          onCancel={() => setConfirmBulkRegister(false)}
          onConfirm={() => { setConfirmBulkRegister(false); handleBulkRegister() }}
        />
      )}
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

Run: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
Expected: PASS (전체 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminClassDashboard.jsx src/pages/AdminClassDashboard.test.jsx
git commit -m "$(cat <<'EOF'
fix: warn instead of skipping bulk registration when disconnected

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 서버 — `addManualPlayer` (rooms.js)

**Files:**
- Modify: `server/rooms.js` (`addPlayer` 함수 바로 다음에 추가)
- Modify: `server/rooms.test.js` (import 및 새 `describe` 블록)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`server/rooms.test.js` 상단 import에 `addManualPlayer`를 추가한다:

```js
// 기존
import {
  createRoom, getRoom, addPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPricesByCode, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder,
  listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, updateRoomTitle,
} from './rooms.js'
```

```js
// 변경 후
import {
  createRoom, getRoom, addPlayer, addManualPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPricesByCode, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder,
  listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, updateRoomTitle,
} from './rooms.js'
```

`describe('addPlayer 재접속 (playerUuid upsert)', ...)` 블록 바로 다음에 새 블록을 추가한다:

```js
describe('addManualPlayer', () => {
  it('gameState를 그대로 담은 플레이어를 방에 추가한다', () => {
    const { code } = createRoom()
    const gameState = {
      cash: 5000, job: 'a',
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, false, false, false, false],
      jobVisited: true, stocksVisited: true, realEstateVisited: true, isCompleted: true,
    }
    const room = addManualPlayer(code, { name: '철수', character: 'ptsc', gameState })
    expect(room.players).toHaveLength(1)
    expect(room.players[0]).toMatchObject({
      name: '철수', character: 'ptsc', connected: true, socketId: null, isHost: false, affiliation: '', gameState,
    })
    expect(room.players[0].playerUuid).toBeTruthy()
  })

  it('여러 번 호출하면 매번 새 플레이어가 추가된다', () => {
    const { code } = createRoom()
    addManualPlayer(code, { name: '철수', character: 'ptsc', gameState: {} })
    const room = addManualPlayer(code, { name: '영희', character: 'edsu', gameState: {} })
    expect(room.players).toHaveLength(2)
    expect(room.players[0].playerUuid).not.toBe(room.players[1].playerUuid)
  })

  it('MAX_PLAYERS(4명)를 초과하면 에러를 던진다', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0, playerUuid: `uuid${i}` })
    }
    expect(() => addManualPlayer(code, { name: '철수', character: 'ptsc', gameState: {} })).toThrow('Room is full')
  })

  it('존재하지 않는 방 코드면 에러를 던진다', () => {
    expect(() => addManualPlayer('NOPE12', { name: '철수', character: 'ptsc', gameState: {} })).toThrow('Room not found')
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `addManualPlayer`가 아직 export되지 않아 `import`부터 실패한다.

- [ ] **Step 3: `rooms.js`에 `addManualPlayer`를 구현한다**

`addPlayer` 함수(`room.players.push(...)`로 끝나는 함수) 바로 다음에 추가한다:

```js
export function addManualPlayer(code, { name, character, gameState }) {
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')
  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')

  const playerUuid = crypto.randomUUID()
  room.players.push({
    socketId: null, name, character, isHost: false, playerUuid, affiliation: '', connected: true, gameState,
  })
  room.updatedAt = new Date()
  return room
}
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (전체 통과)

- [ ] **Step 5: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "$(cat <<'EOF'
feat: add addManualPlayer for admin-entered offline results

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 서버 — `POST /api/admin/rooms/:code/players` 라우트

**Files:**
- Modify: `server/index.js:8` (import), `server/index.js` (`app.patch('/api/admin/rooms/:code/players/:playerUuid', ...)` 라우트 바로 앞에 신설)

- [ ] **Step 1: import에 `addManualPlayer` 추가**

```js
// 기존 (Task 1에서 이미 hasDisconnectedPlayer는 제거된 상태)
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPricesByCode, updateRoomTitle, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder, listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid } from './rooms.js'
```

```js
// 변경 후
import { createRoom, getRoom, addPlayer, addManualPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPricesByCode, updateRoomTitle, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder, listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid } from './rooms.js'
```

- [ ] **Step 2: 새 라우트를 추가한다**

`app.delete('/api/admin/rooms/:code/players/:playerUuid', requireAdmin, ...)` 라우트와 `app.patch('/api/admin/rooms/:code/players/:playerUuid', requireAdmin, ...)` 라우트 사이에 아래 라우트를 추가한다:

```js
app.post('/api/admin/rooms/:code/players', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const { name, character, job, badges, stocks, realEstate, cash } = req.body ?? {}
  if (!name?.trim() || !character) return res.status(400).json({ error: 'name과 character가 필요합니다' })

  const classId = await findRoomClassId(code)
  if (classId === undefined) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasClassAccess(req.admin, classId || 'unassigned'))) {
    return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
  }

  const gameState = {
    cash: cash ?? 0,
    job: job ?? null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0, ...stocks },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0, ...realEstate },
    badges: badges ?? [false, false, false, false, false, false],
    jobVisited: true,
    stocksVisited: true,
    realEstateVisited: true,
    isCompleted: true,
  }

  try {
    const room = addManualPlayer(code, { name: name.trim(), character, gameState })
    io.to(code).emit('room-updated', { players: room.players })
    broadcastClassRooms(room.classId)
    const player = room.players[room.players.length - 1]
    res.json({
      playerUuid: player.playerUuid,
      name: player.name,
      character: player.character,
      gameState: player.gameState,
      connected: player.connected,
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})
```

- [ ] **Step 3: 서버가 정상적으로 기동되는지 확인한다**

Run: `node --check server/index.js`
Expected: 출력 없음(문법 오류 없음)

이 라우트 자체를 때리는 전용 테스트는 없다(사전 확인 사항 참고) — Task 6/7에서 클라이언트가 이 라우트를 호출하는 테스트로 계약을 검증한다.

- [ ] **Step 4: 커밋**

```bash
git add server/index.js
git commit -m "$(cat <<'EOF'
feat: add POST /api/admin/rooms/:code/players endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 클라이언트 — `AdminAddPlayerModal` 컴포넌트 (7단계 마법사)

**Files:**
- Create: `src/components/admin/AdminAddPlayerModal.jsx`
- Create: `src/components/admin/AdminAddPlayerModal.module.css`
- Test: `src/components/admin/AdminAddPlayerModal.test.jsx`

재사용하는 기존 컴포넌트(수정 없음): `src/components/StepBar.jsx`, `src/components/JobPicker.jsx`, `src/components/BadgePicker.jsx`, `src/components/AssetListEditor.jsx`, `src/components/NumberInputModal.jsx`, `src/components/CharacterCard.jsx`, `src/constants/characters.js`(`CHARACTERS`), `src/components/admin/ConfirmDialog.jsx`.

> 참고: `StepBar`/`JobPicker`/`BadgePicker`/`AssetListEditor`(내부 `AssetCard`)는 자체 CSS에서 `var(--sx, 1)`/`var(--sy, 1)`처럼 기본값이 있는 폴백을 쓰기 때문에, `body.onboarding-mode` 컨테이너 컨텍스트 밖(=이 관리자 모달)에서도 안전하게 스케일 1로 렌더링된다. 반대로 `IndividualPage.module.css`의 `.page`/`.stepTitle`/`.nextBtn` 같은 최상위 클래스들은 `var(--sx)`를 폴백 없이 직접 쓰기 때문에 그 컨테이너 밖에서 그대로 가져다 쓰면 크기 값이 깨진다. 그래서 이 태스크는 위에 나열한 재사용 컴포넌트만 그대로 가져다 쓰고, 마법사 자체의 오버레이/제목/버튼 껍데기는 관리자 화면에서 이미 쓰는 `--admin-*` 토큰으로 새 CSS 모듈을 만든다(`AdminTeamAssetsModal.module.css`의 오버레이/헤더/푸터 패턴을 그대로 따른다).

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/components/admin/AdminAddPlayerModal.test.jsx`를 새로 만든다:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminAddPlayerModal from './AdminAddPlayerModal'
import { CHARACTERS } from '../../constants/characters'
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
})

afterEach(() => clearAdminSession())

describe('AdminAddPlayerModal', () => {
  it('이름을 입력하지 않으면 다음으로 진행할 수 없다', () => {
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('이름 입력')).toBeInTheDocument()
    expect(screen.getByText('다음')).toBeDisabled()
  })

  it('이름 입력 후 다음을 누르면 캐릭터 선택 단계로 넘어가고, 캐릭터를 고르기 전엔 다음이 막힌다', async () => {
    const user = userEvent.setup()
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음'))
    expect(screen.getByText('캐릭터 선택')).toBeInTheDocument()
    expect(screen.getByText('다음')).toBeDisabled()

    await user.click(screen.getByAltText(CHARACTERS[0]))
    expect(screen.getByText('다음')).not.toBeDisabled()
  })

  it('직업/성공열쇠/주식/부동산 단계는 선택 없이도 진행할 수 있고, 마지막 단계는 완료 버튼을 보여준다', async () => {
    const user = userEvent.setup()
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음'))
    await user.click(screen.getByAltText(CHARACTERS[0]))
    await user.click(screen.getByText('다음'))
    expect(screen.getByText('직업 선택')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('성공열쇠')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('주식')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('부동산')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('현금')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('완료를 누르면 입력한 내용으로 등록 API를 호출하고 성공 시 onSaved를 호출한다', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ playerUuid: 'new-1' }) })

    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={onSaved} onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음'))
    await user.click(screen.getByAltText(CHARACTERS[0]))
    for (let i = 0; i < 5; i++) await user.click(screen.getByText('다음'))
    await user.click(screen.getByText('완료'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms/AB1234/players',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({
          name: '홍길동',
          character: CHARACTERS[0],
          job: null,
          badges: [false, false, false, false, false, false],
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          cash: 0,
        }),
      })
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('✕ 클릭 시 확인 팝업을 보여주고, 확인하면 아무 요청도 보내지 않고 닫는다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn()
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByLabelText('닫기'))
    expect(screen.getByText(/지금까지 입력한 내용이 사라집니다/)).toBeInTheDocument()
    await user.click(screen.getByText('취소하기'))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/components/admin/AdminAddPlayerModal.test.jsx`
Expected: FAIL — `AdminAddPlayerModal` 모듈이 아직 없어서 import 단계에서 실패한다.

- [ ] **Step 3: CSS 모듈을 만든다**

`src/components/admin/AdminAddPlayerModal.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
  padding: 20px;
}

.panel {
  display: flex;
  flex-direction: column;
  width: min(480px, 96vw);
  max-height: 92vh;
  background: var(--admin-bg);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(17, 24, 39, 0.28);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 22px;
  background: var(--admin-surface);
  border-bottom: 1px solid var(--admin-border);
  flex-shrink: 0;
}

.header > :first-child { flex: 1; min-width: 0; }

.closeBtn {
  width: 30px;
  height: 30px;
  border-radius: 15px;
  background: var(--admin-border);
  color: var(--admin-text-2);
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 22px 24px;
}

.stepContent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.stepTitle { font-size: 20px; font-weight: 900; color: var(--admin-text); margin: 8px 0 0; }

.stepSubtitle { font-size: 14px; font-weight: 500; color: var(--admin-text-2); margin: 0 0 20px; }

.nameInput {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  padding: 0 16px;
  font-size: 16px;
  color: var(--admin-text);
}

.characterGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.cashCard {
  width: 100%;
  max-width: 320px;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.cashLabel {
  font-size: 12px;
  font-weight: 900;
  color: var(--admin-text-2);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.cashInputBtn {
  height: 52px;
  border-radius: 12px;
  border: 1px solid var(--admin-blue-faint);
  background: var(--admin-blue-soft);
  padding: 0 16px;
  text-align: left;
}

.cashPlaceholder { font-size: 15px; color: var(--admin-text-2); }

.cashValue { font-size: 18px; font-weight: 900; color: var(--admin-text); }

.footer {
  display: flex;
  justify-content: flex-end;
  padding: 14px 22px;
  background: var(--admin-surface);
  border-top: 1px solid var(--admin-border);
  flex-shrink: 0;
}

.nextBtn {
  height: 48px;
  padding: 0 28px;
  border-radius: 14px;
  background: var(--admin-blue);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
}

.nextBtn:disabled { background: var(--admin-disabled); cursor: not-allowed; }
```

- [ ] **Step 4: 컴포넌트를 구현한다**

`src/components/admin/AdminAddPlayerModal.jsx`:

```jsx
import { useState } from 'react'
import StepBar from '../StepBar'
import JobPicker from '../JobPicker'
import BadgePicker from '../BadgePicker'
import AssetListEditor from '../AssetListEditor'
import NumberInputModal from '../NumberInputModal'
import CharacterCard from '../CharacterCard'
import ConfirmDialog from './ConfirmDialog'
import { CHARACTERS } from '../../constants/characters'
import { DEFAULT_PRICES } from '../PriceSettingModal'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES, MAX_CASH,
} from '../../constants/gameData'
import { adminFetch } from '../../utils/adminAuth'
import styles from './AdminAddPlayerModal.module.css'

const STEPS = ['이름', '캐릭터', '직업', '성공열쇠', '주식', '부동산', '현금']

function defaultDraft() {
  return {
    name: '', character: null, job: null,
    badges: [false, false, false, false, false, false],
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
  }
}

function priceLabelsFor(prices, category) {
  return Object.fromEntries(Object.entries(DEFAULT_PRICES[category]).map(([key, defaultPrice]) => [
    key, `${(prices?.[category]?.[key] ?? defaultPrice).toLocaleString('ko-KR')}원`,
  ]))
}

export default function AdminAddPlayerModal({ code, prices, onSaved, onClose }) {
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)
  const [draft, setDraft] = useState(defaultDraft)
  const [cashDisplay, setCashDisplay] = useState('0')
  const [showCashModal, setShowCashModal] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saving, setSaving] = useState(false)

  const isLastStep = step === STEPS.length - 1
  const canAdvance = step === 0 ? draft.name.trim().length > 0
    : step === 1 ? draft.character != null
    : true

  async function handleFinish() {
    if (saving) return
    setSaving(true)
    const cash = Math.min(parseInt(cashDisplay, 10) || 0, MAX_CASH)
    const res = await adminFetch(`/api/admin/rooms/${code}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim(),
        character: draft.character,
        job: draft.job,
        badges: draft.badges,
        stocks: draft.stocks,
        realEstate: draft.realEstate,
        cash,
      }),
    })
    setSaving(false)
    if (!res.ok) return
    onSaved()
  }

  function handleNext() {
    if (!canAdvance) return
    if (isLastStep) { handleFinish(); return }
    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="팀원 직접 등록">
        <div className={styles.header}>
          <StepBar
            steps={STEPS}
            currentStep={step}
            completedUpTo={completedUpTo}
            onStepClick={completedUpTo >= 0 ? setStep : undefined}
          />
          <button type="button" className={styles.closeBtn} onClick={() => setConfirmCancel(true)} aria-label="닫기">✕</button>
        </div>

        <div className={styles.body}>
          {step === 0 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>이름 입력</h2>
              <p className={styles.stepSubtitle}>등록할 팀원의 이름을 입력해주세요</p>
              <input
                className={styles.nameInput}
                placeholder="예) 홍길동"
                value={draft.name}
                onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                maxLength={20}
              />
            </div>
          )}

          {step === 1 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>캐릭터 선택</h2>
              <p className={styles.stepSubtitle}>이 팀원을 대표할 캐릭터를 골라주세요</p>
              <div className={styles.characterGrid}>
                {CHARACTERS.map(id => (
                  <CharacterCard
                    key={id}
                    id={id}
                    state={draft.character === id ? 'selected' : 'idle'}
                    onSelect={character => setDraft(prev => ({ ...prev, character }))}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>직업 선택</h2>
              <p className={styles.stepSubtitle}>이 팀원의 직업을 선택해주세요</p>
              <JobPicker value={draft.job} onChange={job => setDraft(prev => ({ ...prev, job }))} />
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>성공열쇠</h2>
              <p className={styles.stepSubtitle}>획득한 성공열쇠를 모두 선택해주세요</p>
              <BadgePicker
                badges={draft.badges}
                onToggle={i => setDraft(prev => {
                  const badges = [...prev.badges]
                  badges[i] = !badges[i]
                  return { ...prev, badges }
                })}
              />
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>주식</h2>
              <p className={styles.stepSubtitle}>보유 수량을 입력해주세요</p>
              <AssetListEditor
                labels={STOCK_LABELS}
                images={STOCK_IMAGES}
                priceLabels={priceLabelsFor(prices, 'stocks')}
                imageFolder="stock"
                values={draft.stocks}
                onChange={(key, val) => setDraft(prev => ({ ...prev, stocks: { ...prev.stocks, [key]: val } }))}
              />
            </div>
          )}

          {step === 5 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>부동산</h2>
              <p className={styles.stepSubtitle}>보유 수량을 입력해주세요</p>
              <AssetListEditor
                labels={REAL_ESTATE_LABELS}
                images={ESTATE_IMAGES}
                priceLabels={priceLabelsFor(prices, 'realEstate')}
                imageFolder="estate"
                values={draft.realEstate}
                onChange={(key, val) => setDraft(prev => ({ ...prev, realEstate: { ...prev.realEstate, [key]: val } }))}
              />
            </div>
          )}

          {step === 6 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>현금</h2>
              <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
              <div className={styles.cashCard}>
                <span className={styles.cashLabel}>현금 (원)</span>
                <button type="button" className={styles.cashInputBtn} onClick={() => setShowCashModal(true)}>
                  {cashDisplay === '0' ? (
                    <span className={styles.cashPlaceholder}>예: 5000</span>
                  ) : (
                    <span className={styles.cashValue}>{Number(cashDisplay).toLocaleString()}원</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.nextBtn} onClick={handleNext} disabled={!canAdvance || saving}>
            {isLastStep ? '완료' : '다음'}
          </button>
        </div>
      </div>

      {showCashModal && (
        <NumberInputModal
          title="현금 입력"
          initialValue={Number(cashDisplay)}
          unit="원"
          maxValue={MAX_CASH}
          onConfirm={val => { setCashDisplay(String(val)); setShowCashModal(false) }}
          onClose={() => setShowCashModal(false)}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          tone="danger"
          title="입력 취소"
          description="지금까지 입력한 내용이 사라집니다. 취소하시겠습니까?"
          confirmLabel="취소하기"
          cancelLabel="계속 입력"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={onClose}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: 테스트 재실행 — 통과 확인**

Run: `npx vitest run src/components/admin/AdminAddPlayerModal.test.jsx`
Expected: PASS (전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminAddPlayerModal.jsx src/components/admin/AdminAddPlayerModal.module.css src/components/admin/AdminAddPlayerModal.test.jsx
git commit -m "$(cat <<'EOF'
feat: add AdminAddPlayerModal wizard for manual result entry

Reuses the same step components as the participant asset-input
screen (StepBar, JobPicker, BadgePicker, AssetListEditor,
NumberInputModal) inside a popup instead of AdminEditModal's
per-field sub-modals.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 클라이언트 — `AdminSpectateModal`에 "직접 등록하기" 버튼 연결

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx` (import, state, `.actions`, 모달 렌더)
- Modify: `src/components/admin/AdminSpectateModal.module.css`
- Test: `src/components/admin/AdminSpectateModal.test.jsx` (새 `describe` 블록 추가)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/components/admin/AdminSpectateModal.test.jsx` 파일 끝에 다음 블록을 추가한다:

```js
describe('직접 등록하기', () => {
  it('등록 완료되지 않았고 인원이 4명 미만이면 직접 등록하기 버튼을 보여준다', () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('직접 등록하기')).toBeInTheDocument()
  })

  it('등록 완료된 팀에는 직접 등록하기 버튼을 보여주지 않는다', () => {
    const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
    render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('직접 등록하기')).not.toBeInTheDocument()
  })

  it('인원이 4명이면 직접 등록하기 버튼을 보여주지 않는다', () => {
    const fullRoom = makeRoom('AB1234', '김민준')
    fullRoom.players = [0, 1, 2, 3].map(i => ({ ...fullRoom.players[0], playerUuid: `p${i}`, name: `p${i}` }))
    render(<AdminSpectateModal rooms={[fullRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('직접 등록하기')).not.toBeInTheDocument()
  })

  it('직접 등록하기 클릭 시 등록 마법사를 연다', async () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('직접 등록하기'))
    expect(screen.getByText('이름 입력')).toBeInTheDocument()
  })

  it('마법사를 끝까지 진행해 완료하면 onRoomChanged를 호출하고 마법사를 닫는다', async () => {
    const onRoomChanged = vi.fn()
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') return Promise.resolve({ ok: true, json: () => Promise.resolve({ playerUuid: 'new-1' }) })
      return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
    })
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={onRoomChanged} />)
    await userEvent.click(screen.getByText('직접 등록하기'))

    await userEvent.type(screen.getByPlaceholderText('예) 홍길동'), '영희')
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByAltText('Adventurer-강아지'))
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('완료'))

    expect(onRoomChanged).toHaveBeenCalled()
    expect(screen.queryByText('이름 입력')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: FAIL — "직접 등록하기" 텍스트가 아직 렌더링되지 않는다.

- [ ] **Step 3: `AdminSpectateModal.jsx`를 수정한다**

파일 상단 import에 `AdminAddPlayerModal`을 추가한다:

```jsx
// 기존
import AdminTeamAssetsModal from './AdminTeamAssetsModal'
```

```jsx
// 변경 후
import AdminTeamAssetsModal from './AdminTeamAssetsModal'
import AdminAddPlayerModal from './AdminAddPlayerModal'
```

`showDetail` state 옆에 새 state를 추가한다:

```jsx
// 기존
  const [showDetail, setShowDetail] = useState(false)
```

```jsx
// 변경 후
  const [showDetail, setShowDetail] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
```

`.actions` 안에서 "자세히 보기"와 "삭제" 버튼 사이에 새 버튼을 추가한다:

```jsx
// 기존
        <button type="button" className={styles.detailBtn} onClick={() => setShowDetail(true)}>자세히 보기</button>
        <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
```

```jsx
// 변경 후
        <button type="button" className={styles.detailBtn} onClick={() => setShowDetail(true)}>자세히 보기</button>
        {!room.registered && room.players.length < 4 && (
          <button type="button" className={styles.addPlayerBtn} onClick={() => setShowAddPlayer(true)}>직접 등록하기</button>
        )}
        <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
```

`showDetail` 모달 렌더 블록 바로 다음에 새 모달 렌더를 추가한다:

```jsx
// 기존
      {showDetail && (
        <AdminTeamAssetsModal
          room={room}
          prices={room.prices}
          teamLabel={room.title ?? `${index + 1}팀`}
          onClose={() => setShowDetail(false)}
        />
      )}
```

```jsx
// 변경 후
      {showDetail && (
        <AdminTeamAssetsModal
          room={room}
          prices={room.prices}
          teamLabel={room.title ?? `${index + 1}팀`}
          onClose={() => setShowDetail(false)}
        />
      )}

      {showAddPlayer && (
        <AdminAddPlayerModal
          code={room.code}
          prices={room.prices}
          onClose={() => setShowAddPlayer(false)}
          onSaved={() => { setShowAddPlayer(false); onRoomChanged?.() }}
        />
      )}
```

- [ ] **Step 4: `AdminSpectateModal.module.css`에 버튼 스타일을 추가한다**

`.detailBtn` 규칙 바로 다음에 추가한다:

```css
.addPlayerBtn { background: var(--admin-purple-tint); color: var(--admin-purple); border: 1px solid var(--admin-purple); }
```

`registerBtn, deleteBtn, priceBtn, detailBtn`을 공통으로 묶은 선택자에도 `addPlayerBtn`을 추가한다:

```css
/* 기존 */
.registerBtn,
.deleteBtn,
.priceBtn,
.detailBtn {
  height: 45px;
  padding: 0 24px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}
```

```css
/* 변경 후 */
.registerBtn,
.deleteBtn,
.priceBtn,
.detailBtn,
.addPlayerBtn {
  height: 45px;
  padding: 0 24px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}
```

- [ ] **Step 5: 테스트 재실행 — 통과 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "$(cat <<'EOF'
feat: wire up "직접 등록하기" button in AdminSpectateModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 전체 테스트 스위트 확인

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run`
Expected: PASS (전체 통과, 기존 스펙에서 의도적으로 삭제한 `hasDisconnectedPlayer`/`skipped` 관련 테스트 외에는 실패가 없어야 한다)

- [ ] **Step 2: 빌드 확인(선택, 프론트엔드 문법 오류 조기 발견용)**

Run: `npm run build`
Expected: 빌드 성공(0 종료 코드)

- [ ] **Step 3: 수동 QA 메모**

이 저장소는 `test-reports/*.md`에 관리자 흐름을 수동으로 검증한 기록을 남기는 관례가 있다(예: `test-reports/20260918_qa_result.md`). 이번 변경은 실제 브라우저에서 다음을 한 번씩 확인하는 것을 권장한다(자동화된 e2e는 없음):
- 연결 끊긴 팀원이 있는 방에서 "결과 등록"을 눌러 경고 팝업이 뜨고, "예"를 누르면 실제로 등록되는지.
- "전체 등록"에서 같은 경고가 뜨는지.
- 관리자 관전 화면에서 "직접 등록하기"로 7단계를 끝까지 입력한 뒤 완료하면, 그 팀원이 일반 참가자와 동일하게 "수정"/"퇴장" 버튼과 함께 나타나는지.

이 태스크는 커밋할 코드 변경이 없으므로 별도 커밋은 만들지 않는다.
