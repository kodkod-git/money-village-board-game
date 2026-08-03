# 세션 재접속 유예 — disconnect 시 즉시 퇴장 방지

- Source proposal: `proposal/20260803_login_system.md`
- Date: 2026-08-03

## 배경

플레이어 식별은 로그인 없이 `sessionStorage`의 `player_uuid`로만 이루어지고, 방 참가자
목록(`server/rooms.js`의 `room.players`)은 소켓 연결의 `socket.id`로 관리된다. 모바일
화면 잠김, 백그라운드 전환, 일시적인 네트워크 끊김 등으로 소켓이 끊기면 서버가
`disconnect` 이벤트에서 즉시 `removePlayer(socket.id)`를 호출해 플레이어를 방에서
제거한다. 방 전체가 빈 경우에만 30초 유예(`roomDeletionTimers`)를 두고, 개별 플레이어의
재접속에는 유예가 전혀 없다.

클라이언트(`IndividualPage.jsx`)도 컴포넌트 마운트 시 1회만 `join-room`을 보내기
때문에, socket.io가 같은 `socket` 객체로 재연결에 성공해도(새 `socket.id` 부여) 다시
방에 합류하는 로직이 없다. 그 결과 서버는 이미 플레이어를 제거했는데 클라이언트는
계속 접속 중이라고 착각하는 상태가 되어, "잠깐 멈춰있으면 접속이 끊긴다"는 증상으로
나타난다.

## 합의된 결정 사항

- disconnect 시 플레이어를 즉시 제거하지 않고, **10분간 방 안에 자리를 유지**한다
  (`gameState` 보존). 같은 `playerUuid`로 재접속하면 기존 자리를 재사용한다.
- 10분 안에 재접속이 없으면 그때 실제로 제거한다. 명시적 "나가기"(`leave-room`)와
  강퇴(`kick-player`)는 지금처럼 유예 없이 즉시 제거한다.
- 플레이어 제거로 방이 완전히 비면, 기존 방 삭제 유예(`roomDeletionTimers`)도
  **30초 → 10분**으로 늘린다. 두 유예는 독립적으로 동작하므로, 마지막 1명이 끊긴 뒤
  아무도 돌아오지 않는 최악의 경우 방이 실제로 정리되기까지 최대 20분이 걸릴 수 있다.
  (관리자 대시보드의 stale/abandoned 판정은 이와 별개로 `updatedAt` 기준 30분/2시간
  기준을 그대로 유지하므로 영향 없음.)
- 재접속 대기 중인 플레이어는 `connected: false`로 표시하고, 참가자 목록과 관리자
  화면에 "연결 끊김" 뱃지로 노출한다.
- 재접속 시 `name`/`character`/`affiliation`/`isHost`는 서버에 저장된 기존 값을
  그대로 유지한다 (클라이언트가 stale한 값을 보낼 가능성을 배제하기 위해 `playerUuid`는
  신원 확인 용도로만 사용).

## 아키텍처

### 서버 — `server/rooms.js`

- `room.players`의 각 항목에 `connected: boolean` 필드 추가 (기본 `true`).
- `addPlayer`를 upsert로 변경: 같은 `playerUuid`가 이미 있으면 `socketId` 갱신 +
  `connected: true` + 대기 중이던 개별 타이머 취소 후 기존 `gameState` 그대로 반환.
  없으면 기존과 동일하게 신규 push (단, `MAX_PLAYERS` 체크는 신규 참가자에게만 적용).
- 신규 `markDisconnected(socketId)`: 플레이어를 찾아 `connected: false`로 바꾸고
  `code:playerUuid` 키의 10분 타이머(`playerDisconnectTimers`)를 시작. 타이머 만료 시
  기존 `removePlayer` 로직(방이 비면 `roomDeletionTimers` 트리거)을 그대로 호출.
- `roomDeletionTimers`의 지연 시간을 `30000` → `10 * 60 * 1000`으로 변경.
- `clearRooms()`에 `playerDisconnectTimers` 정리도 추가 (기존 `roomDeletionTimers`와
  동일하게 테스트 간 누수 방지).

### 서버 — `server/index.js`

- `socket.on('disconnect', ...)`에서 `removePlayer(socket.id)` 대신
  `markDisconnected(socket.id)` 호출. 결과로 받은 room이 있으면(플레이어를 찾은 경우)
  `room-updated`를 브로드캐스트해 다른 참가자에게 `connected: false` 상태를 즉시 반영.
- `join-room` 핸들러는 변경 없음 (upsert 로직은 `addPlayer` 내부에서 처리되므로 호출부는
  그대로).

### 클라이언트

**재연결 시 자동 재조인** (`IndividualPage.jsx`, `Lobby.jsx`)
- 마운트 1회성 `join-room` 대신 `socket.on('connect', ...)`에 재조인 로직을 걸어, 최초
  연결이든 재연결이든 저장된 `playerUuid`로 매번 `join-room`을 보낸다. 서버가 upsert로
  처리하므로 이미 참가 중이어도 안전(idempotent)하다.

**`connected` 뱃지 표시**
- `room-updated`로 내려오는 `players` 배열의 `connected` 필드를 참가자 목록
  (`Lobby.jsx`의 `PlayerSlot`)과 관리자 관전 화면(`AdminSpectateModal.jsx`의
  `AdminPlayerCard`)에서 읽어, `player.connected === false`인 플레이어에 "연결 끊김"
  뱃지를 표시한다. 관리자 방 목록(그리드/테이블 뷰)에는 표시하지 않는다 — 카드 단위
  상세 화면에서만 필요하다고 판단.

## 테스트 계획

- `server/rooms.test.js`:
  - `addPlayer`가 기존 `playerUuid`로 호출되면 새 항목을 추가하지 않고 `socketId`만
    갱신하는지, `gameState`가 보존되는지.
  - `markDisconnected`가 `connected: false`로 바꾸고, 유예 시간 내 `addPlayer`(재접속)가
    호출되면 타이머가 취소되어 제거되지 않는지.
  - `markDisconnected` 후 유예 시간이 지나면 실제로 `room.players`에서 제거되는지, 방이
    비면 `roomDeletionTimers`가 시작되는지 (vitest fake timers 사용).
  - `roomDeletionTimers` 지연이 10분으로 바뀐 것을 반영해 기존 30초 관련 테스트 갱신.
- 프론트: `IndividualPage.test.jsx`에 재연결(`connect` 이벤트) 시 `join-room`이 다시
  호출되는지, `connected: false` 플레이어에 뱃지가 렌더링되는지 테스트 추가.
  `AdminSpectateModal.test.jsx`에도 뱃지 렌더링 테스트 추가.

## 범위 밖

- 소켓 재연결 자체의 타임아웃/ping 설정 튜닝 (socket.io 기본값 유지).
- 서버 재시작 시 상태 보존 (인메모리 구조 그대로 — 이번 작업으로 바뀌지 않음).
- 로그인 시스템 도입 등 `playerUuid`/`sessionStorage` 기반 식별 방식 자체의 변경.
