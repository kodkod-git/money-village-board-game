# 관리자 방 제목 편집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 만드는 방에는 생성 시 `TEAM N` 기본 이름을 붙이고, 관전 화면에서 그 이름을 직접 수정할 수 있게 한다. 학생이 만드는 방은 지금처럼 `{hostName}님의 방`을 계속 보여준다.

**Architecture:** 방 객체(서버 메모리, `server/rooms.js`)와 등록 완료 세션(Supabase `game_sessions`)에 `title` 필드를 추가한다. `classes` 테이블에 `room_counter`를 추가해 수업별로 관리자가 만든 방 번호가 삭제돼도 재사용되지 않게 한다. 프론트엔드는 `AdminGridView`에 제목을 표시하고, `AdminSpectateModal`에서 인라인 입력으로 수정한다.

**Tech Stack:** Express, Supabase(Postgres), React, Vitest, Testing Library

---

### Task 1: `classes` 테이블에 `room_counter` 컬럼 추가 + `incrementRoomCounter()`

**Files:**
- Create: `supabase/migrations/2026-08-12-add-room-title-and-counter.sql`
- Modify: `server/classes.js`
- Test: `server/classes.test.js`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 관리자가 방을 만들 때 기본 이름(TEAM N)에 쓸 수업별 카운터.
-- 방을 삭제해도 번호를 재사용하지 않기 위해 rooms.js(메모리)가 아닌 여기(영속 DB)에 둔다.
ALTER TABLE classes ADD COLUMN room_counter INTEGER NOT NULL DEFAULT 0;

-- 관리자가 만든 방의 표시 이름. 학생이 만든 방은 NULL로 두어 기존 "~님의 방" 표시를 유지한다.
ALTER TABLE game_sessions ADD COLUMN title TEXT;
```

이 파일은 사용자가 Supabase에서 직접 실행해야 한다(에이전트는 프로덕션 DB에 접근할 수 없음).

- [ ] **Step 2: `incrementRoomCounter` 실패 테스트 작성**

`server/classes.test.js`의 `import` 문에 `incrementRoomCounter`를 추가하고, 파일 끝에 추가:

```js
describe('incrementRoomCounter', () => {
  it('현재 room_counter를 읽어 1 증가시키고, 새 값으로 UPDATE한 뒤 그 값을 반환한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { room_counter: 2 }, error: null })
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq })
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    mockFrom.mockImplementation(() => ({ select: mockSelect, update: mockUpdate }))

    const next = await incrementRoomCounter('class-1')

    expect(mockSelect).toHaveBeenCalledWith('room_counter')
    expect(mockSelectEq).toHaveBeenCalledWith('id', 'class-1')
    expect(mockUpdate).toHaveBeenCalledWith({ room_counter: 3 })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'class-1')
    expect(next).toBe(3)
  })

  it('room_counter가 0(기본값)이면 1을 반환한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { room_counter: 0 }, error: null })
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq })
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    mockFrom.mockImplementation(() => ({ select: mockSelect, update: mockUpdate }))

    const next = await incrementRoomCounter('class-1')

    expect(next).toBe(1)
  })
})
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run: `npx vitest run server/classes.test.js -t incrementRoomCounter`
Expected: FAIL — `incrementRoomCounter is not a function` (아직 export 안 됨)

- [ ] **Step 4: `incrementRoomCounter` 구현**

`server/classes.js`에 추가:

```js
export async function incrementRoomCounter(classId) {
  const { data: cls, error: fetchError } = await supabase
    .from('classes')
    .select('room_counter')
    .eq('id', classId)
    .single()
  if (fetchError) throw fetchError

  const next = (cls.room_counter ?? 0) + 1

  const { error: updateError } = await supabase
    .from('classes')
    .update({ room_counter: next })
    .eq('id', classId)
  if (updateError) throw updateError

  return next
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run server/classes.test.js`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/2026-08-12-add-room-title-and-counter.sql server/classes.js server/classes.test.js
git commit -m "feat: add per-class room counter for admin room titles"
```

---

### Task 2: `server/rooms.js`에 `title` 필드와 `updateRoomTitle()` 추가

**Files:**
- Modify: `server/rooms.js`
- Test: `server/rooms.test.js`

- [ ] **Step 1: `createRoom`의 `title` 기본값 테스트 작성**

`server/rooms.test.js`의 `describe('createRoom')` 블록 안에 추가:

```js
  it('title을 지정하지 않으면 null로 초기화한다', () => {
    const room = createRoom()
    expect(room.title).toBeNull()
  })

  it('title을 지정하면 방에 저장한다', () => {
    const room = createRoom({ title: 'TEAM 1' })
    expect(room.title).toBe('TEAM 1')
  })
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run server/rooms.test.js -t "title"`
Expected: FAIL — `room.title`이 `undefined`

- [ ] **Step 3: `createRoom`에 `title` 파라미터 추가**

`server/rooms.js`의 `createRoom` 수정:

```js
export function createRoom({ classId = null, title = null } = {}) {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const now = new Date()
  const room = { code, createdAt: now, updatedAt: now, players: [], prices: defaultPrices(), classId, title }
  rooms.set(code, room)
  return room
}
```

- [ ] **Step 4: `updateRoomTitle` 실패 테스트 작성**

`server/rooms.test.js`에 `import` 목록에 `updateRoomTitle` 추가하고, 파일 끝(또는 `updateRoomPrices` 관련 describe 근처)에 추가:

```js
describe('updateRoomTitle', () => {
  it('방 제목을 변경한다', () => {
    const { code } = createRoom({ title: 'TEAM 1' })
    const room = updateRoomTitle(code, 'TEAM A')
    expect(room.title).toBe('TEAM A')
    expect(getRoom(code).title).toBe('TEAM A')
  })

  it('없는 코드면 null을 반환한다', () => {
    expect(updateRoomTitle('XXXXXX', 'TEAM A')).toBeNull()
  })
})
```

- [ ] **Step 5: 테스트 실행해 실패 확인**

Run: `npx vitest run server/rooms.test.js -t updateRoomTitle`
Expected: FAIL — `updateRoomTitle is not a function`

- [ ] **Step 6: `updateRoomTitle` 구현**

`server/rooms.js`에 `updateRoomPrices` 근처에 추가:

```js
export function updateRoomTitle(code, title) {
  const room = rooms.get(code)
  if (!room) return null
  room.title = title
  return room
}
```

- [ ] **Step 7: 전체 테스트 실행**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (전체)

- [ ] **Step 8: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add room title field and updateRoomTitle helper"
```

---

### Task 3: `server/db.js` — `title` 저장/조회, `updateSessionTitle()`

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: `saveGameResult`가 `title`을 저장하는지 확인하는 테스트 추가**

`server/db.test.js`의 `describe('saveGameResult')` 블록 안, 기존 테스트 뒤에 추가:

```js
  it('room.title이 있으면 game_sessions에 title로 저장한다', async () => {
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
      code: 'AB1234', prices: PRICES, classId: 'class-1', title: 'TEAM 1',
      players: [{
        playerUuid: 'p1', name: '홍길동', affiliation: '서울중', character: 'fox',
        gameState: {
          job: 'a', cash: 10000,
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [false, false, false, false, false, false],
        },
      }],
    }

    await saveGameResult(room)

    expect(mockSessionInsert).toHaveBeenCalledWith(expect.objectContaining({ title: 'TEAM 1' }))
  })
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run server/db.test.js -t "title로 저장"`
Expected: FAIL — `title`이 insert 인자에 없음

- [ ] **Step 3: `saveGameResult`에 `title` 전달 추가**

`server/db.js`의 `saveGameResult` 시그니처와 insert 부분 수정:

```js
export async function saveGameResult(room) {
  const { code, prices, players, classId = null, title = null } = room

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      team_code: code,
      stock_prices: prices.stocks,
      real_estate_prices: prices.realEstate,
      class_id: classId,
      title,
    })
    .select('id')
    .single()

  if (sessionError) throw sessionError
```

(이하 함수 본문은 그대로 유지)

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npx vitest run server/db.test.js -t saveGameResult`
Expected: PASS

- [ ] **Step 5: `getAllCompletedTeams`가 `title`을 포함하는지 확인하는 테스트로 갱신**

`server/db.test.js`의 `describe('getAllCompletedTeams')` 테스트에서 `sessions` 배열에 `title: 'TEAM 1'`을 추가하고, `expect(rooms).toEqual([...])`의 최상위 객체에 `title: 'TEAM 1'`을 추가:

```js
    const sessions = [{
      id: 'session-1', team_code: 'AB1234', created_at: '2026-01-01T00:00:00Z',
      stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
      class_id: 'class-1', title: 'TEAM 1',
    }]
```

```js
    expect(rooms).toEqual([{
      code: 'AB1234',
      status: 'completed',
      registered: true,
      createdAt: '2026-01-01T00:00:00Z',
      classId: 'class-1',
      title: 'TEAM 1',
      prices: { stocks: PRICES.stocks, realEstate: PRICES.realEstate },
      players: [{
```

- [ ] **Step 6: 테스트 실행해 실패 확인**

Run: `npx vitest run server/db.test.js -t getAllCompletedTeams`
Expected: FAIL — 반환 객체에 `title` 없음

- [ ] **Step 7: `getAllCompletedTeams`에 `title` 매핑 추가**

`server/db.js`의 `getAllCompletedTeams`에서 `sessions.map(...)` 반환 객체에 `title: session.title ?? null` 추가:

```js
  return sessions.map(session => ({
    code: session.team_code,
    status: 'completed',
    registered: true,
    createdAt: session.created_at,
    classId: session.class_id ?? null,
    title: session.title ?? null,
    prices: { stocks: session.stock_prices, realEstate: session.real_estate_prices },
```

- [ ] **Step 8: 테스트 실행해 통과 확인**

Run: `npx vitest run server/db.test.js -t getAllCompletedTeams`
Expected: PASS

- [ ] **Step 9: `updateSessionTitle` 실패 테스트 작성**

`server/db.test.js`에 `describe('updateGameResult')` 뒤에 추가:

```js
describe('updateSessionTitle', () => {
  it('team_code로 세션을 찾아 title을 UPDATE한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReset()
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { updateSessionTitle } = await import('./db.js')
    const result = await updateSessionTitle('AB1234', 'TEAM A')

    expect(mockUpdate).toHaveBeenCalledWith({ title: 'TEAM A' })
    expect(mockEq).toHaveBeenCalledWith('team_code', 'AB1234')
    expect(result).toEqual({ id: 'session-1' })
  })

  it('세션을 찾지 못하면 에러를 던진다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReset()
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { updateSessionTitle } = await import('./db.js')

    await expect(updateSessionTitle('AB1234', 'TEAM A')).rejects.toEqual({ message: 'not found' })
  })
})
```

- [ ] **Step 10: 테스트 실행해 실패 확인**

Run: `npx vitest run server/db.test.js -t updateSessionTitle`
Expected: FAIL — `updateSessionTitle is not a function`

- [ ] **Step 11: `updateSessionTitle` 구현**

`server/db.js`에 추가:

```js
export async function updateSessionTitle(teamCode, title) {
  const { data, error } = await supabase
    .from('game_sessions')
    .update({ title })
    .eq('team_code', teamCode)
    .select('id')
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 12: 전체 테스트 실행**

Run: `npx vitest run server/db.test.js`
Expected: PASS (전체)

- [ ] **Step 13: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: persist room title through registration and add updateSessionTitle"
```

---

### Task 4: 서버 라우트 — 방 생성 시 제목 부여, PATCH 라우트 추가

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: import 목록에 신규 함수 추가**

`server/index.js` 상단 import 수정:

```js
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPrices, updateRoomTitle, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder, listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid } from './rooms.js'
import { saveGameResult, getGameResult, getAllRankings, getBoothRankings, getAllCompletedTeams, updateGameResult, updateSessionTitle, deleteCompletedTeam, deleteCompletedTeamsByClassId } from './db.js'
import { createAdmin, verifyAdminPassword, seedMasterAdmin } from './admins.js'
import { signAdminToken, requireAdmin } from './adminAuth.js'
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, incrementRoomCounter, UNASSIGNED_CLASS } from './classes.js'
```

- [ ] **Step 2: `POST /api/admin/rooms`가 `title`을 부여하도록 수정**

`server/index.js`의 해당 라우트를 다음으로 교체:

```js
app.post('/api/admin/rooms', requireAdmin, async (req, res) => {
  const { classId } = req.body ?? {}
  if (!classId) return res.status(400).json({ error: 'classId가 필요합니다' })

  try {
    const allowed = await hasClassAccess(req.admin, classId)
    if (!allowed) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })

    const resolvedClassId = classId === 'unassigned' ? null : classId
    const title = resolvedClassId ? `TEAM ${await incrementRoomCounter(resolvedClassId)}` : null

    const room = createRoom({ classId: resolvedClassId, title })
    broadcastClassRooms(room.classId)
    res.json({ code: room.code })
  } catch (err) {
    console.error('admin room create error:', err)
    res.status(500).json({ error: 'Failed to create room' })
  }
})
```

- [ ] **Step 3: `GET /api/admin/rooms`의 라이브 룸 매핑에 `title` 추가**

`liveRooms` 매핑 객체에 `title: room.title,` 한 줄 추가 (`classId: room.classId,` 다음 줄):

```js
    const liveRooms = listAllRooms().map(room => ({
      code: room.code,
      status: computeLiveRoomStatus(room, now),
      registered: false,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      classId: room.classId,
      title: room.title,
      prices: room.prices,
```

- [ ] **Step 4: `PATCH /api/admin/rooms/:code` 신규 라우트 추가**

`app.delete('/api/admin/rooms/:code', ...)` 바로 위(또는 아래)에 추가:

```js
app.patch('/api/admin/rooms/:code', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const title = req.body?.title?.trim()
  if (!title) return res.status(400).json({ error: 'title이 필요합니다' })

  const classId = await findRoomClassId(code)
  if (classId === undefined) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasClassAccess(req.admin, classId || 'unassigned'))) {
    return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
  }

  const room = updateRoomTitle(code, title)
  if (room) {
    broadcastClassRooms(room.classId)
    return res.json({ title: room.title })
  }

  try {
    await updateSessionTitle(code, title)
    res.json({ title })
  } catch (err) {
    console.error('admin room title update error:', err)
    res.status(404).json({ error: 'Room not found' })
  }
})
```

- [ ] **Step 5: 수동 확인**

기존 레포 컨벤션대로 이 라우트는 HTTP 단위 테스트 대상이 아니다(다른 `/api/admin/rooms/*` 라우트들과 동일). 로컬에서 서버를 띄우고 `curl`로 확인한다:

Run: `npm run dev`로 서버 실행 후, 별도 터미널에서
```bash
curl -X POST http://localhost:3001/api/admin/rooms -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" -d '{"classId":"<class-id>"}'
```
응답의 `code`로:
```bash
curl -X PATCH http://localhost:3001/api/admin/rooms/<code> -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" -d '{"title":"TEAM A"}'
```
Expected: `{"title":"TEAM A"}` 응답.

- [ ] **Step 6: 커밋**

```bash
git add server/index.js
git commit -m "feat: assign default TEAM N title on admin room creation and add title PATCH route"
```

---

### Task 5: `AdminGridView` — 카드에 방 제목 표시

**Files:**
- Modify: `src/components/admin/AdminGridView.jsx`
- Modify: `src/components/admin/AdminGridView.module.css`
- Test: `src/components/admin/AdminGridView.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

`AdminGridView.test.jsx`에 추가:

```js
  it('room.title이 있으면 카드에 제목을 보여준다', () => {
    const roomsWithTitle = [{ ...rooms[0], title: 'TEAM 1' }]
    render(<AdminGridView rooms={roomsWithTitle} onSpectate={vi.fn()} />)
    expect(screen.getByText('TEAM 1')).toBeInTheDocument()
  })

  it('room.title이 없으면 제목을 보여주지 않는다', () => {
    render(<AdminGridView rooms={[rooms[0]]} onSpectate={vi.fn()} />)
    expect(screen.queryByText(/^TEAM /)).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx -t "제목"`
Expected: FAIL — `TEAM 1` 텍스트 없음

- [ ] **Step 3: `AdminGridView.jsx`에 제목 렌더링 추가**

`.slots` 렌더링 직전에 추가:

```jsx
            {room.title && <span className={styles.titleLabel}>{room.title}</span>}
            <div className={styles.slots}>
```

- [ ] **Step 4: CSS 추가**

`AdminGridView.module.css`에 추가:

```css
/* 카드 상단 절대배치 배지(top:12px, 높이 약 27px)와 겹치지 않도록 여유를 둔다 */
.titleLabel {
  display: block;
  font-size: 13px;
  font-weight: 800;
  color: var(--ink);
  text-align: center;
  margin: 28px 0 4px;
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminGridView.jsx src/components/admin/AdminGridView.module.css src/components/admin/AdminGridView.test.jsx
git commit -m "feat: show room title badge on admin grid cards"
```

---

### Task 6: `AdminSpectateModal` — 제목 인라인 편집

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`
- Modify: `src/components/admin/AdminSpectateModal.module.css`
- Test: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

`AdminSpectateModal.test.jsx`에 추가:

```js
it('room.title이 있으면 입력창으로 편집 가능한 제목을 보여준다', () => {
  const room = { ...makeRoom('AB1234', '김민준'), title: 'TEAM 1' }
  render(<AdminSpectateModal rooms={[room]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
  expect(screen.getByDisplayValue('TEAM 1')).toBeInTheDocument()
})

it('room.title이 없으면(학생 생성 방) 편집 입력창을 보여주지 않는다', () => {
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('제목을 바꾸고 blur하면 PATCH 요청을 보내고 onRoomChanged를 호출한다', async () => {
  const onRoomChanged = vi.fn()
  const room = { ...makeRoom('AB1234', '김민준'), title: 'TEAM 1' }
  global.fetch = vi.fn((_url, options) => {
    if (options?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ title: 'TEAM A' }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })

  render(<AdminSpectateModal rooms={[room]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={onRoomChanged} />)
  const input = screen.getByDisplayValue('TEAM 1')
  await userEvent.clear(input)
  await userEvent.type(input, 'TEAM A')
  await userEvent.tab()

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/rooms/AB1234',
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ title: 'TEAM A' }),
    })
  )
  expect(onRoomChanged).toHaveBeenCalled()
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx -t "제목"`
Expected: FAIL — `getByDisplayValue('TEAM 1')`을 찾지 못함

- [ ] **Step 3: `AdminSpectateModal.jsx`에 제목 편집 상태/핸들러 추가**

컴포넌트 상단 상태 선언부(`const [confirmDelete, ...`) 근처에 추가:

```jsx
  const [titleDraft, setTitleDraft] = useState(room.title ?? '')

  useEffect(() => {
    setTitleDraft(room.title ?? '')
  }, [room.code, room.title])
```

`handleKick` 함수 근처에 추가:

```jsx
  async function handleTitleBlur() {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === room.title) return
    const res = await adminFetch(`/api/admin/rooms/${room.code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (!res.ok) {
      setTitleDraft(room.title ?? '')
      return
    }
    onRoomChanged?.()
  }
```

- [ ] **Step 4: `navTitle` JSX를 조건부 입력으로 교체**

```jsx
        <div className={styles.navTitle}>
          {room.title != null ? (
            <input
              className={styles.teamNameInput}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
            />
          ) : (
            <span className={styles.teamName}>{index + 1}팀</span>
          )}
          <span className={styles.teamCount}>{index + 1} / {rooms.length}</span>
        </div>
```

- [ ] **Step 5: `useEffect` import 확인**

파일 상단 import가 `import { useState, useEffect, useRef } from 'react'`인지 확인한다(이미 이렇게 되어 있으므로 수정 불필요).

- [ ] **Step 6: CSS 추가**

`AdminSpectateModal.module.css`의 `.teamName` 규칙 뒤에 추가:

```css
.teamNameInput {
  font-size: 22px;
  font-weight: 900;
  color: var(--ink);
  text-align: center;
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--line);
  width: 140px;
}
```

- [ ] **Step 7: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (전체 — 기존 `1팀 관전 화면을 보여주고` 테스트는 `title`이 없는 픽스처를 쓰므로 그대로 통과해야 함)

- [ ] **Step 8: 커밋**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "feat: allow admins to rename admin-created rooms inline"
```

---

## 참고: 마이그레이션 적용

Task 1의 `supabase/migrations/2026-08-12-add-room-title-and-counter.sql`은 사용자가 Supabase 대시보드(SQL Editor) 또는 `psql`로 직접 실행해야 실제 DB에 반영된다. 이 플랜의 다른 모든 서버 코드는 컬럼이 이미 존재한다고 가정하고 동작한다.
