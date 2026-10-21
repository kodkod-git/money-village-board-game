# 경쟁 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 수업에 "경쟁" 모드를 추가한다. 플레이어는 QR → 이름·캐릭터 → 자산 입력(팀 없음) → 대기 화면 → 결과 화면 순서로 진행한다. 관리자는 팀 현황 페이지의 참여자 블럭에서 드래그 앤 드롭으로 팀을 배정한 뒤 "결과 등록"을 누른다.

**구조:**
- 수업별 대기 명단은 서버 메모리의 새 모듈 `server/classPool.js`에 둔다.
- 배정은 대기 명단과 기존 방(`server/rooms.js`) 사이에서 플레이어 객체를 `gameState` 그대로 옮기는 일이다. 이 규칙은 테스트할 수 있는 순수 모듈 `server/competition.js`에 모으고, `server/index.js`는 HTTP·소켓 연결만 맡는다.
- 화면에서는 `IndividualPage`의 단계 UI를 `AssetInputSteps`로 분리해 새 페이지 `CompetitionPlay`와 함께 쓴다.

**기술 스택:** React 18 + Vite, react-router-dom 7, CSS Modules, vitest + Testing Library(jsdom), Express 5 + socket.io, Supabase(`boardgame` 스키마).

**설계 문서:** `docs/superpowers/specs/2026-10-21-competition-mode-design.md`

**브랜치:** `feat/competition-mode`

### 설계 문서와 달라진 점 (구현하면서 정한 것)

- `findPoolPlayer`와 `findSubmitted`는 `classId`도 받는다: `findPoolPlayer(classId, playerUuid)`, `findSubmitted(classId, playerUuid)`. 다른 수업의 기록과 섞이지 않게 하려는 것이다.
- `update-pool-player-state`는 `classId`·`playerUuid`를 클라이언트 값 대신 `join-class-pool` 때 소켓에 저장한 값(`socket.data.competition`)으로 찾는다.
- 대기 플레이어 소켓을 `class-pool:{classId}` 채널에 넣지 않는다. 그 채널로 보내는 이벤트가 없기 때문이다(YAGNI).
- 화면의 경쟁 모드 판단(팀 코드·★ 숨김, 드래그)은 `room.mode` 대신 **수업 모드 prop**(`competition`)으로 한다. 이미 등록된 팀은 DB에서 오므로 `room.mode`가 없기 때문이다. 서버 방 객체의 `room.mode`는 그대로 둔다(서버 규칙에서 사용).
- `/lobby`에서 경쟁 모드로 되돌려 보내는 처리는 넣지 않는다. 진입은 `CharacterSelect`가 나누고, 반대 방향(`/compete`로 일반 수업에 들어온 경우)은 서버가 `NOT_COMPETITION`으로 거부해 `/lobby`로 보낸다. 로비 테스트가 fetch 호출 횟수를 세고 있어, 모드 조회를 더하면 회귀 위험만 커진다.
- 관리자가 대기 명단에서 삭제한 플레이어에게는 기존 `you-were-kicked` 이벤트를 보낸다. 화면은 안내 후 QR 첫 화면으로 보낸다.
- 경쟁 모드 방의 플레이어는 연결이 끊겨도 10분 뒤 자동으로 빠지지 않는다(대기 명단과 같은 규칙).

---

## 파일 구조

**서버**

| 파일 | 역할 |
|---|---|
| `supabase/migrations/2026-10-21-add-class-mode.sql` (신규) | `classes.mode` 컬럼 |
| `server/classes.js` (수정) | 수업 생성 시 mode 저장, 목록에 mode 포함, `getClassMode` |
| `server/classPool.js` (신규) | 수업별 대기 명단과 제출 기록(메모리) |
| `server/rooms.js` (수정) | `room.mode`, `addAssignedPlayer`, `findRoomByPlayerUuid`, `MAX_PLAYERS` export, 경쟁 방은 연결 끊김 자동 제거 안 함 |
| `server/competition.js` (신규) | 입장·재접속, 상태 저장, 배정, 방 삭제 시 반환, 결과 등록 조건 |
| `server/index.js` (수정) | API·소켓 연결 |

**화면**

| 파일 | 역할 |
|---|---|
| `src/utils/classMode.js` (신규) | `GET /api/classes/:classId/mode` 조회 |
| `src/pages/CharacterSelect.jsx` (수정) | 경쟁 모드면 `/compete/:classId`로 이동 |
| `src/components/AssetInputSteps.jsx` (신규) | 직업→성공열쇠→주식→부동산→현금 단계 UI, `hidePrices` |
| `src/pages/IndividualPage.jsx` (수정) | `AssetInputSteps` 사용 |
| `src/pages/CompetitionPlay.jsx` + `.module.css` (신규) | 경쟁 모드 자산 입력·대기 화면 |
| `src/App.jsx` (수정) | `/compete/:classId` 라우트 |
| `src/pages/AdminClassList.jsx` + `.module.css` (수정) | 일반/경쟁 선택, 경쟁 배지 |
| `src/pages/AdminDashboard.jsx` (수정) | 선택한 수업의 mode 전달 |
| `src/constants/competition.js` (신규) | 드래그 데이터 형식 |
| `src/utils/competitionReadiness.js` (신규) | 결과 등록 가능 여부·이유 문구 |
| `src/components/admin/AdminGridCard.jsx` (수정) | 경쟁 모드: 코드·★ 숨김, 드래그·드롭 |
| `src/components/admin/AdminGridView.jsx` (수정) | prop 전달 |
| `src/components/admin/CompetitionPoolBlock.jsx` + `.module.css` (신규) | 참여자 블럭 |
| `src/pages/AdminClassDashboard.jsx` (수정) | 참여자 블럭·배정·결과 등록 버튼 |
| `src/pages/AdminDashboard.module.css` (수정) | 결과 등록 비활성 이유 문구 |

테스트 실행은 `npx vitest run <파일>`, 전체는 `npm test`(= `vitest run`)로 한다.

---

### Task 1: 수업 모드 — 마이그레이션과 `server/classes.js`

**Files:**
- Create: `supabase/migrations/2026-10-21-add-class-mode.sql`
- Modify: `server/classes.js`
- Test: `server/classes.test.js`

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/2026-10-21-add-class-mode.sql`:

```sql
-- 수업 모드. 'normal'(일반: 학생이 팀을 만들고 참가)과 'competition'(경쟁: 관리자가 팀을 배정)이 있다.
-- 수업을 만들 때 정하고 이후에는 바꾸지 않는다. 기존 수업은 모두 일반 모드가 된다.
ALTER TABLE classes ADD COLUMN mode TEXT NOT NULL DEFAULT 'normal'
  CHECK (mode IN ('normal', 'competition'));
```

- [ ] **Step 2: 실패하는 테스트 작성**

`server/classes.test.js`의 import 줄을 바꾼다:

```js
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, getClassMode, UNASSIGNED_CLASS } from './classes.js'
```

`describe('createClass')`의 기존 테스트를 아래 두 테스트로 바꾼다:

```js
describe('createClass', () => {
  function mockCreate(classRow) {
    const mockClassSingle = vi.fn().mockResolvedValue({ data: classRow, error: null })
    const mockClassSelect = vi.fn().mockReturnValue({ single: mockClassSingle })
    const mockClassInsert = vi.fn().mockReturnValue({ select: mockClassSelect })
    const mockAccessInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation(table => {
      if (table === 'classes') return { insert: mockClassInsert }
      if (table === 'admin_class_access') return { insert: mockAccessInsert }
      throw new Error(`unexpected table: ${table}`)
    })
    return { mockClassInsert, mockClassSelect, mockAccessInsert }
  }

  it('수업을 생성하고 생성자에게 접근권을 부여한다', async () => {
    const { mockClassInsert, mockClassSelect, mockAccessInsert } = mockCreate({ id: 'class-1', name: '3학년 2반', mode: 'normal' })

    const cls = await createClass('  3학년 2반  ', 'admin-1')

    expect(mockClassInsert).toHaveBeenCalledWith({ name: '3학년 2반', created_by: 'admin-1', mode: 'normal' })
    expect(mockClassSelect).toHaveBeenCalledWith('id, name, mode')
    expect(mockAccessInsert).toHaveBeenCalledWith({ admin_id: 'admin-1', class_id: 'class-1' })
    expect(cls).toEqual({ id: 'class-1', name: '3학년 2반', mode: 'normal' })
  })

  it('경쟁 모드를 저장하고, 알 수 없는 모드는 일반 모드로 저장한다', async () => {
    const { mockClassInsert } = mockCreate({ id: 'class-1', name: 'A', mode: 'competition' })
    await createClass('A', 'admin-1', 'competition')
    expect(mockClassInsert).toHaveBeenLastCalledWith({ name: 'A', created_by: 'admin-1', mode: 'competition' })

    await createClass('B', 'admin-1', 'weird')
    expect(mockClassInsert).toHaveBeenLastCalledWith({ name: 'B', created_by: 'admin-1', mode: 'normal' })
  })
})
```

`describe('listClassesForAdmin')`의 두 테스트에서 기대값만 바꾼다(select 문자열과 mode).

첫 번째 테스트(is_super):

```js
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'class-1', name: '3학년 2반', mode: 'competition', created_at: '2026-07-27T00:00:00.000Z' }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(mockSelect).toHaveBeenCalledWith('id, name, mode, created_at')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(classes).toEqual([
      { id: 'class-1', name: '3학년 2반', mode: 'competition', createdAt: '2026-07-27T00:00:00.000Z' },
      { id: 'unassigned', name: UNASSIGNED_CLASS, mode: 'normal' },
    ])
```

두 번째 테스트(일반 관리자)의 기대값(데이터에 mode가 없는 예전 행이면 `normal`):

```js
    expect(mockSelect).toHaveBeenCalledWith('classes(id, name, mode, created_at)')
    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(classes).toEqual([
      { id: 'class-2', name: '최근 수업', mode: 'normal', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'class-1', name: '오래된 수업', mode: 'normal', createdAt: '2026-07-01T00:00:00.000Z' },
    ])
```

파일 끝에 추가:

```js
describe('getClassMode', () => {
  it('수업의 mode를 돌려준다', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { mode: 'competition' }, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    expect(await getClassMode('class-1')).toBe('competition')
    expect(mockFrom).toHaveBeenCalledWith('classes')
    expect(mockSelect).toHaveBeenCalledWith('mode')
    expect(mockEq).toHaveBeenCalledWith('id', 'class-1')
  })

  it('없는 수업이면 normal', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) })
    expect(await getClassMode('nope')).toBe('normal')
  })

  it('미배정 수업이나 빈 값은 DB를 조회하지 않고 normal', async () => {
    expect(await getClassMode('unassigned')).toBe('normal')
    expect(await getClassMode(null)).toBe('normal')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

실행: `npx vitest run server/classes.test.js`
예상: FAIL. `getClassMode`가 export되지 않았고, insert·select 인자가 다르다.

- [ ] **Step 4: 구현**

`server/classes.js`에서 `UNASSIGNED_CLASS` 아래에 추가:

```js
export const CLASS_MODES = ['normal', 'competition']

function normalizeClassMode(mode) {
  return CLASS_MODES.includes(mode) ? mode : 'normal'
}
```

`createClass`를 바꾼다:

```js
export async function createClass(name, adminId, mode = 'normal') {
  const trimmed = name.trim()
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({ name: trimmed, created_by: adminId, mode: normalizeClassMode(mode) })
    .select('id, name, mode')
    .single()
  if (error) throw error
```

(접근권 insert와 `return cls`는 그대로 둔다.)

`listClassesForAdmin`을 바꾼다:

```js
export async function listClassesForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, mode, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return [
      ...data.map(cls => ({ id: cls.id, name: cls.name, mode: normalizeClassMode(cls.mode), createdAt: cls.created_at })),
      { id: 'unassigned', name: UNASSIGNED_CLASS, mode: 'normal' },
    ]
  }

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('classes(id, name, mode, created_at)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data
    .map(row => ({
      id: row.classes.id, name: row.classes.name, mode: normalizeClassMode(row.classes.mode), createdAt: row.classes.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
```

파일 끝에 추가:

```js
// 플레이어 화면 분기와 서버의 경쟁 모드 규칙에 쓴다. 미배정 수업은 일반 모드다.
export async function getClassMode(classId) {
  if (!classId || classId === 'unassigned') return 'normal'
  const { data, error } = await supabase.from('classes').select('mode').eq('id', classId).maybeSingle()
  if (error) throw error
  return normalizeClassMode(data?.mode)
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

실행: `npx vitest run server/classes.test.js`
예상: PASS

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/2026-10-21-add-class-mode.sql server/classes.js server/classes.test.js
git commit -m "feat: add class mode (normal/competition)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 대기 명단 모듈 `server/classPool.js`

**Files:**
- Create: `server/classPool.js`
- Test: `server/classPool.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/classPool.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  joinPool, returnToPool, updatePoolPlayerState, markPoolDisconnected, removeFromPool,
  listPool, findPoolPlayer, deletePool, rememberSubmitted, findSubmitted, clearPools,
} from './classPool.js'
import { defaultGameState } from './rooms.js'

const PROFILE = { playerUuid: 'p1', name: '철수', affiliation: '서울초', character: 'Innovator-사자', socketId: 's1' }

beforeEach(() => clearPools())

describe('joinPool', () => {
  it('새 플레이어를 기본 gameState와 함께 연결된 상태로 넣는다', () => {
    const player = joinPool('class-1', PROFILE)
    expect(player).toMatchObject({ ...PROFILE, connected: true, gameState: defaultGameState() })
    expect(player.joinedAt).toBeInstanceOf(Date)
    expect(listPool('class-1')).toHaveLength(1)
  })

  it('같은 uuid로 다시 들어오면 gameState를 유지하고 socketId만 바꾼다', () => {
    joinPool('class-1', PROFILE)
    const saved = { ...defaultGameState(), cash: 5000, isCompleted: true }
    updatePoolPlayerState('class-1', 'p1', saved)
    markPoolDisconnected('s1')

    const again = joinPool('class-1', { ...PROFILE, socketId: 's2' })

    expect(again.gameState).toEqual(saved)
    expect(again.socketId).toBe('s2')
    expect(again.connected).toBe(true)
    expect(listPool('class-1')).toHaveLength(1)
  })

  it('수업마다 명단이 따로 있다', () => {
    joinPool('class-1', PROFILE)
    joinPool('class-2', { ...PROFILE, playerUuid: 'p2', socketId: 's2' })
    expect(listPool('class-1').map(p => p.playerUuid)).toEqual(['p1'])
    expect(listPool('class-2').map(p => p.playerUuid)).toEqual(['p2'])
    expect(listPool('class-3')).toEqual([])
  })
})

describe('updatePoolPlayerState', () => {
  it('명단에 있는 플레이어의 gameState를 바꾼다', () => {
    joinPool('class-1', PROFILE)
    const next = { ...defaultGameState(), job: 'a' }
    expect(updatePoolPlayerState('class-1', 'p1', next).gameState).toEqual(next)
  })

  it('명단에 없으면 null', () => {
    expect(updatePoolPlayerState('class-1', 'nobody', defaultGameState())).toBeNull()
  })
})

describe('markPoolDisconnected', () => {
  it('socketId로 찾아 연결 끊김으로 표시하고 수업 id를 돌려준다', () => {
    joinPool('class-1', PROFILE)
    expect(markPoolDisconnected('s1')).toBe('class-1')
    expect(findPoolPlayer('class-1', 'p1').connected).toBe(false)
  })

  it('명단에 없는 소켓이면 null', () => {
    expect(markPoolDisconnected('unknown')).toBeNull()
  })
})

describe('removeFromPool / returnToPool', () => {
  it('꺼낸 플레이어를 돌려주고 명단에서 지운다', () => {
    joinPool('class-1', PROFILE)
    const removed = removeFromPool('class-1', 'p1')
    expect(removed.playerUuid).toBe('p1')
    expect(listPool('class-1')).toEqual([])
    expect(removeFromPool('class-1', 'p1')).toBeNull()
  })

  it('방에서 돌아온 플레이어를 gameState·연결 상태 그대로 명단 끝에 넣는다', () => {
    joinPool('class-1', PROFILE)
    const gameState = { ...defaultGameState(), cash: 3000, isCompleted: true }
    returnToPool('class-1', {
      playerUuid: 'p2', name: '영희', affiliation: '', character: 'Adventurer-강아지',
      socketId: 's2', connected: false, gameState, isHost: false,
    })
    const list = listPool('class-1')
    expect(list.map(p => p.playerUuid)).toEqual(['p1', 'p2'])
    expect(list[1]).toMatchObject({ gameState, connected: false, socketId: 's2' })
    expect(list[1]).not.toHaveProperty('isHost')
  })
})

describe('deletePool / 제출 기록', () => {
  it('rememberSubmitted로 남긴 sessionId를 수업·uuid로 찾는다', () => {
    rememberSubmitted('class-1', 'p1', 'session-1')
    expect(findSubmitted('class-1', 'p1')).toBe('session-1')
    expect(findSubmitted('class-2', 'p1')).toBeNull()
  })

  it('deletePool은 명단과 제출 기록을 함께 지운다', () => {
    joinPool('class-1', PROFILE)
    rememberSubmitted('class-1', 'p1', 'session-1')
    deletePool('class-1')
    expect(listPool('class-1')).toEqual([])
    expect(findSubmitted('class-1', 'p1')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run server/classPool.test.js`
예상: FAIL. `./classPool.js`를 찾을 수 없다.

- [ ] **Step 3: 구현**

`server/classPool.js`:

```js
import { defaultGameState } from './rooms.js'

// 경쟁 모드 수업에서 아직 팀에 배정되지 않은 플레이어 명단. 방(rooms.js)처럼 메모리에만 둔다.
// pools: Map<classId, Map<playerUuid, PoolPlayer>>
// PoolPlayer = { playerUuid, name, affiliation, character, socketId, connected, joinedAt, gameState }
const pools = new Map()
// 결과 등록 때 남기는 playerUuid → sessionId. 연결이 끊긴 사이 결과가 등록된 플레이어를 결과 화면으로 보낼 때 쓴다.
// submitted: Map<classId, Map<playerUuid, sessionId>>
const submitted = new Map()

function poolOf(classId) {
  let pool = pools.get(classId)
  if (!pool) {
    pool = new Map()
    pools.set(classId, pool)
  }
  return pool
}

export function joinPool(classId, { playerUuid, name, affiliation = '', character, socketId }) {
  const pool = poolOf(classId)
  const existing = pool.get(playerUuid)
  if (existing) {
    // 재접속: 입력하던 gameState는 그대로 두고 소켓만 바꾼다
    existing.socketId = socketId
    existing.connected = true
    return existing
  }
  const player = {
    playerUuid, name, affiliation, character, socketId,
    connected: true, joinedAt: new Date(), gameState: defaultGameState(),
  }
  pool.set(playerUuid, player)
  return player
}

// 팀에서 빠진 플레이어(방의 player 객체)를 입력 상태 그대로 명단에 되돌린다.
export function returnToPool(classId, { playerUuid, name, affiliation = '', character, socketId = null, connected = true, gameState }) {
  const player = {
    playerUuid, name, affiliation, character, socketId,
    connected, joinedAt: new Date(), gameState: gameState ?? defaultGameState(),
  }
  poolOf(classId).set(playerUuid, player)
  return player
}

export function updatePoolPlayerState(classId, playerUuid, gameState) {
  const player = pools.get(classId)?.get(playerUuid)
  if (!player) return null
  player.gameState = gameState
  return player
}

// 연결이 끊겨도 명단에서 지우지 않는다(관리자가 직접 삭제). 끊긴 플레이어가 있던 수업 id를 돌려준다.
export function markPoolDisconnected(socketId) {
  for (const [classId, pool] of pools) {
    for (const player of pool.values()) {
      if (player.socketId === socketId) {
        player.connected = false
        return classId
      }
    }
  }
  return null
}

export function removeFromPool(classId, playerUuid) {
  const pool = pools.get(classId)
  const player = pool?.get(playerUuid)
  if (!player) return null
  pool.delete(playerUuid)
  return player
}

export function listPool(classId) {
  return [...(pools.get(classId)?.values() ?? [])].sort((a, b) => a.joinedAt - b.joinedAt)
}

export function findPoolPlayer(classId, playerUuid) {
  return pools.get(classId)?.get(playerUuid) ?? null
}

export function deletePool(classId) {
  pools.delete(classId)
  submitted.delete(classId)
}

export function rememberSubmitted(classId, playerUuid, sessionId) {
  let records = submitted.get(classId)
  if (!records) {
    records = new Map()
    submitted.set(classId, records)
  }
  records.set(playerUuid, sessionId)
}

export function findSubmitted(classId, playerUuid) {
  return submitted.get(classId)?.get(playerUuid) ?? null
}

export function clearPools() {
  pools.clear()
  submitted.clear()
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run server/classPool.test.js`
예상: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/classPool.js server/classPool.test.js
git commit -m "feat: add in-memory class pool for competition mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `server/rooms.js` — 방 모드와 배정용 함수

**Files:**
- Modify: `server/rooms.js` (`MAX_PLAYERS` 선언 3행, `createRoom` 50행, `markDisconnected` 141행, 파일 끝)
- Test: `server/rooms.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/rooms.test.js`의 import에 `addAssignedPlayer, findRoomByPlayerUuid, MAX_PLAYERS`를 추가한다:

```js
import {
  createRoom, getRoom, addPlayer, addManualPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPricesByCode, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder,
  listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, updateRoomTitle,
  teamNumbersForClass, addAssignedPlayer, findRoomByPlayerUuid, MAX_PLAYERS,
} from './rooms.js'
```

파일 끝에 추가:

```js
describe('경쟁 모드 방', () => {
  const ASSIGNED = {
    playerUuid: 'p1', name: '철수', affiliation: '서울초', character: 'ptsc', socketId: 's1', connected: true,
    gameState: { cash: 5000, isCompleted: true },
  }

  it('mode를 지정하지 않으면 normal, 지정하면 그 값을 가진다', () => {
    expect(createRoom().mode).toBe('normal')
    expect(createRoom({ mode: 'competition' }).mode).toBe('competition')
  })

  it('addAssignedPlayer는 gameState를 그대로 넣고 팀장이 아닌 플레이어로 추가한다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    const room = addAssignedPlayer(code, ASSIGNED)
    expect(room.players[0]).toMatchObject({ ...ASSIGNED, isHost: false })
    expect(getRoomBySocketId('s1').code).toBe(code)
  })

  it('addAssignedPlayer는 소켓이 없는 플레이어도 받는다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...ASSIGNED, socketId: null })
    expect(getRoom(code).players).toHaveLength(1)
    expect(getRoomBySocketId(null)).toBeNull()
  })

  it('addAssignedPlayer는 4명이 찬 방이면 던진다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    for (let i = 0; i < MAX_PLAYERS; i++) addAssignedPlayer(code, { ...ASSIGNED, playerUuid: `p${i}`, socketId: `s${i}` })
    expect(() => addAssignedPlayer(code, { ...ASSIGNED, playerUuid: 'p9', socketId: 's9' })).toThrow('Room is full')
  })

  it('findRoomByPlayerUuid는 같은 수업의 방에서만 찾는다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, ASSIGNED)
    expect(findRoomByPlayerUuid('class-1', 'p1').code).toBe(code)
    expect(findRoomByPlayerUuid('class-2', 'p1')).toBeNull()
    expect(findRoomByPlayerUuid('class-1', 'nobody')).toBeNull()
  })

  it('경쟁 모드 방은 연결이 끊겨도 유예 시간 뒤 플레이어를 지우지 않는다', () => {
    vi.useFakeTimers()
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, ASSIGNED)
    markDisconnected('s1')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(getRoom(code).players).toHaveLength(1)
    expect(getRoom(code).players[0].connected).toBe(false)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run server/rooms.test.js`
예상: FAIL. `addAssignedPlayer`가 함수가 아니고 `mode`가 undefined다.

- [ ] **Step 3: 구현**

`server/rooms.js` 3행:

```js
export const MAX_PLAYERS = 4
```

`createRoom`:

```js
export function createRoom({ classId = null, title = null, mode = 'normal' } = {}) {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const now = new Date()
  const room = { code, createdAt: now, updatedAt: now, players: [], prices: defaultPrices(), classId, title, mode }
  rooms.set(code, room)
  return room
}
```

`markDisconnected`에서 `player.connected = false` 바로 다음 줄에 추가:

```js
  // 경쟁 모드는 관리자가 배정한 팀이라 자동으로 빼지 않는다(관리자가 직접 정리).
  if (room.mode === 'competition') return room
```

`clearRooms` 위에 추가:

```js
// 경쟁 모드: 대기 명단에서 꺼낸 플레이어를 입력 상태 그대로 팀에 넣는다. 팀장 개념은 쓰지 않는다.
export function addAssignedPlayer(code, { socketId = null, name, character, playerUuid, affiliation = '', connected = true, gameState }) {
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')
  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')
  room.players.push({
    socketId, name, character, isHost: false, playerUuid, affiliation, connected,
    gameState: gameState ?? defaultGameState(),
  })
  if (socketId) socketToRoom.set(socketId, code)
  room.updatedAt = new Date()
  return room
}

export function findRoomByPlayerUuid(classId, playerUuid) {
  for (const room of rooms.values()) {
    if (room.classId === classId && room.players.some(p => p.playerUuid === playerUuid)) return room
  }
  return null
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run server/rooms.test.js`
예상: PASS(기존 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: support competition rooms and assigned players

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 경쟁 모드 규칙 `server/competition.js`

**Files:**
- Create: `server/competition.js`
- Test: `server/competition.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/competition.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  joinCompetition, updateCompetitionPlayerState, assignPlayer, returnRoomPlayersToPool, competitionStatus,
} from './competition.js'
import { createRoom, getRoom, addAssignedPlayer, clearRooms, defaultGameState, getRoomBySocketId } from './rooms.js'
import { joinPool, listPool, findPoolPlayer, rememberSubmitted, clearPools } from './classPool.js'

const profile = (n) => ({ playerUuid: `p${n}`, name: `학생${n}`, affiliation: '', character: `c${n}`, socketId: `s${n}` })
const done = () => ({ ...defaultGameState(), cash: 1000, isCompleted: true })

beforeEach(() => {
  clearRooms()
  clearPools()
})

describe('joinCompetition', () => {
  it('처음 들어오면 대기 명단에 넣고 state pool을 돌려준다', () => {
    const result = joinCompetition('class-1', profile(1))
    expect(result).toEqual({ state: 'pool', gameState: defaultGameState() })
    expect(listPool('class-1')).toHaveLength(1)
  })

  it('팀에 배정된 플레이어가 다시 들어오면 방의 소켓을 바꾸고 state assigned를 돌려준다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...profile(1), gameState: done() })

    const result = joinCompetition('class-1', { ...profile(1), socketId: 's1-new' })

    expect(result).toEqual({ state: 'assigned', roomCode: code, gameState: done() })
    expect(getRoomBySocketId('s1-new').code).toBe(code)
    expect(listPool('class-1')).toEqual([])
  })

  it('결과가 이미 등록됐으면 state submitted와 sessionId를 돌려준다', () => {
    rememberSubmitted('class-1', 'p1', 'session-1')
    expect(joinCompetition('class-1', profile(1))).toEqual({ state: 'submitted', sessionId: 'session-1' })
  })
})

describe('updateCompetitionPlayerState', () => {
  it('대기 명단의 플레이어 상태를 저장한다', () => {
    joinPool('class-1', profile(1))
    expect(updateCompetitionPlayerState('class-1', 'p1', 's1', done())).toEqual({ room: null })
    expect(findPoolPlayer('class-1', 'p1').gameState).toEqual(done())
  })

  it('배정된 플레이어는 방에 저장하고 방을 돌려준다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, profile(1))
    const result = updateCompetitionPlayerState('class-1', 'p1', 's1', done())
    expect(result.room.code).toBe(code)
    expect(getRoom(code).players[0].gameState).toEqual(done())
  })

  it('어디에도 없으면 null', () => {
    expect(updateCompetitionPlayerState('class-1', 'p1', 's1', done())).toBeNull()
  })
})

describe('assignPlayer', () => {
  it('대기 명단 → 팀: gameState를 유지한 채 옮긴다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    joinPool('class-1', profile(1))
    joinCompetition('class-1', profile(1))
    updateCompetitionPlayerState('class-1', 'p1', 's1', done())

    const result = assignPlayer('class-1', 'p1', code)

    expect(result).toMatchObject({ ok: true, fromRoomCode: null, toRoomCode: code })
    expect(result.player.socketId).toBe('s1')
    expect(getRoom(code).players[0]).toMatchObject({ playerUuid: 'p1', gameState: done(), isHost: false })
    expect(listPool('class-1')).toEqual([])
  })

  it('팀 → 다른 팀으로 옮긴다', () => {
    const a = createRoom({ classId: 'class-1', mode: 'competition' })
    const b = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(a.code, { ...profile(1), gameState: done() })

    const result = assignPlayer('class-1', 'p1', b.code)

    expect(result).toMatchObject({ ok: true, fromRoomCode: a.code, toRoomCode: b.code })
    expect(getRoom(a.code).players).toEqual([])
    expect(getRoom(b.code).players[0].gameState).toEqual(done())
  })

  it('팀 → 대기 명단(toRoomCode null): gameState를 유지한다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...profile(1), gameState: done() })

    const result = assignPlayer('class-1', 'p1', null)

    expect(result).toMatchObject({ ok: true, fromRoomCode: code, toRoomCode: null })
    expect(getRoom(code).players).toEqual([])
    expect(findPoolPlayer('class-1', 'p1').gameState).toEqual(done())
    expect(getRoomBySocketId('s1')).toBeNull()
  })

  it('같은 팀으로 다시 놓으면 아무것도 바꾸지 않는다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, profile(1))
    expect(assignPlayer('class-1', 'p1', code)).toMatchObject({ ok: true, fromRoomCode: code, toRoomCode: code })
    expect(getRoom(code).players).toHaveLength(1)
  })

  it('4명이 찬 팀이면 409로 거부하고 플레이어는 제자리에 둔다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    for (let i = 1; i <= 4; i++) addAssignedPlayer(code, profile(i))
    joinPool('class-1', profile(5))

    expect(assignPlayer('class-1', 'p5', code)).toEqual({ ok: false, status: 409, error: '팀 인원이 가득 찼어요 (최대 4명)' })
    expect(findPoolPlayer('class-1', 'p5')).not.toBeNull()
  })

  it('없는 팀(결과 등록으로 사라진 팀 포함)이나 다른 수업의 팀이면 404', () => {
    const other = createRoom({ classId: 'class-2', mode: 'competition' })
    joinPool('class-1', profile(1))
    expect(assignPlayer('class-1', 'p1', 'ZZZZZZ')).toMatchObject({ ok: false, status: 404 })
    expect(assignPlayer('class-1', 'p1', other.code)).toMatchObject({ ok: false, status: 404 })
  })

  it('이미 다른 곳으로 옮겨졌거나 다른 수업의 플레이어면 409', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    joinPool('class-2', profile(1))
    expect(assignPlayer('class-1', 'p1', code)).toEqual({ ok: false, status: 409, error: '이미 다른 곳으로 옮겨진 참여자예요' })
  })
})

describe('returnRoomPlayersToPool', () => {
  it('경쟁 모드 방의 플레이어를 gameState 그대로 대기 명단에 돌려놓는다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...profile(1), gameState: done() })
    addAssignedPlayer(code, profile(2))

    const returned = returnRoomPlayersToPool(code)

    expect(returned.map(p => p.playerUuid)).toEqual(['p1', 'p2'])
    expect(getRoom(code).players).toEqual([])
    expect(listPool('class-1').map(p => p.playerUuid)).toEqual(['p1', 'p2'])
    expect(findPoolPlayer('class-1', 'p1').gameState).toEqual(done())
  })

  it('일반 모드 방은 건드리지 않는다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addAssignedPlayer(code, profile(1))
    expect(returnRoomPlayersToPool(code)).toEqual([])
    expect(getRoom(code).players).toHaveLength(1)
  })
})

describe('competitionStatus', () => {
  it('미배정·입력 중 인원과 등록할 팀 수를 세고, 모두 0이 아니면 준비되지 않았다', () => {
    const a = createRoom({ classId: 'class-1', mode: 'competition' })
    createRoom({ classId: 'class-1', mode: 'competition' }) // 빈 팀은 세지 않는다
    addAssignedPlayer(a.code, { ...profile(1), gameState: done() })
    addAssignedPlayer(a.code, profile(2))
    joinPool('class-1', profile(3))
    joinPool('class-1', profile(4))

    expect(competitionStatus('class-1')).toEqual({ unassigned: 2, inputting: 1, teams: 1, ready: false })
  })

  it('전원 배정·입력 완료면 ready', () => {
    const a = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(a.code, { ...profile(1), gameState: done() })
    expect(competitionStatus('class-1')).toEqual({ unassigned: 0, inputting: 0, teams: 1, ready: true })
  })

  it('팀이 하나도 없으면 ready가 아니다', () => {
    expect(competitionStatus('class-1').ready).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run server/competition.test.js`
예상: FAIL. `./competition.js`를 찾을 수 없다.

- [ ] **Step 3: 구현**

`server/competition.js`:

```js
import {
  getRoom, listAllRooms, addPlayer, addAssignedPlayer, findRoomByPlayerUuid,
  removePlayerByUuid, updatePlayerState, MAX_PLAYERS,
} from './rooms.js'
import {
  joinPool, returnToPool, removeFromPool, updatePoolPlayerState, listPool, findPoolPlayer, findSubmitted,
} from './classPool.js'

const TEAM_NOT_FOUND = '팀을 찾을 수 없어요 (이미 결과가 등록된 팀일 수 있어요)'
const PLAYER_MOVED = '이미 다른 곳으로 옮겨진 참여자예요'
const TEAM_FULL = '팀 인원이 가득 찼어요 (최대 4명)'

// QR로 들어온(또는 다시 들어온) 플레이어를 지금 있어야 할 곳으로 보낸다.
// 결과 등록됨 → 결과 화면, 팀에 배정됨 → 그 방에 재접속, 그 밖에는 대기 명단.
export function joinCompetition(classId, { playerUuid, name, affiliation = '', character, socketId }) {
  const sessionId = findSubmitted(classId, playerUuid)
  if (sessionId) return { state: 'submitted', sessionId }

  const room = findRoomByPlayerUuid(classId, playerUuid)
  if (room) {
    addPlayer(room.code, { socketId, name, character, isHost: false, playerUuid, affiliation })
    const player = room.players.find(p => p.playerUuid === playerUuid)
    return { state: 'assigned', roomCode: room.code, gameState: player.gameState }
  }

  const player = joinPool(classId, { playerUuid, name, affiliation, character, socketId })
  return { state: 'pool', gameState: player.gameState }
}

// 배정 여부와 관계없이 같은 이벤트로 저장한다. 방에 있으면 { room }, 대기 명단이면 { room: null }.
export function updateCompetitionPlayerState(classId, playerUuid, socketId, gameState) {
  const room = updatePlayerState(socketId, gameState)
  if (room) return { room }
  return updatePoolPlayerState(classId, playerUuid, gameState) ? { room: null } : null
}

// toRoomCode가 null이면 대기 명단으로 되돌린다.
export function assignPlayer(classId, playerUuid, toRoomCode) {
  const target = toRoomCode ? getRoom(toRoomCode) : null
  if (toRoomCode && (!target || target.classId !== classId)) {
    return { ok: false, status: 404, error: TEAM_NOT_FOUND }
  }

  const fromRoom = findRoomByPlayerUuid(classId, playerUuid)
  const pooled = fromRoom ? null : findPoolPlayer(classId, playerUuid)
  if (!fromRoom && !pooled) return { ok: false, status: 409, error: PLAYER_MOVED }

  const current = fromRoom ? fromRoom.players.find(p => p.playerUuid === playerUuid) : pooled
  const fromRoomCode = fromRoom?.code ?? null
  // 제자리에 놓은 경우(같은 팀, 또는 대기 명단 → 대기 명단)
  if ((fromRoom && fromRoom === target) || (!fromRoom && !target)) {
    return { ok: true, player: current, fromRoomCode, toRoomCode: target?.code ?? null }
  }
  if (target && target.players.length >= MAX_PLAYERS) return { ok: false, status: 409, error: TEAM_FULL }

  if (fromRoom) removePlayerByUuid(fromRoom.code, playerUuid)
  else removeFromPool(classId, playerUuid)

  if (target) addAssignedPlayer(target.code, current)
  else returnToPool(classId, current)

  return { ok: true, player: current, fromRoomCode, toRoomCode: target?.code ?? null }
}

// 경쟁 모드 방을 지우기 전에 부른다. 플레이어는 지우지 않고 입력 상태 그대로 대기 명단에 돌려놓는다.
export function returnRoomPlayersToPool(code) {
  const room = getRoom(code)
  if (!room || room.mode !== 'competition') return []
  const players = [...room.players]
  for (const player of players) {
    removePlayerByUuid(code, player.playerUuid)
    returnToPool(room.classId, player)
  }
  return players
}

// 결과 등록 조건: 대기 명단이 비었고, 플레이어가 있는 팀의 모든 플레이어가 입력을 마쳤고, 그런 팀이 1개 이상.
export function competitionStatus(classId) {
  const teams = listAllRooms().filter(room => room.classId === classId && room.players.length > 0)
  const unassigned = listPool(classId).length
  const inputting = teams.reduce((count, room) => count + room.players.filter(p => !p.gameState?.isCompleted).length, 0)
  return { unassigned, inputting, teams: teams.length, ready: unassigned === 0 && inputting === 0 && teams.length > 0 }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run server/competition.test.js`
예상: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/competition.js server/competition.test.js
git commit -m "feat: add competition mode assignment rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `server/index.js` — API와 소켓 연결

`server/index.js`는 import하면 서버가 바로 뜨는 구조라 단위 테스트가 없다. 규칙은 Task 1~4에서 테스트했으므로, 여기서는 연결만 하고 문법 검사와 전체 테스트로 확인한다.

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: import 추가**

8행 `rooms.js` import 끝에 아무것도 더하지 않는다(필요한 함수는 이미 있다). 16행을 바꾸고 그 아래에 두 줄을 추가한다:

```js
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, getClassMode, UNASSIGNED_CLASS } from './classes.js'
import { listPool, removeFromPool, markPoolDisconnected, deletePool, rememberSubmitted } from './classPool.js'
import { joinCompetition, updateCompetitionPlayerState, assignPlayer, returnRoomPlayersToPool, competitionStatus } from './competition.js'
```

- [ ] **Step 2: 공개 모드 조회 API**

`app.get('/api/rooms', ...)` 핸들러 바로 위(30행 health check 다음 블록 근처, `broadcastClassRooms` 함수 정의 뒤)에 추가:

```js
// 플레이어 화면이 캐릭터 선택 뒤 일반(로비)/경쟁(자산 입력) 중 어디로 갈지 정할 때 쓴다.
app.get('/api/classes/:classId/mode', async (req, res) => {
  try {
    res.json({ mode: await getClassMode(req.params.classId) })
  } catch (err) {
    console.error('class mode lookup error:', err?.message ?? err)
    res.json({ mode: 'normal' })
  }
})
```

- [ ] **Step 3: 수업 생성·삭제**

`app.post('/api/admin/classes', ...)`에서 두 줄을 바꾼다:

```js
  const { name, mode } = req.body
```

```js
    const cls = await createClass(name, req.admin.adminId, mode)
```

`app.delete('/api/admin/classes/:id', ...)`에서 `deleteRoomsByClassId(id)` 바로 다음 줄에 추가:

```js
    deletePool(id)
```

- [ ] **Step 4: 결과 등록(`submit-pending`)에 경쟁 모드 조건과 제출 기록 추가**

`const resolvedClassId = classId === 'unassigned' ? null : classId` 다음 줄에 추가:

```js
    const competition = resolvedClassId && (await getClassMode(resolvedClassId)) === 'competition'
    if (competition && !competitionStatus(resolvedClassId).ready) {
      return res.status(409).json({ error: '미배정 또는 입력 중인 참여자가 있어요' })
    }
```

반복문 안의 `const sessionId = await saveGameResult(room)` 다음 줄에 추가:

```js
        if (competition) {
          for (const player of room.players) rememberSubmitted(resolvedClassId, player.playerUuid, sessionId)
        }
```

- [ ] **Step 5: 대기 명단·배정 API**

`submit-pending` 핸들러 바로 아래에 추가:

```js
app.get('/api/admin/classes/:classId/pool', requireAdmin, async (req, res) => {
  const { classId } = req.params
  try {
    if (!(await hasClassAccess(req.admin, classId))) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
    res.json(listPool(classId).map(p => ({
      playerUuid: p.playerUuid, name: p.name, character: p.character, affiliation: p.affiliation,
      connected: p.connected, gameState: p.gameState,
    })))
  } catch (err) {
    console.error('pool list error:', err)
    res.status(500).json({ error: 'Failed to fetch pool' })
  }
})

app.delete('/api/admin/classes/:classId/pool/:playerUuid', requireAdmin, async (req, res) => {
  const { classId, playerUuid } = req.params
  try {
    if (!(await hasClassAccess(req.admin, classId))) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
    const removed = removeFromPool(classId, playerUuid)
    if (!removed) return res.status(404).json({ error: 'Player not found' })
    if (removed.socketId) {
      const target = io.sockets.sockets.get(removed.socketId)
      if (target) target.data.competition = null
      io.to(removed.socketId).emit('you-were-kicked')
    }
    broadcastClassRooms(classId)
    res.json({ ok: true })
  } catch (err) {
    console.error('pool delete error:', err)
    res.status(500).json({ error: 'Failed to delete pool player' })
  }
})

app.post('/api/admin/classes/:classId/assign', requireAdmin, async (req, res) => {
  const { classId } = req.params
  const { playerUuid, toRoomCode } = req.body ?? {}
  if (!playerUuid) return res.status(400).json({ error: 'playerUuid가 필요합니다' })
  try {
    if (!(await hasClassAccess(req.admin, classId))) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
    const result = assignPlayer(classId, playerUuid, toRoomCode ? String(toRoomCode).toUpperCase() : null)
    if (!result.ok) return res.status(result.status).json({ error: result.error })

    // 결과 등록 때 보내는 game-submitted를 받도록 플레이어 소켓을 방 채널에 넣고 뺀다.
    const target = result.player.socketId ? io.sockets.sockets.get(result.player.socketId) : null
    if (target && result.fromRoomCode !== result.toRoomCode) {
      if (result.fromRoomCode) target.leave(result.fromRoomCode)
      if (result.toRoomCode) target.join(result.toRoomCode)
    }
    broadcastClassRooms(classId)
    res.json({ ok: true })
  } catch (err) {
    console.error('assign error:', err)
    res.status(500).json({ error: 'Failed to assign player' })
  }
})
```

- [ ] **Step 6: 관리자 방 생성에 수업 모드 복사**

`app.post('/api/admin/rooms', ...)`에서 `const room = createRoom({ classId: resolvedClassId, title })`를 바꾼다:

```js
    const mode = resolvedClassId ? await getClassMode(resolvedClassId) : 'normal'
    const room = createRoom({ classId: resolvedClassId, title, mode })
```

- [ ] **Step 7: 경쟁 모드 방 삭제 시 플레이어를 대기 명단으로**

`app.delete('/api/admin/rooms/:code', ...)`에서 `if (deleteRoomByCode(code)) {` 바로 위에 추가:

```js
  // 경쟁 모드 팀을 지워도 학생 입력은 남기고 대기 명단으로 돌려보낸다.
  for (const player of returnRoomPlayersToPool(code)) {
    if (player.socketId) io.sockets.sockets.get(player.socketId)?.leave(code)
  }
```

- [ ] **Step 8: 소켓 이벤트**

`io.on('connection', ...)` 안, `socket.on('join-room', ...)` 바로 위에 추가:

```js
  socket.on('join-class-pool', async ({ classId, playerUuid, name, affiliation, character } = {}, callback) => {
    if (!classId || !playerUuid || !name || !character) return callback?.({ ok: false, error: 'INVALID' })
    try {
      if ((await getClassMode(classId)) !== 'competition') return callback?.({ ok: false, error: 'NOT_COMPETITION' })
      const result = joinCompetition(classId, { playerUuid, name, affiliation: affiliation ?? '', character, socketId: socket.id })
      if (result.state !== 'submitted') socket.data.competition = { classId, playerUuid }
      if (result.roomCode) socket.join(result.roomCode)
      broadcastClassRooms(classId)
      callback?.({ ok: true, state: result.state, gameState: result.gameState ?? null, sessionId: result.sessionId ?? null })
    } catch (err) {
      console.error('join-class-pool error:', err)
      callback?.({ ok: false, error: err.message })
    }
  })

  socket.on('update-pool-player-state', ({ gameState } = {}) => {
    const info = socket.data.competition
    if (!info || !gameState) return
    const result = updateCompetitionPlayerState(info.classId, info.playerUuid, socket.id, gameState)
    if (!result) return
    if (result.room) io.to(result.room.code).emit('room-updated', { players: result.room.players })
    broadcastClassRooms(info.classId)
  })
```

`socket.on('disconnect', ...)` 핸들러를 바꾼다:

```js
  socket.on('disconnect', () => {
    const poolClassId = markPoolDisconnected(socket.id)
    if (poolClassId) broadcastClassRooms(poolClassId)

    const room = markDisconnected(socket.id)
    if (!room) return
    io.to(room.code).emit('room-updated', { players: room.players })
    // 관리자 대시보드의 "연결 끊김" 배지와 "전체 등록" 경고 문구가 새로고침 없이 갱신되게 한다.
    broadcastClassRooms(room.classId)
  })
```

- [ ] **Step 9: 문법 검사와 서버 테스트**

실행: `node --check server/index.js && npx vitest run server`
예상: 문법 오류 없음, 서버 테스트 모두 PASS

- [ ] **Step 10: 커밋**

```bash
git add server/index.js
git commit -m "feat: wire competition mode APIs and socket events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 캐릭터 선택 후 경쟁 모드로 분기

**Files:**
- Create: `src/utils/classMode.js`
- Modify: `src/pages/CharacterSelect.jsx`
- Test: `src/utils/classMode.test.js`, `src/pages/CharacterSelect.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/utils/classMode.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { fetchClassMode } from './classMode'

describe('fetchClassMode', () => {
  it('수업 모드를 조회한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: 'competition' }) })
    expect(await fetchClassMode('class-1')).toBe('competition')
    expect(fetch).toHaveBeenCalledWith('/api/classes/class-1/mode')
  })

  it('classId가 없거나, 응답이 이상하거나, 요청이 실패하면 normal', async () => {
    global.fetch = vi.fn()
    expect(await fetchClassMode('')).toBe('normal')
    expect(fetch).not.toHaveBeenCalled()

    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await fetchClassMode('class-1')).toBe('normal')

    global.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchClassMode('class-1')).toBe('normal')
  })
})
```

`src/pages/CharacterSelect.test.jsx`를 바꾼다. 첫 줄 import에 `waitFor`를 더하고 `beforeEach`를 import한다:

```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

`import CharacterSelect from './CharacterSelect'` 아래에 추가:

```js
let classMode = 'normal'
beforeEach(() => {
  classMode = 'normal'
  mockNavigate.mockClear()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ mode: classMode }) }))
})
```

기존 두 테스트("URL에 classId가 있으면…", "캐릭터 선택 완료 시 새 로비 화면으로…")의 `expect(mockNavigate)…` 줄을 `await waitFor(() => …)`로 감싸고, 테스트 함수를 `async`로 바꾼다. 예:

```js
  it('캐릭터 선택 완료 시 새 로비 화면으로 이동한다', async () => {
    render(
      <MemoryRouter initialEntries={['/select?name=철수&classId=class-1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/lobby\?/)))
  })
```

`describe` 안 끝에 새 테스트 추가:

```js
  it('경쟁 모드 수업이면 로비 대신 /compete/:classId로 이동한다', async () => {
    classMode = 'competition'
    render(
      <MemoryRouter initialEntries={['/select?name=철수&affiliation=서울초&classId=class-1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/compete\/class-1\?/)))
    const url = new URL(mockNavigate.mock.calls[0][0], 'http://x')
    expect(url.searchParams.get('name')).toBe('철수')
    expect(url.searchParams.get('affiliation')).toBe('서울초')
    expect(url.searchParams.get('character')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/classes/class-1/mode')
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/utils/classMode.test.js src/pages/CharacterSelect.test.jsx`
예상: FAIL. `./classMode`가 없고, 경쟁 모드 테스트에서 `/lobby`로 이동한다.

- [ ] **Step 3: 구현**

`src/utils/classMode.js`:

```js
// 수업 모드('normal' | 'competition')를 조회한다. 알 수 없으면 기존 흐름(일반)을 유지한다.
export function fetchClassMode(classId) {
  if (!classId) return Promise.resolve('normal')
  return fetch(`/api/classes/${encodeURIComponent(classId)}/mode`)
    .then(r => (r.ok ? r.json() : {}))
    .then(data => (data?.mode === 'competition' ? 'competition' : 'normal'))
    .catch(() => 'normal')
}
```

`src/pages/CharacterSelect.jsx`: import에 추가:

```js
import { fetchClassMode } from '../utils/classMode'
```

`const [selected, setSelected] = useState(null)` 아래에 추가:

```js
  const [isSubmitting, setIsSubmitting] = useState(false)
```

`handleSubmit`을 바꾼다:

```js
  async function handleSubmit() {
    if (!selected || isSubmitting) return
    setIsSubmitting(true)
    // 경쟁 모드 수업은 팀을 직접 고르지 않으므로 로비를 건너뛰고 바로 자산 입력으로 간다.
    if (classId && (await fetchClassMode(classId)) === 'competition') {
      const params = new URLSearchParams({ affiliation, name, character: selected })
      navigate(`/compete/${encodeURIComponent(classId)}?${params}`)
      return
    }
    const params = new URLSearchParams({ affiliation, name, character: selected })
    if (code) params.set('code', code)
    if (classId) params.set('classId', classId)
    navigate(`/lobby?${params}`)
  }
```

시작 버튼의 `disabled`를 바꾼다:

```jsx
        <button className={styles.ctaBtn} onClick={handleSubmit} disabled={!selected || isSubmitting}>
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run src/utils/classMode.test.js src/pages/CharacterSelect.test.jsx`
예상: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/utils/classMode.js src/utils/classMode.test.js src/pages/CharacterSelect.jsx src/pages/CharacterSelect.test.jsx
git commit -m "feat: route competition classes from character select to compete page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `AssetInputSteps` 분리 (일반 모드 동작 유지)

**Files:**
- Create: `src/components/AssetInputSteps.jsx`
- Modify: `src/pages/IndividualPage.jsx` (전체 교체)
- Test: `src/components/AssetInputSteps.test.jsx`, 기존 `src/pages/IndividualPage.test.jsx`(수정 없음)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/AssetInputSteps.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssetInputSteps, { defaultGameState } from './AssetInputSteps'

async function goToStocks() {
  await userEvent.click(screen.getByText('다음'))
  await userEvent.click(screen.getByText('다음'))
  expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
}

describe('AssetInputSteps', () => {
  it('가격을 보여준다(기본)', async () => {
    render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await goToStocks()
    expect(screen.getAllByText(/^[\d,]+원$/).length).toBeGreaterThan(0)
  })

  it('hidePrices면 가격을 숨긴다', async () => {
    render(<AssetInputSteps hidePrices gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await goToStocks()
    expect(screen.queryAllByText(/^[\d,]+원$/)).toHaveLength(0)
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산' })).toBeInTheDocument()
    expect(screen.queryAllByText(/^[\d,]+원$/)).toHaveLength(0)
  })

  it('단계를 지날 때 방문 표시를 onChange로 알리고, 완료 시 현금과 isCompleted를 담아 onComplete를 부른다', async () => {
    const onChange = vi.fn()
    const onComplete = vi.fn()
    render(<AssetInputSteps gameState={{ ...defaultGameState(), cash: 3000 }} onChange={onChange} onComplete={onComplete} />)
    await userEvent.click(screen.getByText('다음'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ jobVisited: true }))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('완료'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cash: 3000, isCompleted: true }))
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/components/AssetInputSteps.test.jsx`
예상: FAIL. `./AssetInputSteps`를 찾을 수 없다.

- [ ] **Step 3: `AssetInputSteps` 구현**

`src/components/AssetInputSteps.jsx`. `IndividualPage.jsx`의 19~45행(상수·헬퍼)과 단계 UI(171~307행)를 옮긴 것이다:

```jsx
import { useState, useEffect, useRef } from 'react'
import StepBar from './StepBar'
import JobPicker from './JobPicker'
import BadgePicker from './BadgePicker'
import AssetListEditor from './AssetListEditor'
import NumberInputModal from './NumberInputModal'
import { DEFAULT_PRICES } from './PriceSettingModal'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES, MAX_CASH,
} from '../constants/gameData'
import styles from '../pages/IndividualPage.module.css'

const STEPS = ['직업', '성공열쇠', '주식', '부동산', '현금']
const VISITED_KEY_BY_STEP = { 0: 'jobVisited', 1: 'badgesVisited', 2: 'stocksVisited', 3: 'realEstateVisited' }

function priceLabels(prices, category) {
  return Object.fromEntries(Object.entries(DEFAULT_PRICES[category]).map(([key, defaultPrice]) => [
    key, `${(prices?.[category]?.[key] ?? defaultPrice).toLocaleString('ko-KR')}원`,
  ]))
}

export function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    jobVisited: false, badgesVisited: false, stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}

export function computeCompletedUpTo(gameState) {
  let upTo = -1
  if (gameState.job !== null || gameState.jobVisited) upTo = 0
  if (gameState.badgesVisited) upTo = 1
  if (gameState.stocksVisited) upTo = 2
  if (gameState.realEstateVisited) upTo = 3
  if (gameState.isCompleted) upTo = 4
  return upTo
}

// 직업 → 성공열쇠 → 주식 → 부동산 → 현금 입력 단계. 일반 모드(IndividualPage)와 경쟁 모드(CompetitionPlay)가 함께 쓴다.
// syncToken: 부모가 서버에서 상태를 다시 받아올 때마다 올리면 완료 단계·현금 표시를 그 상태에 맞춘다.
// hidePrices: 경쟁 모드는 입력 시점에 팀·가격이 정해지지 않으므로 수량만 받는다.
export default function AssetInputSteps({ gameState, onChange, onComplete, prices, hidePrices = false, syncToken = 0 }) {
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(() => computeCompletedUpTo(gameState))
  const [cashDisplay, setCashDisplay] = useState(() => String(gameState.cash ?? 0))
  const [showCashModal, setShowCashModal] = useState(false)

  const latestGameState = useRef(gameState)
  latestGameState.current = gameState
  useEffect(() => {
    setCompletedUpTo(computeCompletedUpTo(latestGameState.current))
    setCashDisplay(String(latestGameState.current.cash ?? 0))
  }, [syncToken])

  function handleNext() {
    if (step === 4) { handleComplete(); return }

    const visitedKey = VISITED_KEY_BY_STEP[step]
    if (visitedKey && !gameState[visitedKey]) onChange({ ...gameState, [visitedKey]: true })

    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  function handleComplete() {
    const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
    onComplete({ ...gameState, cash: cashVal, isCompleted: true })
  }

  const noPrices = {}

  return (
    <>
      <StepBar
        steps={STEPS}
        currentStep={step}
        completedUpTo={completedUpTo}
        onStepClick={completedUpTo >= 0 ? i => setStep(i) : undefined}
      />
      <hr className={styles.divider} />

      {step === 0 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>직업 선택</h1>
          <p className={styles.stepSubtitle}>나의 직업을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <JobPicker fill value={gameState.job} onChange={job => onChange({ ...gameState, job })} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>성공열쇠</h1>
          <p className={styles.stepSubtitle}>획득한 성공열쇠를 모두 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <BadgePicker
              fill
              badges={gameState.badges}
              onToggle={i => {
                const badges = [...gameState.badges]
                badges[i] = !badges[i]
                onChange({ ...gameState, badges })
              }}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>부동산</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={REAL_ESTATE_LABELS}
              images={ESTATE_IMAGES}
              priceLabels={hidePrices ? noPrices : priceLabels(prices, 'realEstate')}
              imageFolder="estate"
              values={gameState.realEstate}
              onChange={(key, val) => {
                const realEstate = { ...gameState.realEstate, [key]: val }
                onChange({ ...gameState, realEstate, realEstateVisited: true })
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>주식</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={STOCK_LABELS}
              images={STOCK_IMAGES}
              priceLabels={hidePrices ? noPrices : priceLabels(prices, 'stocks')}
              imageFolder="stock"
              values={gameState.stocks}
              onChange={(key, val) => {
                const stocks = { ...gameState.stocks, [key]: val }
                onChange({ ...gameState, stocks, stocksVisited: true })
              }}
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>현금</h1>
          <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
          <div className={styles.fillWrapper}>
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

          {showCashModal && (
            <NumberInputModal
              title="현금 입력"
              initialValue={Number(cashDisplay)}
              unit="원"
              maxValue={MAX_CASH}
              onConfirm={val => {
                setCashDisplay(String(val))
                setShowCashModal(false)
              }}
              onClose={() => setShowCashModal(false)}
            />
          )}
        </div>
      )}

      <div className={styles.bottomBar}>
        <button className={styles.nextBtn} onClick={handleNext}>
          {step === 4 ? '완료' : '다음'}
        </button>
      </div>
    </>
  )
}
```

주의: 현금 단계의 `{Number(cashDisplay).toLocaleString()}원` 표시는 가격이 아니라 학생이 입력한 금액이므로 `hidePrices`와 관계없이 그대로 둔다.

- [ ] **Step 4: `IndividualPage`를 `AssetInputSteps`로 바꾸기**

`src/pages/IndividualPage.jsx` 전체를 다음으로 바꾼다:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import AssetInputSteps, { defaultGameState } from '../components/AssetInputSteps'
import AlertModal from '../components/AlertModal'
import { DEFAULT_PRICES } from '../components/PriceSettingModal'
import { useSocketContext } from '../contexts/SocketContext'
import useBodyClass from '../hooks/useBodyClass'
import styles from './IndividualPage.module.css'

export default function IndividualPage() {
  useBodyClass('onboarding-mode')
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const [player, setPlayer] = useState(null)
  const [prices, setPrices] = useState(DEFAULT_PRICES)
  const [gameState, setGameState] = useState(defaultGameState)
  // 서버에서 참가자 정보를 다시 받을 때마다 올려서 입력 단계의 완료 표시·현금을 다시 맞춘다.
  const [syncToken, setSyncToken] = useState(0)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  // 강퇴 시 안내 모달을 먼저 띄우고, "확인"을 눌러야 로비로 이동한다.
  const [exitNotice, setExitNotice] = useState(null)

  useEffect(() => {
    if (!socket) return

    function applyPlayer(me) {
      setPlayer(me)
      setGameState(me.gameState ?? defaultGameState())
      setSyncToken(t => t + 1)
    }

    function syncPlayer() {
      fetch(`/api/rooms/${code}`)
        .then(r => r.json())
        .then(data => {
          setPrices(data.prices)
          const me = data.players?.find(p => p.socketId === socket.id)
          if (me) { applyPlayer(me); return }
          const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
          const playerUuid = sessionStorage.getItem('player_uuid')
          if (!stored || stored.code !== code) { navigate(`/team/${code}`); return }
          socket.emit('join-room', {
            code, name: stored.name, affiliation: stored.affiliation,
            character: stored.character, isHost: false, playerUuid,
          }, ({ ok }) => {
            if (!ok) { navigate(`/team/${code}`); return }
            fetch(`/api/rooms/${code}`)
              .then(r => r.json())
              .then(data2 => {
                setPrices(data2.prices)
                const me2 = data2.players?.find(p => p.socketId === socket.id)
                if (!me2) { navigate(`/team/${code}`); return }
                applyPlayer(me2)
              })
              .catch(() => navigate(`/team/${code}`))
          })
        })
        .catch(() => navigate(`/team/${code}`))
    }

    syncPlayer()
    socket.on('connect', syncPlayer)
    return () => socket.off('connect', syncPlayer)
  }, [code, socket, navigate])

  useEffect(() => {
    if (!socket) return
    const handler = ({ prices }) => setPrices(prices)
    socket.on('room-prices-updated', handler)
    return () => socket.off('room-prices-updated', handler)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const handler = () => setExitNotice({
      title: '팀에서 나가게 되었어요',
      message: '방장이 팀에서 내보냈어요.',
    })
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket])

  function goToLobby() {
    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const params = new URLSearchParams({ name: stored?.name ?? '', character: stored?.character ?? '' })
    if (stored?.affiliation) params.set('affiliation', stored.affiliation)
    if (stored?.classId) params.set('classId', stored.classId)
    navigate(`/lobby?${params}`)
  }

  function updateState(next) {
    setGameState(next)
    socket?.emit('update-player-state', { code, gameState: next })
  }

  if (!player) return null

  return (
    <div className={`${styles.page} ${styles.pageFill}`}>
      <BackButton onClick={() => setShowLeaveConfirm(true)} />
      <AssetInputSteps
        gameState={gameState}
        prices={prices}
        syncToken={syncToken}
        onChange={updateState}
        onComplete={next => { updateState(next); navigate(`/team/${code}`) }}
      />

      {showLeaveConfirm && (
        <LeaveConfirmModal
          onConfirm={() => { setShowLeaveConfirm(false); navigate(-1) }}
          onClose={() => setShowLeaveConfirm(false)}
        />
      )}
      {exitNotice && (
        <AlertModal
          title={exitNotice.title}
          message={exitNotice.message}
          onConfirm={() => { setExitNotice(null); goToLobby() }}
        />
      )}
    </div>
  )
}

function LeaveConfirmModal({ onConfirm, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>이전 화면으로 이동</div>
        <p className={styles.confirmText}>
          입력 도중에 뒤로가기 버튼을 누르는 경우, 현재까지 입력한 내용이 사라질 수 있습니다.<br />
          이전 화면으로 돌아가시겠습니까?
        </p>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>이동</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 새 테스트와 기존 `IndividualPage` 테스트가 모두 통과하는지 확인**

실행: `npx vitest run src/components/AssetInputSteps.test.jsx src/pages/IndividualPage.test.jsx`
예상: PASS. `IndividualPage.test.jsx`는 고치지 않았는데도 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/AssetInputSteps.jsx src/components/AssetInputSteps.test.jsx src/pages/IndividualPage.jsx
git commit -m "refactor: extract AssetInputSteps from IndividualPage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 경쟁 모드 플레이어 화면 `CompetitionPlay`

**Files:**
- Create: `src/pages/CompetitionPlay.jsx`, `src/pages/CompetitionPlay.module.css`
- Modify: `src/App.jsx`
- Test: `src/pages/CompetitionPlay.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/CompetitionPlay.test.jsx`:

```jsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CompetitionPlay from './CompetitionPlay'
import { SocketProvider } from '../contexts/SocketContext'
import { defaultGameState } from '../components/AssetInputSteps'

const { socket } = vi.hoisted(() => ({
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' },
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let joinResponse
beforeEach(() => {
  mockNavigate.mockClear()
  socket.on.mockClear()
  socket.emit.mockReset()
  socket.emit.mockImplementation((event, _data, callback) => {
    if (event === 'join-class-pool') callback(joinResponse)
  })
  joinResponse = { ok: true, state: 'pool', gameState: defaultGameState(), sessionId: null }
})

function renderPage(path = '/compete/class-1?name=철수&affiliation=서울초&character=Innovator-사자') {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/compete/:classId" element={<CompetitionPlay />} />
        </Routes>
      </MemoryRouter>
    </SocketProvider>
  )
}

function socketHandler(event) {
  return socket.on.mock.calls.findLast(([ev]) => ev === event)?.[1]
}

describe('CompetitionPlay', () => {
  it('대기 명단에 들어가 가격 없이 자산을 입력하고, 바뀔 때마다 서버에 저장한다', async () => {
    renderPage()
    expect(await screen.findByText('직업 선택')).toBeInTheDocument()
    expect(socket.emit).toHaveBeenCalledWith('join-class-pool', expect.objectContaining({
      classId: 'class-1', name: '철수', affiliation: '서울초', character: 'Innovator-사자', playerUuid: expect.any(String),
    }), expect.any(Function))

    await userEvent.click(screen.getByText('다음'))
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      classId: 'class-1', gameState: expect.objectContaining({ jobVisited: true }),
    }))
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
    expect(screen.queryAllByText(/^[\d,]+원$/)).toHaveLength(0)
  })

  it('입력을 마친 상태면 캐릭터·이름·안내 문구가 있는 대기 화면을 보여준다', async () => {
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), isCompleted: true } }
    renderPage()
    expect(await screen.findByText('결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요')).toBeInTheDocument()
    expect(screen.getByText('철수')).toBeInTheDocument()
    expect(screen.getByAltText('철수')).toHaveAttribute('src', '/characters/Innovator-사자.png')
  })

  it('다시 입력하기를 누르면 입력 중으로 저장하고 입력 단계로 돌아간다', async () => {
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), isCompleted: true } }
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '다시 입력하기' }))
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ isCompleted: false }),
    }))
    expect(screen.getByText('직업 선택')).toBeInTheDocument()
  })

  it('현금 단계에서 완료를 누르면 대기 화면으로 바뀐다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('완료'))
    expect(screen.getByText('결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요')).toBeInTheDocument()
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ isCompleted: true }),
    }))
  })

  it('결과가 등록되면(game-submitted) 결과 화면으로 이동한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    act(() => socketHandler('game-submitted')({ sessionId: 'session-1' }))
    expect(mockNavigate).toHaveBeenCalledWith('/result/session-1')
  })

  it('다시 들어왔을 때 이미 결과가 등록됐으면 결과 화면으로 보낸다', async () => {
    joinResponse = { ok: true, state: 'submitted', gameState: null, sessionId: 'session-9' }
    renderPage()
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/result/session-9', { replace: true }))
  })

  it('일반 모드 수업이면 로비로 보낸다', async () => {
    joinResponse = { ok: false, error: 'NOT_COMPETITION' }
    renderPage()
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/lobby\?.*classId=class-1/), { replace: true }))
  })

  it('관리자가 명단에서 삭제하면 안내 후 QR 첫 화면으로 보낸다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    act(() => socketHandler('you-were-kicked')())
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(mockNavigate).toHaveBeenCalledWith('/join?classId=class-1')
  })

  it('이름이나 캐릭터가 없으면 QR 첫 화면으로 보낸다', async () => {
    renderPage('/compete/class-1')
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/join?classId=class-1', { replace: true }))
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/pages/CompetitionPlay.test.jsx`
예상: FAIL. `./CompetitionPlay`를 찾을 수 없다.

- [ ] **Step 3: 페이지 구현**

`src/pages/CompetitionPlay.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import AssetInputSteps from '../components/AssetInputSteps'
import AlertModal from '../components/AlertModal'
import { useSocketContext } from '../contexts/SocketContext'
import useBodyClass from '../hooks/useBodyClass'
import { getPlayerUuid } from '../utils/playerUuid'
import inputStyles from './IndividualPage.module.css'
import styles from './CompetitionPlay.module.css'

// 경쟁 모드: 팀 없이 자산을 입력하고, 입력을 마치면 관리자가 결과를 등록할 때까지 기다린다.
export default function CompetitionPlay() {
  useBodyClass('onboarding-mode')
  const { classId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const character = searchParams.get('character') ?? ''
  const hasProfile = Boolean(name && character)
  const joinPath = `/join?classId=${encodeURIComponent(classId)}`

  const [gameState, setGameState] = useState(null)
  const [syncToken, setSyncToken] = useState(0)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!hasProfile) navigate(joinPath, { replace: true })
  }, [hasProfile, joinPath, navigate])

  useEffect(() => {
    if (!socket || !hasProfile) return

    function join() {
      socket.emit('join-class-pool', { classId, playerUuid: getPlayerUuid(), name, affiliation, character }, res => {
        if (!res?.ok) {
          if (res?.error === 'NOT_COMPETITION') {
            const params = new URLSearchParams({ affiliation, name, character, classId })
            navigate(`/lobby?${params}`, { replace: true })
          }
          return
        }
        if (res.state === 'submitted') {
          navigate(`/result/${res.sessionId}`, { replace: true })
          return
        }
        setGameState(res.gameState)
        setSyncToken(t => t + 1)
      })
    }

    join()
    socket.on('connect', join)
    return () => socket.off('connect', join)
  }, [socket, hasProfile, classId, name, affiliation, character, navigate])

  useEffect(() => {
    if (!socket) return
    const onSubmitted = ({ sessionId }) => navigate(`/result/${sessionId}`)
    const onKicked = () => setRemoved(true)
    socket.on('game-submitted', onSubmitted)
    socket.on('you-were-kicked', onKicked)
    return () => {
      socket.off('game-submitted', onSubmitted)
      socket.off('you-were-kicked', onKicked)
    }
  }, [socket, navigate])

  function save(next) {
    setGameState(next)
    socket?.emit('update-pool-player-state', { classId, gameState: next })
  }

  if (removed) {
    return (
      <AlertModal
        title="참여 명단에서 빠졌어요"
        message="선생님께 확인한 뒤 QR 코드로 다시 들어와 주세요."
        onConfirm={() => navigate(joinPath)}
      />
    )
  }

  if (!gameState) return null

  if (gameState.isCompleted) {
    return (
      <div className={styles.page}>
        <div className={styles.waitBody}>
          <img src={`/characters/${character}.png`} alt={name} className={styles.character} />
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.message}>결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요</p>
        </div>
        <div className={styles.bottomBar}>
          <button type="button" className={styles.retryBtn} onClick={() => save({ ...gameState, isCompleted: false })}>
            다시 입력하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${inputStyles.page} ${inputStyles.pageFill}`}>
      <AssetInputSteps hidePrices gameState={gameState} syncToken={syncToken} onChange={save} onComplete={save} />
    </div>
  )
}
```

`src/pages/CompetitionPlay.module.css`. 페이지 틀·하단 버튼은 캐릭터 선택 화면과 같은 스타일을 `composes`로 가져온다:

```css
/* 대기 화면은 다른 온보딩 화면(캐릭터 선택)과 같은 프레임·하단 버튼을 쓴다. */
.page {
  composes: page from './CharacterSelect.module.css';
}

.waitBody {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, calc(20px * var(--sy, 1)), 20px);
  text-align: center;
}

.character {
  width: clamp(140px, calc(240px * min(var(--sx, 1), var(--sy, 1))), 240px);
  height: auto;
}

.name {
  font-size: clamp(22px, calc(32px * min(var(--sx, 1), var(--sy, 1))), 32px);
  font-weight: 800;
  color: var(--gray-90, #1a1a1a);
}

.message {
  max-width: 520px;
  font-size: clamp(15px, calc(20px * min(var(--sx, 1), var(--sy, 1))), 20px);
  font-weight: 600;
  line-height: 1.5;
  color: var(--gray-60, #5c5c5c);
  word-break: keep-all;
}

.bottomBar {
  composes: bottomBar from './CharacterSelect.module.css';
}

.retryBtn {
  composes: ctaBtn from './CharacterSelect.module.css';
}
```

주의: `--gray-90`, `--gray-60` 같은 색 토큰은 `src/index.css`에 있는 이름으로 맞춘다. 없으면 대체값이 쓰인다. 구현자는 `grep -n "\-\-gray-" src/index.css`로 확인하고 가장 가까운 토큰으로 바꾼다.

- [ ] **Step 4: 라우트 추가**

`src/App.jsx`의 import 묶음에 추가:

```js
import CompetitionPlay from './pages/CompetitionPlay'
```

`<Route path="/team/:code/individual" element={<IndividualPage />} />` 다음 줄에 추가:

```jsx
        <Route path="/compete/:classId" element={<CompetitionPlay />} />
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

실행: `npx vitest run src/pages/CompetitionPlay.test.jsx`
예상: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/CompetitionPlay.jsx src/pages/CompetitionPlay.module.css src/pages/CompetitionPlay.test.jsx src/App.jsx
git commit -m "feat: add competition player page with waiting screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 수업 생성 시 모드 선택과 경쟁 배지

**Files:**
- Modify: `src/pages/AdminClassList.jsx`, `src/pages/AdminClassList.module.css`, `src/pages/AdminDashboard.jsx`
- Test: `src/pages/AdminClassList.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `CLASSES`는 바꾸지 않는다(만족도 조사·삭제 버튼 개수를 세는 기존 테스트가 있다). 그 아래에 경쟁 수업이 섞인 fixture를 추가한다:

```js
const CLASSES_WITH_COMPETITION = [
  { id: 'class-1', name: '3학년 2반', mode: 'normal', createdAt: '2026-07-27T00:00:00.000Z' },
  { id: 'class-2', name: '경쟁반', mode: 'competition', createdAt: '2026-07-28T00:00:00.000Z' },
  { id: 'unassigned', name: '미배정 수업', mode: 'normal' },
]
```

"수업 클릭 시 onSelectClass를 {id,name}과 함께 호출한다" 테스트의 이름과 기대값을 바꾼다(mode가 없는 예전 응답이면 `normal`로 넘긴다):

```js
  it('수업 클릭 시 onSelectClass를 {id,name,mode}와 함께 호출한다', async () => {
    const onSelectClass = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={onSelectClass} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('3학년 2반'))
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'class-1', name: '3학년 2반', mode: 'normal' })
  })

  it('경쟁 모드 수업을 고르면 mode competition을 넘긴다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(CLASSES_WITH_COMPETITION) })
    const onSelectClass = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={onSelectClass} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('경쟁반'))
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'class-2', name: '경쟁반', mode: 'competition' })
  })
```

"수업 생성하기로 새 수업을 만들면…" 테스트의 body 기대값을 바꾼다:

```js
        body: JSON.stringify({ name: '3학년 3반', mode: 'normal' }),
```

`describe` 안 끝에 추가:

```js
  it('경쟁 모드를 골라 수업을 만들 수 있다', async () => {
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'class-3', name: '경쟁 2반', mode: 'competition' }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CLASSES) })
    })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    expect(screen.getByRole('radio', { name: '일반' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: '경쟁' }))
    await userEvent.type(screen.getByPlaceholderText('새 수업 이름'), '경쟁 2반')
    await userEvent.click(screen.getByText('수업 생성하기'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '경쟁 2반', mode: 'competition' }),
      }))
    )
    await waitFor(() => expect(screen.getByRole('radio', { name: '일반' })).toBeChecked())
  })

  it('경쟁 모드 수업에만 경쟁 배지를 붙인다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(CLASSES_WITH_COMPETITION) })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('경쟁반')
    const badges = screen.getAllByText('경쟁', { selector: 'span' })
    expect(badges).toHaveLength(1)
    expect(badges[0].closest('li')).toHaveTextContent('경쟁반')
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/pages/AdminClassList.test.jsx`
예상: FAIL. 라디오 버튼과 배지가 없고, onSelectClass에 mode가 없다.

- [ ] **Step 3: 구현**

`src/pages/AdminClassList.jsx`:

`formatDate` 아래에 추가:

```js
const CLASS_MODE_OPTIONS = [
  { value: 'normal', label: '일반' },
  { value: 'competition', label: '경쟁' },
]
```

`const [newClassName, setNewClassName] = useState('')` 아래에 추가:

```js
  const [newClassMode, setNewClassMode] = useState('normal')
```

`handleCreateClass`의 body와 성공 처리를 바꾼다:

```js
      body: JSON.stringify({ name: newClassName.trim(), mode: newClassMode }),
```

```js
    setNewClassName('')
    setNewClassMode('normal')
    loadClasses()
```

폼의 input과 버튼 사이에 추가:

```jsx
        <div className={styles.modeGroup} role="radiogroup" aria-label="수업 모드">
          {CLASS_MODE_OPTIONS.map(option => (
            <label key={option.value} className={styles.modeOption}>
              <input
                type="radio"
                name="class-mode"
                value={option.value}
                checked={newClassMode === option.value}
                onChange={() => setNewClassMode(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
```

수업 항목 버튼을 바꾼다:

```jsx
            <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name, mode: cls.mode ?? 'normal' })}>
              <span className={styles.itemName}>{cls.name}</span>
              {cls.mode === 'competition' && <span className={styles.modeBadge}>경쟁</span>}
              {cls.createdAt && <span className={styles.itemDate}>{formatDate(cls.createdAt)}</span>}
            </button>
```

`src/pages/AdminClassList.module.css`의 `.createBtn` 규칙 아래에 추가:

```css
.modeGroup {
  display: flex; align-items: center; gap: 12px; padding: 0 4px;
  font-size: 13px; font-weight: 700; color: var(--admin-text-2);
}
.modeOption { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.modeBadge {
  padding: 2px 8px; border-radius: 999px;
  background: var(--admin-blue); color: white; font-size: 11px; font-weight: 700;
}
```

`src/pages/AdminDashboard.jsx`의 `AdminClassDashboard` 사용부에 mode를 넘긴다:

```jsx
        <AdminClassDashboard
          classId={selectedClass.id}
          initialName={selectedClass.name}
          mode={selectedClass.mode}
        />
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run src/pages/AdminClassList.test.jsx src/pages/AdminDashboard.test.jsx`
예상: PASS(`AdminDashboard.test.jsx`가 없으면 첫 파일만 실행된다)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminClassList.jsx src/pages/AdminClassList.module.css src/pages/AdminClassList.test.jsx src/pages/AdminDashboard.jsx
git commit -m "feat: choose normal/competition mode when creating a class

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 결과 등록 가능 여부 계산 `competitionReadiness`

**Files:**
- Create: `src/utils/competitionReadiness.js`, `src/constants/competition.js`
- Test: `src/utils/competitionReadiness.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/utils/competitionReadiness.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { competitionReadiness } from './competitionReadiness'

const player = (isCompleted) => ({ gameState: { isCompleted } })

describe('competitionReadiness', () => {
  it('미배정·입력 중 인원을 이유로 보여주고 준비되지 않았다고 한다', () => {
    const pool = [player(true), player(false)]
    const rooms = [
      { registered: false, players: [player(true), player(false)] },
      { registered: true, players: [player(false)] }, // 이미 등록된 팀은 세지 않는다
      { registered: false, players: [] },             // 빈 팀도 세지 않는다
    ]
    expect(competitionReadiness(pool, rooms)).toEqual({ ready: false, reason: '미배정 2명 · 입력 중 1명' })
  })

  it('등록할 팀이 없으면 그 이유를 보여준다', () => {
    expect(competitionReadiness([], [{ registered: true, players: [player(true)] }]))
      .toEqual({ ready: false, reason: '등록할 팀이 없어요' })
  })

  it('전원 배정·입력 완료면 준비됐다', () => {
    expect(competitionReadiness([], [{ registered: false, players: [player(true)] }]))
      .toEqual({ ready: true, reason: '' })
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/utils/competitionReadiness.test.js`
예상: FAIL. 모듈이 없다.

- [ ] **Step 3: 구현**

`src/utils/competitionReadiness.js`:

```js
// 경쟁 모드 "결과 등록" 버튼의 활성 여부와 비활성 이유. 서버(server/competition.js의 competitionStatus)와 같은 조건이다.
export function competitionReadiness(pool, rooms) {
  const pendingTeams = rooms.filter(room => !room.registered && room.players.length > 0)
  const unassigned = pool.length
  const inputting = pendingTeams.reduce(
    (count, room) => count + room.players.filter(p => !p?.gameState?.isCompleted).length, 0
  )
  const reasons = []
  if (unassigned > 0) reasons.push(`미배정 ${unassigned}명`)
  if (inputting > 0) reasons.push(`입력 중 ${inputting}명`)
  if (reasons.length === 0 && pendingTeams.length === 0) reasons.push('등록할 팀이 없어요')
  return { ready: reasons.length === 0, reason: reasons.join(' · ') }
}
```

`src/constants/competition.js`:

```js
// 참여자 블럭·팀 카드 사이 드래그 앤 드롭에서 옮기는 값(playerUuid)의 형식.
export const PLAYER_DRAG_TYPE = 'text/plain'
export const TEAM_FULL_MESSAGE = '팀 인원이 가득 찼어요 (최대 4명)'
export const MAX_TEAM_PLAYERS = 4
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run src/utils/competitionReadiness.test.js`
예상: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/utils/competitionReadiness.js src/utils/competitionReadiness.test.js src/constants/competition.js
git commit -m "feat: compute competition result registration readiness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 팀 카드 — 코드·★ 숨김과 드래그 앤 드롭

**Files:**
- Modify: `src/components/admin/AdminGridCard.jsx`, `src/components/admin/AdminGridView.jsx`
- Test: `src/components/admin/AdminGridCard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/admin/AdminGridCard.test.jsx` 첫 줄 import에 `fireEvent`를 더한다:

```js
import { render, screen, fireEvent } from '@testing-library/react'
```

`describe('AdminGridCard')` 안 끝에 추가:

```js
  describe('경쟁 모드', () => {
    const dragOf = (playerUuid) => ({ dataTransfer: { getData: () => playerUuid, setData: vi.fn() } })

    it('팀 코드와 팀장 표시(★)를 숨긴다', () => {
      render(<AdminGridCard competition room={makeRoom()} onSpectate={vi.fn()} onAssign={vi.fn()} />)
      expect(screen.queryByText('AB1234')).toBeNull()
      expect(screen.queryByText('★')).toBeNull()
    })

    it('일반 모드에서는 팀 코드와 ★를 그대로 보여준다', () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      expect(screen.getByText('AB1234')).toBeInTheDocument()
      expect(screen.getByText('★')).toBeInTheDocument()
    })

    it('참여자를 팀 카드에 놓으면 그 팀으로 배정한다', () => {
      const onAssign = vi.fn()
      render(<AdminGridCard competition room={makeRoom()} onSpectate={vi.fn()} onAssign={onAssign} />)
      fireEvent.drop(screen.getByTestId('admin-team-card'), dragOf('p9'))
      expect(onAssign).toHaveBeenCalledWith('p9', 'AB1234')
    })

    it('4명이 찬 팀이나 이미 그 팀에 있는 플레이어는 배정하지 않는다', () => {
      const onAssign = vi.fn()
      const players = [1, 2, 3, 4].map(n => ({ playerUuid: `p${n}`, character: 'Adventurer-강아지', name: `학생${n}` }))
      render(<AdminGridCard competition room={makeRoom({ players })} onSpectate={vi.fn()} onAssign={onAssign} />)
      fireEvent.drop(screen.getByTestId('admin-team-card'), dragOf('p9'))
      fireEvent.drop(screen.getByTestId('admin-team-card'), dragOf('p1'))
      expect(onAssign).not.toHaveBeenCalled()
    })

    it('팀의 플레이어 슬롯을 끌면 playerUuid를 싣는다', () => {
      const room = makeRoom({ players: [{ playerUuid: 'p1', character: 'Adventurer-강아지', name: '김민준' }] })
      render(<AdminGridCard competition room={room} onSpectate={vi.fn()} onAssign={vi.fn()} />)
      const slot = screen.getAllByTestId('admin-player-slot')[0]
      expect(slot).toHaveAttribute('draggable', 'true')
      const setData = vi.fn()
      fireEvent.dragStart(slot, { dataTransfer: { setData } })
      expect(setData).toHaveBeenCalledWith('text/plain', 'p1')
    })

    it('등록 완료된 팀은 드래그·드롭을 받지 않는다', () => {
      const onAssign = vi.fn()
      render(<AdminGridCard competition room={makeRoom({ registered: true })} onSpectate={vi.fn()} onAssign={onAssign} />)
      fireEvent.drop(screen.getByTestId('admin-team-card'), dragOf('p9'))
      expect(onAssign).not.toHaveBeenCalled()
      expect(screen.getAllByTestId('admin-player-slot')[0]).not.toHaveAttribute('draggable')
    })
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/components/admin/AdminGridCard.test.jsx`
예상: FAIL. 코드 배지가 보이고 `admin-team-card`가 없다.

- [ ] **Step 3: 구현**

`src/components/admin/AdminGridCard.jsx`:

import에 추가:

```js
import { toast } from '../../utils/toast'
import { PLAYER_DRAG_TYPE, TEAM_FULL_MESSAGE, MAX_TEAM_PLAYERS } from '../../constants/competition'
```

함수 시그니처를 바꾼다:

```js
// competition: 경쟁 모드 수업. 팀 코드·팀장 표시를 숨기고, onAssign이 있으면 참여자를 끌어다 놓아 배정할 수 있다.
export default function AdminGridCard({ room, index = 0, onSpectate, onRoomChanged, competition = false, onAssign }) {
```

`const priceValues = …` 다음 줄에 추가:

```js
  const canDrag = competition && !room.registered && Boolean(onAssign)

  function handleDrop(e) {
    e.preventDefault()
    const playerUuid = e.dataTransfer.getData(PLAYER_DRAG_TYPE)
    if (!playerUuid || room.players.some(p => p?.playerUuid === playerUuid)) return
    if (room.players.length >= MAX_TEAM_PLAYERS) {
      toast(TEAM_FULL_MESSAGE)
      return
    }
    onAssign(playerUuid, room.code)
  }
```

바깥 wrapper와 코드 배지를 바꾼다:

```jsx
    <div
      className={styles.cardWrapper}
      data-testid="admin-team-card"
      onDragOver={canDrag ? e => e.preventDefault() : undefined}
      onDrop={canDrag ? handleDrop : undefined}
    >
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.titleBadge}>{displayName}</span>
          {!competition && <span className={styles.codeBadge}>{room.code}</span>}
        </div>
```

슬롯 div와 ★를 바꾼다:

```jsx
              <div
                key={i}
                className={styles.slot}
                data-testid="admin-player-slot"
                draggable={canDrag && player ? true : undefined}
                onDragStart={canDrag && player ? e => e.dataTransfer.setData(PLAYER_DRAG_TYPE, player.playerUuid) : undefined}
              >
                {player ? (
                  <>
                    {i === 0 && !competition && <span className={styles.leaderBadge} aria-hidden="true">★</span>}
```

(나머지 슬롯 내용은 그대로 둔다.)

`src/components/admin/AdminGridView.jsx`:

```jsx
// allRooms: 검색 전 전체 목록. 카드의 "팀 N" 번호를 관전 팝업과 같게 전체 목록 순서로 매긴다.
export default function AdminGridView({ rooms, allRooms = rooms, onSpectate, onCreate, onRoomChanged, competition = false, onAssign }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => (
        <AdminGridCard
          key={room.code}
          room={room}
          index={allRooms.findIndex(r => r.code === room.code)}
          onSpectate={onSpectate}
          onRoomChanged={onRoomChanged}
          competition={competition}
          onAssign={onAssign}
        />
      ))}
```

(이후 `onCreate` 카드 부분은 그대로 둔다.)

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run src/components/admin/AdminGridCard.test.jsx src/components/admin/AdminGridView.test.jsx`
예상: PASS(`AdminGridView.test.jsx`가 없으면 첫 파일만 실행된다)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/AdminGridCard.jsx src/components/admin/AdminGridView.jsx src/components/admin/AdminGridCard.test.jsx
git commit -m "feat: hide team code and enable drag-and-drop on competition team cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 참여자 블럭 `CompetitionPoolBlock`

**Files:**
- Create: `src/components/admin/CompetitionPoolBlock.jsx`, `src/components/admin/CompetitionPoolBlock.module.css`
- Test: `src/components/admin/CompetitionPoolBlock.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/admin/CompetitionPoolBlock.test.jsx`:

```jsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CompetitionPoolBlock from './CompetitionPoolBlock'

const PLAYERS = [
  { playerUuid: 'p1', name: '철수', character: 'Innovator-사자', connected: true, gameState: { isCompleted: false } },
  { playerUuid: 'p2', name: '영희', character: 'Adventurer-강아지', connected: true, gameState: { isCompleted: true } },
  { playerUuid: 'p3', name: '민수', character: 'Adventurer-강아지', connected: false, gameState: { isCompleted: true } },
]

describe('CompetitionPoolBlock', () => {
  it('대기 중인 참여자의 캐릭터·이름·상태를 보여준다', () => {
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={vi.fn()} onDelete={vi.fn()} />)
    const block = screen.getByRole('region', { name: '참여자' })
    expect(within(block).getByText('3명 대기 중')).toBeInTheDocument()
    const items = within(block).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('철수입력 중')
    expect(items[1]).toHaveTextContent('영희입력 완료')
    expect(items[2]).toHaveTextContent('민수연결 끊김')
    expect(within(items[0]).getByRole('img')).toHaveAttribute('src', '/characters/Innovator-사자.png')
  })

  it('비어 있으면 안내 문구를 보여준다', () => {
    render(<CompetitionPoolBlock players={[]} onAssign={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('QR로 들어온 참여자가 여기에 표시돼요')).toBeInTheDocument()
  })

  it('삭제 버튼을 누르면 그 참여자로 onDelete를 부른다', async () => {
    const onDelete = vi.fn()
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: '영희 삭제' }))
    expect(onDelete).toHaveBeenCalledWith(PLAYERS[1])
  })

  it('참여자 카드를 끌면 playerUuid를 싣는다', () => {
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={vi.fn()} onDelete={vi.fn()} />)
    const item = screen.getAllByRole('listitem')[0]
    expect(item).toHaveAttribute('draggable', 'true')
    const setData = vi.fn()
    fireEvent.dragStart(item, { dataTransfer: { setData } })
    expect(setData).toHaveBeenCalledWith('text/plain', 'p1')
  })

  it('팀에서 끌어온 플레이어를 놓으면 배정을 취소한다(toRoomCode null)', () => {
    const onAssign = vi.fn()
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={onAssign} onDelete={vi.fn()} />)
    fireEvent.drop(screen.getByRole('region', { name: '참여자' }), { dataTransfer: { getData: () => 'p7' } })
    expect(onAssign).toHaveBeenCalledWith('p7', null)
  })

  it('이미 명단에 있는 플레이어를 다시 놓으면 아무것도 하지 않는다', () => {
    const onAssign = vi.fn()
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={onAssign} onDelete={vi.fn()} />)
    fireEvent.drop(screen.getByRole('region', { name: '참여자' }), { dataTransfer: { getData: () => 'p1' } })
    expect(onAssign).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/components/admin/CompetitionPoolBlock.test.jsx`
예상: FAIL. 모듈이 없다.

- [ ] **Step 3: 구현**

`src/components/admin/CompetitionPoolBlock.jsx`:

```jsx
import { PLAYER_DRAG_TYPE } from '../../constants/competition'
import styles from './CompetitionPoolBlock.module.css'

function statusOf(player) {
  if (player.connected === false) return { label: '연결 끊김', className: styles.statusOff }
  if (player.gameState?.isCompleted) return { label: '입력 완료', className: styles.statusDone }
  return { label: '입력 중', className: styles.statusInput }
}

// 경쟁 모드 팀 현황 페이지: QR로 들어왔지만 아직 팀에 배정되지 않은 참여자.
// 카드를 팀 카드로 끌어 배정하고, 팀의 플레이어를 여기로 끌어오면 배정을 취소한다.
export default function CompetitionPoolBlock({ players, onAssign, onDelete }) {
  function handleDrop(e) {
    e.preventDefault()
    const playerUuid = e.dataTransfer.getData(PLAYER_DRAG_TYPE)
    if (!playerUuid || players.some(p => p.playerUuid === playerUuid)) return
    onAssign(playerUuid, null)
  }

  return (
    <section className={styles.block} aria-label="참여자" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <div className={styles.header}>
        <h2 className={styles.title}>참여자</h2>
        <span className={styles.count}>{players.length}명 대기 중</span>
        <span className={styles.hint}>팀 카드로 끌어다 놓아 배정하세요</span>
      </div>
      {players.length === 0 ? (
        <p className={styles.empty}>QR로 들어온 참여자가 여기에 표시돼요</p>
      ) : (
        <ul className={styles.list}>
          {players.map(player => {
            const status = statusOf(player)
            return (
              <li
                key={player.playerUuid}
                className={styles.item}
                draggable
                onDragStart={e => e.dataTransfer.setData(PLAYER_DRAG_TYPE, player.playerUuid)}
              >
                <img src={`/characters/${player.character}.png`} alt="" className={styles.avatar} />
                <span className={styles.name}>{player.name}</span>
                <span className={`${styles.status} ${status.className}`}>{status.label}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={`${player.name} 삭제`}
                  onClick={() => onDelete(player)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

`src/components/admin/CompetitionPoolBlock.module.css`:

```css
.block {
  margin: 16px 0;
  padding: 16px;
  border: 1px dashed var(--admin-border);
  border-radius: var(--admin-r-md);
  background: var(--admin-bg);
}
.header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.title { font-size: 15px; font-weight: 800; color: var(--admin-text); }
.count { font-size: 13px; font-weight: 700; color: var(--admin-blue); }
.hint { margin-left: auto; font-size: 12px; color: var(--admin-text-3); }
.empty { padding: 16px 0; text-align: center; font-size: 13px; color: var(--admin-text-3); }
.list { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
.item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px 6px 6px;
  border: 1px solid var(--admin-border); border-radius: var(--admin-r-sm);
  background: var(--admin-input-bg, white);
  cursor: grab;
}
.item:active { cursor: grabbing; }
.avatar { width: 32px; height: 32px; object-fit: contain; }
.name { font-size: 13px; font-weight: 700; color: var(--admin-text); }
.status { padding: 2px 6px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.statusInput { background: #fff4e5; color: #b26a00; }
.statusDone { background: #e8f5e9; color: #2e7d32; }
.statusOff { background: #f1f1f1; color: #757575; }
.deleteBtn {
  width: 22px; height: 22px; border: none; border-radius: 50%;
  background: transparent; color: var(--admin-text-3); font-size: 16px; line-height: 1;
}
.deleteBtn:hover { background: #fdecea; color: #e53935; }
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run src/components/admin/CompetitionPoolBlock.test.jsx`
예상: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/CompetitionPoolBlock.jsx src/components/admin/CompetitionPoolBlock.module.css src/components/admin/CompetitionPoolBlock.test.jsx
git commit -m "feat: add competition participant pool block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 팀 현황 페이지에 경쟁 모드 연결

**Files:**
- Modify: `src/pages/AdminClassDashboard.jsx`, `src/pages/AdminDashboard.module.css`
- Test: `src/pages/AdminClassDashboard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/AdminClassDashboard.test.jsx` 첫 줄 import에 `fireEvent`와 `waitFor`를 더한다:

```js
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
```

파일 끝에 추가:

```js
describe('AdminClassDashboard 경쟁 모드', () => {
  const POOL = [
    { playerUuid: 'p9', name: '대기학생', character: 'Innovator-사자', connected: true, gameState: { isCompleted: true } },
  ]

  function mockCompetitionFetch({ pool = POOL, rooms = ROOMS } = {}) {
    global.fetch = vi.fn((url, options) => {
      if (url === '/api/admin/classes/class-1/pool') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(pool) })
      }
      if (options?.method === 'POST' || options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(rooms) })
    })
  }

  function renderCompetition() {
    return render(
      <SocketProvider>
        <AdminClassDashboard classId="class-1" initialName="경쟁반" mode="competition" />
        <Toaster />
      </SocketProvider>
    )
  }

  it('통계 카드와 팀 카드 사이에 참여자 블럭을 보여준다', async () => {
    mockCompetitionFetch()
    renderCompetition()
    const block = await screen.findByRole('region', { name: '참여자' })
    expect(within(block).getByText('대기학생')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1/pool', expect.anything())
  })

  it('팀 코드를 숨기고 버튼 이름은 결과 등록이다', async () => {
    mockCompetitionFetch()
    renderCompetition()
    await screen.findByText('홍길동')
    expect(screen.queryByText('CD5678')).toBeNull()
    expect(screen.getByRole('button', { name: '결과 등록' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전체 등록' })).toBeNull()
  })

  it('미배정·입력 중 참여자가 있으면 결과 등록을 막고 이유를 보여준다', async () => {
    mockCompetitionFetch()
    renderCompetition()
    expect(await screen.findByText('미배정 1명 · 입력 중 1명')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '결과 등록' })).toBeDisabled()
  })

  it('전원 배정·입력 완료면 결과 등록을 누를 수 있다', async () => {
    const doneRooms = ROOMS.map(room => ({
      ...room, players: room.players.map(p => ({ ...p, gameState: { ...p.gameState, isCompleted: true } })),
    }))
    mockCompetitionFetch({ pool: [], rooms: doneRooms })
    renderCompetition()
    await screen.findByText('홍길동')
    await waitFor(() => expect(screen.getByRole('button', { name: '결과 등록' })).toBeEnabled())
  })

  it('참여자를 팀 카드에 놓으면 배정 API를 부른다', async () => {
    mockCompetitionFetch()
    renderCompetition()
    await screen.findByText('대기학생')
    fireEvent.drop(screen.getByTestId('admin-team-card'), { dataTransfer: { getData: () => 'p9' } })
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1/assign', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ playerUuid: 'p9', toRoomCode: 'CD5678' }),
      }))
    )
  })

  it('참여자를 삭제하면 확인 후 삭제 API를 부른다', async () => {
    mockCompetitionFetch()
    renderCompetition()
    await userEvent.click(await screen.findByRole('button', { name: '대기학생 삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1/pool/p9', expect.objectContaining({ method: 'DELETE' }))
    )
  })

  it('일반 모드에서는 참여자 블럭이 없고 대기 명단을 부르지 않는다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    expect(screen.queryByRole('region', { name: '참여자' })).toBeNull()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/classes/class-1/pool', expect.anything())
    expect(screen.getByText('CD5678')).toBeInTheDocument()
  })
})
```

참고: `ConfirmDialog`의 기본 확인 버튼 이름은 `'예'`다. Step 3에서 참여자 삭제 창에 `confirmLabel="삭제"`를 넘기므로 테스트의 버튼 이름 `'삭제'`와 맞는다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

실행: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
예상: 새 `경쟁 모드` 테스트들이 FAIL, 기존 테스트는 PASS

- [ ] **Step 3: 구현**

`src/pages/AdminClassDashboard.jsx`:

import에 추가:

```js
import CompetitionPoolBlock from '../components/admin/CompetitionPoolBlock'
import { competitionReadiness } from '../utils/competitionReadiness'
```

시그니처와 상태:

```js
export default function AdminClassDashboard({ classId, initialName, mode = 'normal' }) {
  const competition = mode === 'competition'
```

`const [resultsError, setResultsError] = useState(false)` 다음에 추가:

```js
  // 경쟁 모드: QR로 들어왔지만 아직 팀에 배정되지 않은 참여자
  const [pool, setPool] = useState([])
  const [poolDeleteTarget, setPoolDeleteTarget] = useState(null)
```

`loadRooms`를 바꾼다(대기 명단도 함께 다시 불러온다. 소켓 `class-rooms-updated`와 모든 갱신 경로가 이 함수를 쓴다):

```js
  const loadRooms = useCallback(() => {
    adminFetch(`/api/admin/rooms?classId=${encodeURIComponent(classId)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
    if (competition) {
      adminFetch(`/api/admin/classes/${encodeURIComponent(classId)}/pool`)
        .then(r => r.json())
        .then(setPool)
        .catch(() => {})
    }
  }, [classId, competition])
```

`hasDisconnectedPendingTeam` 선언 다음에 추가:

```js
  const readiness = competition ? competitionReadiness(pool, rooms) : null
  const registerLabel = competition ? '결과 등록' : '전체 등록'
```

`handleDeleteSelectedPlayers` 다음에 추가:

```js
  async function handleAssign(playerUuid, toRoomCode) {
    try {
      const res = await adminFetch(`/api/admin/classes/${classId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerUuid, toRoomCode }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error || '팀 배정에 실패했습니다')
      }
    } catch {
      toast('팀 배정에 실패했습니다')
    }
    loadRooms()
  }

  async function handleConfirmDeletePoolPlayer() {
    const target = poolDeleteTarget
    setPoolDeleteTarget(null)
    await adminFetch(`/api/admin/classes/${classId}/pool/${target.playerUuid}`, { method: 'DELETE' })
    loadRooms()
  }
```

헤더의 "전체 등록" 버튼을 바꾼다:

```jsx
          {readiness && !readiness.ready && (
            <span className={styles.registerReason}>{readiness.reason}</span>
          )}
          <button
            className={styles.bulkRegisterBtn}
            onClick={() => setConfirmBulkRegister(true)}
            disabled={isBulkRegistering || (readiness !== null && !readiness.ready)}
            type="button"
          >
            <img src="/icons/IconRegister.png" alt="" className={styles.btnIcon} />
            <span>{registerLabel}</span>
          </button>
```

`{rooms.length > 0 && <AdminStatCards rooms={rooms} />}` 다음 줄에 추가:

```jsx
      {competition && (
        <CompetitionPoolBlock players={pool} onAssign={handleAssign} onDelete={setPoolDeleteTarget} />
      )}
```

결과 등록 확인 창의 제목·문구를 바꾼다:

```jsx
      {confirmBulkRegister && (
        <ConfirmDialog
          tone="primary"
          title={registerLabel}
          description={
            competition
              ? '모든 팀의 결과를 등록하고 참여자에게 결과 화면을 보여줄까요?'
              : hasDisconnectedPendingTeam
                ? '연결끊김 상태인 참가자가 존재하고, 일부 참여자에게는 결과화면이 나오지 않을 수 있습니다. 그래도 진행하시겠습니까?'
                : '등록 대기 중인 팀을 모두 결과 등록하시겠습니까?'
          }
          onCancel={() => setConfirmBulkRegister(false)}
          onConfirm={() => { setConfirmBulkRegister(false); handleBulkRegister() }}
        />
      )}

      {poolDeleteTarget && (
        <ConfirmDialog
          tone="danger"
          title="참여자 삭제"
          description={<>'{poolDeleteTarget.name}' 참여자를 명단에서 삭제할까요?<br />입력한 내용도 함께 사라집니다.</>}
          confirmLabel="삭제"
          onCancel={() => setPoolDeleteTarget(null)}
          onConfirm={handleConfirmDeletePoolPlayer}
        />
      )}
```

그리드 뷰에 prop을 넘긴다:

```jsx
            <AdminGridView
              rooms={filteredRooms}
              allRooms={rooms}
              onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))}
              onCreate={classId === 'unassigned' ? undefined : handleCreateRoom}
              onRoomChanged={loadRooms}
              competition={competition}
              onAssign={competition ? handleAssign : undefined}
            />
```

`src/pages/AdminDashboard.module.css` 끝에 추가:

```css
.registerReason {
  align-self: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--admin-text-3);
  white-space: nowrap;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

실행: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
예상: PASS(기존 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminClassDashboard.jsx src/pages/AdminClassDashboard.test.jsx src/pages/AdminDashboard.module.css
git commit -m "feat: competition pool, assignment and result registration on team status page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: 전체 검증

**Files:** 없음(확인만)

- [ ] **Step 1: 전체 테스트**

실행: `npm test`
예상: 모든 테스트 PASS. 실패가 있으면 해당 Task로 돌아가 고친다.

- [ ] **Step 2: 빌드**

실행: `npm run build`
예상: 오류 없이 `dist/` 생성

- [ ] **Step 3: 마이그레이션 적용 안내**

`supabase/migrations/2026-10-21-add-class-mode.sql`은 Supabase SQL 편집기에서 직접 실행해야 한다. 적용 전에는 `listClassesForAdmin`·`createClass`가 없는 `mode` 컬럼을 조회해 실패한다. **배포 전에 사용자에게 적용을 요청한다.**

- [ ] **Step 4: 수동 확인(마이그레이션 적용 후, 로컬 서버 `npm run dev` + 서버)**

1. 관리자: "경쟁"을 골라 수업 생성 → 목록에 "경쟁" 배지.
2. 학생 탭 2개: 수업 QR 주소(`/join?classId=…`) → 이름 → 캐릭터 → 로비 없이 자산 입력 화면, 가격 없음.
3. 관리자 팀 현황: 참여자 블럭에 두 학생이 "입력 중"으로 보임. 결과 등록 버튼 비활성, "미배정 2명" 표시.
4. 방 만들기로 팀 1개 생성 → 팀 코드 배지·★ 없음. 학생 카드를 팀 카드로 끌어 배정, 팀에서 참여자 블럭으로 끌어 배정 취소.
5. 학생이 입력 완료 → 대기 화면(캐릭터·이름·문구). "다시 입력하기" → 관리자 화면에서 "입력 중"으로 바뀌고 결과 등록이 다시 막힘.
6. 전원 배정·입력 완료 → 결과 등록 → 두 학생 화면이 결과 화면으로 이동.
7. 학생 탭 새로고침(결과 등록 전/후) → 각각 입력·대기 화면 복원 / 결과 화면 이동.
8. 일반 모드 수업으로 기존 흐름(로비 → 팀 → 개인 입력 → 전체 등록)이 그대로 동작.

- [ ] **Step 5: 마무리**

모든 확인이 끝나면 `superpowers:finishing-a-development-branch`로 브랜치 마무리 방식을 정한다.
