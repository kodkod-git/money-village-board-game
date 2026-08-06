# 관리자 모드 — 방 만들기 & 팀코드 표시

- Source proposal: `proposal/20260807_admin_mode_room.md`
- Date: 2026-08-06

## 배경

관리자는 현재 수업(class)별로 생성된 방을 조회·관전·수정·삭제할 수 있지만(`AdminClassDashboard.jsx`
→ `AdminGridView`/`AdminTableView` → `AdminSpectateModal`), 직접 방을 새로 만들 수는 없다.

로비 화면(`Lobby.jsx`)의 방 생성 흐름은 `POST /api/rooms`로 빈 방을 만든 직후 곧바로
`joinRoom(code, true)`로 만든 사람을 호스트로 입장시킨다. 이 덕분에 방이 "0명" 상태로 존재하는
시간은 사실상 없다.

반면 관리자가 만드는 방은 관리자 자신이 플레이어로 들어가지 않으므로, 학생들이 실제로 입장하기
전까지는 계속 0명 상태로 남는다. `server/rooms.js`의 유일한 빈 방 정리 경로인
`removePlayer()`의 10분 유예 삭제 타이머(`ROOM_EMPTY_GRACE_MS`)는 "인원이 0명이 되는 순간"에만
걸리므로, 애초에 한 번도 인원이 채워진 적 없는 방에는 타이머가 걸리지 않는다 — 방치되면
영구적으로 남는다.

추가로, 관리자 화면에서는 각 방의 팀코드(`room.code`)가 화면에 노출되지 않아(현재는 React
`key`로만 쓰임) 관리자가 특정 학생에게 팀코드를 알려주려면 별도 확인 수단이 없다.

## 합의된 결정 사항

- **빈 방 자동 삭제 로직은 추가하지 않는다.** `server/rooms.js`의 기존 삭제 메커니즘은 변경 없이
  그대로 둔다. 관리자가 만든 빈 방은 관리자가 기존 "방 삭제" 기능(카드 클릭 → 이미 구현된
  `AdminSpectateModal`의 삭제 버튼)으로 수동 정리한다.
  - 별도 코드 없이도, 기존 `computeLiveRoomStatus()`가 `room.updatedAt` 경과 시간만으로
    상태를 계산하기 때문에 — 아무도 안 들어와 `updatedAt`이 갱신되지 않는 빈 방은 30분 후
    "정체(stale)", 2시간 후 "방치됨(abandoned)" 배지로 자연히 눈에 띄게 되어 수동 정리를
    유도한다. 이 부분은 기존 로직 재사용이며 신규 구현이 필요 없다.
- **클릭 1회당 방 1개 생성.** 로비와 동일한 패턴. 여러 개가 필요하면 여러 번 클릭한다. 일괄
  생성 UI는 만들지 않는다.
- **"방 만들기" 카드는 특정 수업(classId) 탭에서만 노출**한다. `unassigned`(미배정) 탭에는
  노출하지 않는다 — `unassigned`는 원래 배정 없이 들어온 고아 방을 보여주는 용도이므로 관리자가
  의도적으로 새 방을 만드는 흐름과 맞지 않는다.
- **팀코드는 그리드 뷰(카드)에만 표시**한다. 테이블 뷰(`AdminTableView`)는 플레이어 단위 행
  구조라 방 단위 코드와 맞지 않으므로 열을 추가하지 않는다.

## 아키텍처

### 서버 — `server/index.js`

신규 라우트 추가 (기존 관리자 라우트들과 동일한 인증/인가 패턴을 따른다):

```js
app.post('/api/admin/rooms', requireAdmin, async (req, res) => {
  const { classId } = req.body ?? {}
  if (!classId) return res.status(400).json({ error: 'classId가 필요합니다' })

  const allowed = await hasClassAccess(req.admin, classId)
  if (!allowed) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })

  const room = createRoom({ classId: classId === 'unassigned' ? null : classId })
  broadcastClassRooms(room.classId)
  res.json({ code: room.code })
})
```

- 기존 공개 `POST /api/rooms`(비인증)는 학생용 흐름 그대로 두고, 관리자 UI는 이 신규 인증
  라우트만 사용한다 — 관리자가 접근 권한 없는 수업에 방을 만드는 것을 막기 위해서다.
- `createRoom()`, `broadcastClassRooms()`는 `server/rooms.js` / 기존 헬퍼를 그대로 재사용한다.
  `rooms.js` 자체는 변경하지 않는다.

### 프론트엔드

**`AdminGridView.jsx`**
- `rooms` 배열 순회가 끝난 뒤, `classId !== 'unassigned'`일 때만 로비의 `.createCard`와 동일한
  시각 패턴("+  방 만들기")의 버튼을 그리드 마지막에 렌더링한다. 클릭 시 부모로부터 받은
  `onCreate` 콜백을 호출한다 (신규 prop).
- 각 방 카드에 왼쪽 상단 팀코드 배지를 추가한다. 기존 오른쪽 상단 상태 배지(`.badge`)와 대칭되는
  위치·크기이되 색상은 중립(예: 회색 계열)으로 구분해, 상태 배지와 시각적으로 경쟁하지 않게 한다.

```jsx
<span className={styles.codeBadge}>{room.code}</span>
```

**`AdminGridView.module.css`**
- `.codeBadge { position: absolute; top: 12px; left: 12px; z-index: 1; font-size: 11px;
  font-weight: 700; ... }` — 기존 `.badge`의 top/right를 top/left로 뒤집은 대칭 스타일.

**`AdminClassDashboard.jsx`**
- `isCreating` 상태 추가(로비의 `isJoining`과 동일한 역할 — 중복 클릭 방지).
- `handleCreateRoom()`: `adminFetch('/api/admin/rooms', { method: 'POST', body: { classId } })`
  호출 → 성공 시 `loadRooms()`로 목록 갱신, 실패 시 `alert(error)`.
- `AdminGridView`에 `classId`, `onCreate={handleCreateRoom}` prop을 추가로 전달한다. (테이블
  뷰 탭에는 생성 UI가 없으므로 `AdminTableView`는 변경하지 않는다.)

**`AdminSpectateModal.jsx`**
- 변경 없음. 0명 방도 기존 로직이 이미 문제없이 처리한다(과거 "인원이 막 빠져나간 방"의
  10분 유예 구간에서도 이미 0명 상태로 표시된 적이 있는 경로라 별도 방어 로직이 필요 없다).
  방금 만든 빈 방을 클릭하면 빈 슬롯만 보이는 관전 화면이 뜨고, 기존 삭제 버튼으로 정리할 수
  있다.

## 테스트 계획

- 서버: 라우트(`POST /api/admin/rooms`)는 기존 레포 컨벤션대로 HTTP 라우팅 자체는 단위
  테스트하지 않고 수동 확인한다 (다른 `/api/admin/rooms/*` 라우트들과 동일 컨벤션).
- `AdminGridView.test.jsx`: `classId`가 `unassigned`가 아닐 때만 생성 카드가 렌더링되는지,
  클릭 시 `onCreate`가 호출되는지, 각 카드에 `room.code` 텍스트가 표시되는지.
- `AdminClassDashboard.test.jsx`: 생성 카드 클릭 → `adminFetch`가 올바른 classId로
  `POST /api/admin/rooms`를 호출하는지, 성공 후 방 목록이 갱신되는지, 실패 시 alert가
  호출되는지.

## 범위 밖

- 빈 방 자동 삭제/자동 정리 (수동 삭제만 지원, 위 "합의된 결정 사항" 참조).
- 방 일괄 생성(N개 한 번에).
- `unassigned` 탭에서의 방 생성.
- 테이블 뷰에 팀코드 컬럼 추가.
- 기존 `POST /api/rooms`(학생용 공개 라우트) 자체의 동작 변경.
