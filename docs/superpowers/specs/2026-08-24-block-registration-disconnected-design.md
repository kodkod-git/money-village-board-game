# 연결 끊긴 팀원이 있으면 결과등록 차단

## 배경

관리자가 팀의 결과를 등록할 때(개별 "결과 등록" 또는 "전체 등록"), 팀원 중 한 명이라도 연결이 끊긴(`connected: false`) 상태라면 등록이 불가능해야 한다. 잘못된 게임 상태(연결 끊김 직전 데이터)를 결과로 저장하는 것을 막기 위함이다.

`player.connected` 필드는 이미 서버에서 클라이언트로 내려오고 있다(`server/index.js`, `AdminPlayerCard.jsx`에서 "연결 끊김" 배지로 이미 사용 중). 새 데이터 필드는 필요 없다.

## 변경 범위

### 1. 팀별 결과 등록 — `src/components/admin/AdminSpectateModal.jsx`

- `room.players.some(p => p?.connected === false)`이면:
  - "결과 등록" 버튼을 `disabled` 처리한다.
  - 버튼 근처에 안내 문구 "연결이 끊긴 팀원이 있어 등록할 수 없습니다"를 표시한다.
- 연결이 모두 정상이면 기존 동작(클릭 → `ConfirmDialog` → `handleRegister`) 그대로 유지한다.
- 스타일은 `AdminSpectateModal.module.css`의 `.actions`/`.registerBtn`과 나란히 들어가는 작은 안내 텍스트 클래스를 추가한다.

### 2. 전체(일괄) 등록 — `src/pages/AdminClassDashboard.jsx` + `server/index.js`

- 서버 `/api/admin/classes/:classId/submit-pending`:
  - 기존에는 `computeLiveRoomStatus(room) === 'completed-but-unregistered'`인 방을 모두 대상으로 등록했다.
  - 변경: 이 목록 중 `room.players.some(p => p.connected === false)`인 방은 등록 대상에서 제외한다.
  - 응답에 `skipped`(연결 끊김으로 제외된 방 수)를 추가한다: `{ registered, total, skipped }`. `total`은 실제로 등록을 시도한(연결 정상인) 방 수를 의미한다.
  - 제외된 방은 삭제되지 않고 그대로 남아 "등록 대기" 상태를 유지한다(재연결 후 재시도 가능).
- 클라이언트 `handleBulkRegister` (`AdminClassDashboard.jsx`):
  - 응답의 `skipped > 0`이면 "N개 팀은 연결이 끊긴 팀원이 있어 등록되지 않았습니다" alert를 표시한다.
  - `total === 0 && skipped === 0`이면 기존처럼 "등록 대기 중인 팀이 없습니다" alert를 유지한다.
  - 두 alert가 동시에 해당하는 경우는 없다 (total===0이면 애초에 등록 대기 팀 자체가 없다는 뜻이므로 skipped도 0).

### 3. 서버 방어 로직 (defense-in-depth) — `server/index.js`

- `/api/rooms/:code/submit` (개별 등록 엔드포인트, `AdminSpectateModal`의 `handleRegister`가 호출):
  - 기존 `if (!room.players.every(p => p.gameState?.isCompleted))` 검증과 같은 자리에, `if (!room.players.every(p => p.connected !== false))` 검증을 추가하고 400과 에러 메시지를 반환한다.
  - UI에서 버튼을 비활성화해도 API를 직접 호출하는 경우를 막기 위한 서버측 방어이며, 기존 `isCompleted` 검증과 동일한 패턴을 따른다.

## 에러 처리

- 개별 등록: 서버가 400을 반환하면 클라이언트는 기존 `handleRegister`의 실패 처리(`if (!res.ok) return`)를 따른다 — 버튼이 비활성화되어 있으므로 정상 흐름에서는 도달하지 않는 방어 코드다.
- 일괄 등록: 개별 방 등록 실패(기존 try/catch)와 별개로, 연결 끊김으로 인한 제외는 에러가 아니라 정상적인 필터링이며 `skipped` 카운트로만 admin에게 알린다.

## 테스트

- `src/components/admin/AdminSpectateModal.test.jsx`: 연결 끊긴 팀원이 있는 방에서는 "결과 등록" 버튼이 비활성화되고 안내 문구가 보이는지, 정상 연결 방에서는 기존 동작이 유지되는지 검증.
- `src/pages/AdminClassDashboard.test.jsx`: `submit-pending` 응답의 `skipped`가 0보다 클 때 alert가 표시되는지 검증.
- `server/rooms.test.js` 또는 관련 서버 테스트: `/api/rooms/:code/submit`이 연결 끊긴 플레이어가 있을 때 400을 반환하는지, `/api/admin/classes/:classId/submit-pending`이 연결 끊긴 팀원이 있는 방을 제외하고 `skipped`를 올바르게 계산하는지 검증.

## 범위 밖

- 연결 끊김 팀원을 강제로 퇴장시키거나 재연결을 유도하는 기능은 이 작업에 포함하지 않는다.
- `connected` 필드 자체의 판정 로직(끊김/재연결 타이밍)은 변경하지 않는다.
