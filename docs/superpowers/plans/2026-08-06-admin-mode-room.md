# 관리자 모드 — 방 만들기 & 팀코드 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 자신이 접근 가능한 수업 안에서 로비와 같은 방식으로 새 방을 만들 수 있게 하고, 관리자 그리드 뷰의 각 방 카드 왼쪽 상단에 팀코드를 표시한다.

**Architecture:** 서버에 인증된 `POST /api/admin/rooms` 라우트를 추가해 기존 `createRoom()`/`hasClassAccess()`/`broadcastClassRooms()`을 그대로 재사용한다. 빈 방 자동 삭제 로직은 추가하지 않는다 — 관리자가 만든 빈 방은 기존 상태 배지(정체/방치)로 자연히 눈에 띄고, 기존 삭제 기능으로 수동 정리한다. 프론트엔드는 `AdminGridView`에 팀코드 배지와 로비 스타일의 "방 만들기" 카드(`onCreate` prop이 주어졌을 때만 렌더링)를 추가하고, `AdminClassDashboard`가 `classId`가 `unassigned`가 아닐 때만 `onCreate` 콜백을 연결한다.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, Express 5.

**Spec:** `docs/superpowers/specs/2026-08-06-admin-mode-room-design.md`

---

## File Structure Overview

**Modified files:**
- `server/index.js` — `POST /api/admin/rooms` 라우트 추가 (신규 import 불필요, 기존 헬퍼 재사용)
- `src/components/admin/AdminGridView.jsx`, `.module.css`, `.test.jsx` — 팀코드 배지 + "방 만들기" 카드
- `src/pages/AdminClassDashboard.jsx`, `.test.jsx` — 방 생성 핸들러 연결

---

### Task 1: `server/index.js` — `POST /api/admin/rooms` 라우트 추가

**Files:**
- Modify: `server/index.js`

기존 레포 컨벤션대로 HTTP 라우팅 자체는 단위 테스트하지 않는다(다른 `/api/admin/rooms/*` 라우트들과 동일). `createRoom`, `hasClassAccess`, `requireAdmin`, `broadcastClassRooms`는 이미 이 파일에 임포트/정의되어 있으므로 import 변경은 필요 없다. 이 태스크는 수동 확인으로 검증한다.

- [ ] **Step 1: `GET /api/admin/rooms` 라우트 다음, `DELETE /api/admin/rooms/:code` 라우트 앞에 새 라우트 삽입**

`server/index.js`에서 아래 두 라우트 사이(222번째 줄의 `GET /api/admin/rooms` 핸들러가 끝나는 `})`와 224번째 줄의 `app.delete('/api/admin/rooms/:code', ...)` 사이)에 삽입한다:

```js
// server/index.js — app.get('/api/admin/rooms', ...) 핸들러 다음, app.delete('/api/admin/rooms/:code', ...) 앞에 삽입
app.post('/api/admin/rooms', requireAdmin, async (req, res) => {
  const { classId } = req.body ?? {}
  if (!classId) return res.status(400).json({ error: 'classId가 필요합니다' })

  try {
    const allowed = await hasClassAccess(req.admin, classId)
    if (!allowed) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })

    const room = createRoom({ classId: classId === 'unassigned' ? null : classId })
    broadcastClassRooms(room.classId)
    res.json({ code: room.code })
  } catch (err) {
    console.error('admin room create error:', err)
    res.status(500).json({ error: 'Failed to create room' })
  }
})
```

- [ ] **Step 2: 수동으로 서버를 띄워 확인**

Run: `npm run dev`

다른 터미널에서 관리자로 로그인 후(개발 환경에는 `admin`/`0000` 마스터 계정이 시드되어 있다), 발급받은 토큰으로 방 생성을 확인한다:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"0000"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

curl -X POST http://localhost:3001/api/admin/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"classId":"unassigned"}'

curl http://localhost:3001/api/admin/rooms?classId=unassigned \
  -H "Authorization: Bearer $TOKEN"
```

Expected: 첫 번째 요청은 `{"code":"XXXXXX"}` 형태의 새 코드를 반환한다. 두 번째 요청의 응답 배열에 방금 만든 방이 `players: []` 상태로 포함되어 있다. 토큰 없이 첫 요청을 다시 보내면 `401`이 반환되는지도 확인한다.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add authenticated room creation route for admins"
```

---

### Task 2: `AdminGridView` — 각 카드 좌상단에 팀코드 배지 표시

**Files:**
- Modify: `src/components/admin/AdminGridView.jsx`
- Modify: `src/components/admin/AdminGridView.module.css`
- Modify: `src/components/admin/AdminGridView.test.jsx`

기존 테스트 하나가 "팀코드를 보여주지 않는다"를 검증하고 있다 — 이번 작업으로 정반대 요구사항이 됐으므로 해당 테스트를 교체한다.

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminGridView.test.jsx`의 맨 처음 `it` 블록(1번째 테스트, `'does not show team codes inside room cards'`)을 통째로 교체:

```js
// src/components/admin/AdminGridView.test.jsx — 첫 번째 it 블록을 교체
it('각 카드 왼쪽 상단에 팀코드를 보여준다', () => {
  render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)

  expect(screen.getByText('AB1234')).toBeInTheDocument()
  expect(screen.getByText('GH3456')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: FAIL — `getByText('AB1234')`가 요소를 찾지 못함

- [ ] **Step 3: Write the implementation**

`src/components/admin/AdminGridView.jsx`에서 `<button>` 안 첫 자식으로 배지를 추가:

```jsx
// src/components/admin/AdminGridView.jsx — <button ...> 안, {room.registered && ...} 위에 추가
<span className={styles.codeBadge}>{room.code}</span>
```

`src/components/admin/AdminGridView.module.css`의 `.badge` 규칙 다음에 추가:

```css
/* src/components/admin/AdminGridView.module.css — .badge 규칙 다음에 추가 */
.codeBadge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-2);
  background: var(--slot-empty);
  border-radius: var(--r-pill);
  padding: 4px 10px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminGridView.jsx src/components/admin/AdminGridView.module.css src/components/admin/AdminGridView.test.jsx
git commit -m "feat: show team code badge on each admin room card"
```

---

### Task 3: `AdminGridView` — "방 만들기" 카드 추가

**Files:**
- Modify: `src/components/admin/AdminGridView.jsx`
- Modify: `src/components/admin/AdminGridView.module.css`
- Modify: `src/components/admin/AdminGridView.test.jsx`

`onCreate` prop이 주어졌을 때만 카드를 렌더링한다 — 이 컴포넌트는 `classId`나 "unassigned" 개념을 몰라도 되고, 노출 여부는 호출하는 쪽(`AdminClassDashboard`, Task 4)이 결정한다.

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminGridView.test.jsx` 파일 끝에 추가:

```js
// src/components/admin/AdminGridView.test.jsx — 파일 끝에 추가
it('onCreate가 주어지면 방 만들기 카드를 보여준다', () => {
  render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} onCreate={vi.fn()} />)
  expect(screen.getByText('방 만들기')).toBeInTheDocument()
})

it('onCreate가 없으면 방 만들기 카드를 보여주지 않는다', () => {
  render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
  expect(screen.queryByText('방 만들기')).not.toBeInTheDocument()
})

it('방 만들기 카드 클릭 시 onCreate를 호출한다', async () => {
  const onCreate = vi.fn()
  render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} onCreate={onCreate} />)
  await userEvent.click(screen.getByText('방 만들기'))
  expect(onCreate).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: FAIL — 새 3개 테스트에서 "방 만들기" 텍스트를 찾지 못하거나 `onCreate`가 호출되지 않음

- [ ] **Step 3: Write the implementation**

`src/components/admin/AdminGridView.jsx` 전체를 아래로 교체:

```jsx
// src/components/admin/AdminGridView.jsx (전체 교체)
import { ROOM_STATUS_LABELS } from '../../constants/gameData'
import styles from './AdminGridView.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

export default function AdminGridView({ rooms, onSpectate, onCreate }) {
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
            <span className={styles.codeBadge}>{room.code}</span>
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
                      {player.connected === false && (
                        <span className={styles.disconnectedBadge}>연결 끊김</span>
                      )}
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
      {onCreate && (
        <button className={styles.createCard} onClick={onCreate} type="button">
          <span className={styles.createIcon} aria-hidden="true">+</span>
          <span className={styles.createLabel}>방 만들기</span>
        </button>
      )}
    </div>
  )
}
```

`src/components/admin/AdminGridView.module.css` 파일 끝에 추가:

```css
/* src/components/admin/AdminGridView.module.css — 파일 끝에 추가 */
.createCard {
  min-height: 276px;
  border-radius: var(--r-sm);
  border: 1px dashed var(--ghost);
  background: var(--white);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}

.createIcon {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: var(--purple);
}

.createLabel {
  font-size: 13px;
  font-weight: 800;
  color: var(--purple);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminGridView.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminGridView.jsx src/components/admin/AdminGridView.module.css src/components/admin/AdminGridView.test.jsx
git commit -m "feat: add create-room card to AdminGridView"
```

---

### Task 4: `AdminClassDashboard` — 방 생성 핸들러 연결

**Files:**
- Modify: `src/pages/AdminClassDashboard.jsx`
- Modify: `src/pages/AdminClassDashboard.test.jsx`

`classId`가 `'unassigned'`가 아닐 때만 `AdminGridView`에 `onCreate`를 넘긴다.

- [ ] **Step 1: Write the failing test**

`src/pages/AdminClassDashboard.test.jsx` 파일 끝에 추가:

```js
// src/pages/AdminClassDashboard.test.jsx — describe 블록 안, 파일 끝에 추가
it('classId가 있는 수업 탭에는 방 만들기 카드를 보여준다', async () => {
  renderDashboard()
  await screen.findByText('홍길동')
  expect(screen.getByText('방 만들기')).toBeInTheDocument()
})

it('미배정 수업(unassigned)에는 방 만들기 카드를 보여주지 않는다', async () => {
  render(
    <SocketProvider>
      <AdminClassDashboard classId="unassigned" initialName="미배정 수업" onBack={vi.fn()} />
    </SocketProvider>
  )
  await screen.findByText('홍길동')
  expect(screen.queryByText('방 만들기')).not.toBeInTheDocument()
})

it('방 만들기 카드 클릭 시 현재 classId로 방을 생성하고 목록을 새로고침한다', async () => {
  renderDashboard()
  await screen.findByText('홍길동')

  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'NEW123' }) })
    }
    return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
  })

  await userEvent.click(screen.getByText('방 만들기'))

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/rooms',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ classId: 'class-1' }),
    })
  )
  expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms?classId=class-1', expect.anything())
})

it('방 생성에 실패하면 alert로 안내한다', async () => {
  renderDashboard()
  await screen.findByText('홍길동')

  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: '방 생성에 실패했습니다' }) })
    }
    return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
  })
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

  await userEvent.click(screen.getByText('방 만들기'))

  expect(alertSpy).toHaveBeenCalledWith('방 생성에 실패했습니다')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
Expected: FAIL — "방 만들기" 카드가 렌더링되지 않아 앞의 두 테스트가 실패하고, 뒤의 두 테스트는 `AdminGridView`가 `onCreate`를 받지 못해 카드 자체를 찾지 못함

- [ ] **Step 3: Write the implementation**

`src/pages/AdminClassDashboard.jsx`에서 `useState` 임포트 아래 상태 선언부에 `isCreating` 추가:

```jsx
// src/pages/AdminClassDashboard.jsx — 기존 useState 선언들 사이에 추가
const [isCreating, setIsCreating] = useState(false)
```

`loadRooms` 함수 아래, `handlePlayerUpdate` 함수 위에 핸들러 추가:

```jsx
// src/pages/AdminClassDashboard.jsx — loadRooms 아래, handlePlayerUpdate 위에 추가
async function handleCreateRoom() {
  if (isCreating) return
  setIsCreating(true)
  const res = await adminFetch('/api/admin/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId }),
  })
  setIsCreating(false)
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    alert(error || '방 생성에 실패했습니다')
    return
  }
  loadRooms()
}
```

`AdminGridView` 렌더링 부분을 교체:

```jsx
// src/pages/AdminClassDashboard.jsx — 기존 {activeTab === 'grid' && (...)} 블록을 교체
{activeTab === 'grid' && (
  <AdminGridView
    rooms={rooms}
    onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))}
    onCreate={classId === 'unassigned' ? undefined : handleCreateRoom}
  />
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/AdminClassDashboard.test.jsx`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminClassDashboard.jsx src/pages/AdminClassDashboard.test.jsx
git commit -m "feat: wire admin room creation into AdminClassDashboard"
```

---

### Task 5: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run --exclude '**/.worktrees/**' --exclude '**/node_modules/**'`
Expected: PASS (전체) — 레포에 `.worktrees/` 하위 다른 작업 브랜치들이 있다면 vitest 기본 설정으로 그것들까지 스캔되므로 exclude 플래그를 사용한다.

- [ ] **Step 2: 관리자 대시보드 수동 확인**

Run: `npm run dev`

브라우저에서 관리자로 로그인 후 임의의 수업 대시보드에 접속해:
1. 그리드 뷰의 기존 방 카드들 왼쪽 상단에 팀코드가 표시되는지 확인.
2. 그리드 마지막에 점선 테두리의 "+ 방 만들기" 카드가 보이는지 확인.
3. 클릭해서 새 방이 생기고(카드가 하나 늘고 팀코드가 표시됨), 로비 화면에서 그 팀코드로 학생이 실제로 입장 가능한지 확인.
4. 방금 만든 빈 방을 클릭해 관전 팝업이 정상적으로(빈 슬롯만 있는 상태로) 열리는지, 기존 "삭제" 버튼으로 정리할 수 있는지 확인.
5. "미배정 수업" 탭으로 이동해 "방 만들기" 카드가 보이지 않는지 확인.

- [ ] **Step 3: Commit (필요 시)**

검증 단계에서 코드 변경이 없었다면 커밋할 것이 없다. 수동 확인 중 문제를 발견해 수정했다면 해당 변경을 커밋한다.
