# 관리자 모드 — 방 생명주기 상태 관리 (stale/abandoned/미등록완료)

- Source proposal: `proposal/20260721_admin_mode_advanced.md`
- Date: 2026-07-21

## 배경

관리자 대시보드(`/admin`)는 현재 방을 두 종류로만 구분한다.

1. **진행중인 방(live)**: `server/rooms.js`의 인메모리 `Map`. `listAllRooms()`으로 조회하며
   `status: 'live'`, `registered: false`.
2. **완료된 팀(completed)**: Supabase `game_sessions`/`game_results`. `getAllCompletedTeams()`으로
   조회하며 `status: 'completed'`, `registered: true`.

방이 정리되는 유일한 경로는 `removePlayer()`다 — 플레이어가 전원 나가면 방을 30초간
유지했다가, 그때도 0명이면 메모리에서 삭제한다. 그 외의 경우는 처리되지 않는다:

- 플레이어가 1명 이상 남아 있지만 더 이상 진행하지 않는 방
- 누군가 접속만 유지한 채 게임을 끝내지 않는 방
- 일부 팀원만 완료하고 나머지가 중단한 방
- 방 생성 후 오래 방치된 방
- 전원 완료(`isCompleted`)했지만 호스트가 "결과 등록"을 누르지 않아 계속 `live`로 남는 방

이번 작업은 이런 방들을 관리자가 한눈에 구분하고, 필요하면 수동으로 정리(숨김/삭제)할 수 있게
한다. 자동 삭제는 실수로 데이터를 날릴 위험이 있으므로 다루지 않는다 — "유령 의심 표시 +
수동 정리"만 구현한다.

## 합의된 결정 사항

- **상태 계산은 읽기 시점 동적 계산**. `room.updatedAt`만 저장하고, `GET /api/admin/rooms`
  호출 시점의 현재 시각과 비교해 즉석에서 상태를 판정한다. 별도 백그라운드 스케줄러는 두지
  않는다.
- **`updatedAt`은 `gameState` 변경 시에만 갱신**한다 (`updatePlayerState`,
  `updatePlayerStateByUuid`). 입장/퇴장으로는 갱신하지 않는다 — 접속만 유지한 채 아무 입력도
  없는 방을 "정체"로 잡아내려는 의도와 일치시키기 위함.
- **기준 시간**: `updatedAt` 이후 30분 미만 `live`, 30분~2시간 `stale`, 2시간 이상 `abandoned`.
- **전원 완료(`isCompleted === true`) 방은 경과 시간과 무관하게 항상
  `completed-but-unregistered`**로 표시한다. stale/abandoned보다 우선순위가 높다 — "호스트가
  등록을 깜빡했다"는 신호를 "방치됐다"는 신호와 구분하기 위함.
- **Supabase에 등록된 팀은 기존 `status: 'completed'`, `registered: true`를 그대로 유지**한다
  (변경 없음). 라이브 쪽 완료 상태를 `completed-but-unregistered`로 별도 명명한 것도 "완료"라는
  단어가 두 의미(팀원 입력 완료 vs 관리자 등록 완료)로 겹치는 걸 피하기 위해서다.
- **숨김/삭제는 라이브 룸(메모리)에만 적용**한다. 등록 완료된 Supabase 팀은 이번 범위에서
  다루지 않는다.
  - **숨김**: 대시보드 기본 목록에서 제외. 서버 메모리의 방 자체는 그대로 남고, 언제든 되돌릴
    수 있다.
  - **삭제**: `rooms` Map에서 완전히 제거. 되돌릴 수 없으므로 확인 팝업을 거친다.
- 새 상태는 카드에 배지로만 표시한다 (그리드/테이블 뷰 자체에 필터 탭은 추가하지 않음 — 필요해
  지면 추후 별도 작업).

## 아키텍처

### 서버 — `server/rooms.js`

- room 객체에 필드 추가:
  - `updatedAt: Date` — `createRoom()`에서 `createdAt`과 동일한 값으로 초기화.
  - `hidden: boolean` — 기본 `false`.
- `updatePlayerState(socketId, gameState)`, `updatePlayerStateByUuid(code, playerUuid, partial)`
  둘 다 성공 시 `room.updatedAt = new Date()`를 함께 갱신하도록 수정.
- 신규 함수:
  - `setRoomHidden(code, hidden)` — 방을 찾아 `hidden` 값을 설정하고 방을 반환. 없으면 `null`.
  - `deleteRoomByCode(code)` — `rooms.delete(code)`를 호출하고 삭제 성공 여부(`boolean`)를 반환.
    기존 `removePlayer()`의 30초 자동삭제 타이머와는 독립된 경로 (관리자가 명시적으로 호출).

### 서버 — 상태 계산

신규 순수 함수 `computeLiveRoomStatus(room, now)` (위치: `server/rooms.js`에 추가, 상태
문자열만 계산하고 부수효과 없음):

```js
export function computeLiveRoomStatus(room, now = new Date()) {
  const players = room.players
  const allCompleted = players.length > 0 && players.every(p => p.gameState?.isCompleted)
  if (allCompleted) return 'completed-but-unregistered'

  const elapsedMs = now - new Date(room.updatedAt)
  if (elapsedMs < 30 * 60 * 1000) return 'live'
  if (elapsedMs < 2 * 60 * 60 * 1000) return 'stale'
  return 'abandoned'
}
```

### 서버 — `server/index.js` 라우트

- `GET /api/admin/rooms?includeHidden=true`
  - 기존과 동일하게 `listAllRooms()` + `getAllCompletedTeams()`를 합쳐 반환하되:
    - 라이브 룸의 `status`를 `computeLiveRoomStatus(room, new Date())` 결과로 교체 (기존
      고정값 `'live'` 대신).
    - 각 라이브 룸 객체에 `hidden`, `updatedAt` 필드를 포함.
    - `includeHidden=true` 쿼리 파라미터가 없으면 `hidden === true`인 라이브 룸은 응답에서
      제외.
    - 완료된 팀(Supabase) 쪽은 변경 없음.
- `PATCH /api/admin/rooms/:code/visibility`
  - body: `{ hidden: boolean }`.
  - `setRoomHidden(code, hidden)` 호출. 방이 없으면 404.
- `DELETE /api/admin/rooms/:code`
  - `deleteRoomByCode(code)` 호출. 방이 없으면 404. 성공 시 200 `{ ok: true }` (기존
    라우트들과 동일하게 JSON 응답 유지).

### 프론트엔드

**`AdminDashboard.jsx`**
- 헤더에 "숨김 항목 보기" 토글(체크박스/스위치) 추가. 토글 상태를 `useState`로 들고, 켜지면
  `loadRooms()`가 `GET /api/admin/rooms?includeHidden=true`를 호출하도록 쿼리 파라미터를
  조건부로 붙인다.
- 방 숨김/삭제 후 로컬 `rooms` 상태에서 해당 항목을 제거(숨김 토글이 꺼져 있는 경우) 또는
  `hidden` 플래그만 갱신(토글이 켜져 있어 계속 보여야 하는 경우).

**`AdminGridView` / `AdminTableView`**
- `room.status` 값에 따라 배지 렌더링:
  - `live` → 배지 없음 (현재와 동일)
  - `stale` → "정체" 배지
  - `abandoned` → "방치" 배지
  - `completed-but-unregistered` → "등록 대기" 배지
  - `completed`(기존 `registered` 배지) → 기존 "등록 완료" 배지 그대로
- `hidden === true`인 방이 "숨김 항목 보기" 모드로 표시될 때는 추가로 "숨김" 배지를 함께
  표시한다.
- `AdminTableView`에는 상태를 텍스트 컬럼으로 추가해 그리드 뷰와 동일한 정보를 제공한다.

**`AdminSpectateModal`**
- 라이브 룸(등록되지 않은 방, 즉 `registered !== true`)일 때만 "숨김"/"숨김 해제"와 "삭제"
  버튼을 헤더 영역에 노출한다. 완료·등록된 팀에서는 노출하지 않는다.
- "숨김"/"숨김 해제": 클릭 시 `PATCH /api/admin/rooms/:code/visibility`를 호출하고, 성공하면
  부모(`AdminDashboard`)에 알려 목록을 갱신한다.
- "삭제": 클릭 시 확인 팝업("이 방을 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?")을 띄우고,
  확인 시 `DELETE /api/admin/rooms/:code` 호출 → 성공하면 팝업을 닫고 목록에서 제거한다.

## 테스트 계획

- `server/rooms.test.js`: `computeLiveRoomStatus` 경계값 테스트(29분59초/30분/1시간59분59초/
  2시간, 전원 완료 시 경과시간 무관하게 `completed-but-unregistered` 우선), `setRoomHidden`,
  `deleteRoomByCode`, `updatePlayerState`/`updatePlayerStateByUuid`가 `updatedAt`을 갱신하는지.
- 프론트: `AdminGridView.test.jsx`/`AdminTableView.test.jsx`에 상태 배지 렌더링 테스트 추가.
  `AdminDashboard.test.jsx`에 "숨김 항목 보기" 토글이 쿼리 파라미터를 바꾸는지 테스트 추가.
  `AdminSpectateModal.test.jsx`에 숨김/삭제 버튼 노출 조건과 클릭 시 API 호출 테스트 추가.
- 라우트(`GET/PATCH/DELETE /api/admin/rooms/...`)는 기존 레포 컨벤션대로 HTTP 라우팅 자체는
  단위 테스트하지 않고 수동 확인한다 (순수 로직은 `rooms.test.js`에서 이미 검증).

## 범위 밖

- Supabase에 등록된(완료된) 팀의 숨김/삭제.
- 그리드/테이블 뷰의 상태별 필터 탭.
- 서버 재시작 시 상태 보존 (라이브 룸은 기존과 동일하게 인메모리이므로 재시작하면 사라짐 —
  이번 작업으로 바뀌지 않음).
- 자동 삭제/자동 정리 (수동 정리만 지원).
