# 경쟁 모드 설계

- 작성일: 2026-10-21
- 요청 문서: `proposal/20261021_new_mode.md`
- 브랜치: `feat/competition-mode`

## 목표

수업에 새 모드 **"경쟁"**을 추가한다. 기존 방식은 **"일반"** 모드로 부른다.

- 경쟁 모드에서 플레이어는 팀을 직접 만들거나 고르지 않는다. QR로 들어와 이름·캐릭터를 고르고 자산을 입력한 뒤 기다린다.
- 관리자가 들어온 플레이어를 드래그 앤 드롭으로 팀에 배정하고 결과를 등록하면, 각 플레이어에게 결과 화면이 뜬다.

일반 모드의 동작은 바뀌지 않아야 한다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 모드 선택 시점 | 관리자가 수업을 만들 때 일반/경쟁을 고른다. 만든 뒤에는 바꿀 수 없다. |
| 가격 | 관리자가 팀 배정 후 **팀 카드에서 팀별로** 설정한다(기존 `PATCH /api/admin/rooms/:code/prices` 그대로 사용). |
| 결과 화면 | 일반 모드와 같은 결과 화면(배정된 **팀 안에서의 순위**). 보고서·안내서도 그대로 쓴다. |
| 결과 등록 조건 | 대기 명단이 비어 있고(전원 배정), 배정된 **모든** 플레이어가 입력을 마쳤을 때만 가능하다. 막는 학생은 관리자가 삭제해 해소한다. |
| 팀 만들기 | 기존 그리드의 "방 만들기" 카드로 빈 팀을 만든다. 기존 팀 카드(`AdminGridCard`)를 그대로 쓰되 **팀 코드 배지만 숨긴다**. |
| 자산 입력 화면의 가격 | 숨기고 수량만 입력받는다(입력 시점에는 팀·가격이 없음). |
| 입력 후 수정 | 대기 화면의 **"다시 입력하기"**로 플레이어가 직접 고칠 수 있다. 누르면 '입력 중'으로 돌아가 결과 등록이 다시 막힌다. |
| 대기 플레이어 보관 | 수업별 대기 명단을 서버 메모리의 새 모듈(`server/classPool.js`)에 둔다(접근 방식 A). |

### 검토했지만 택하지 않은 방식

- **수업마다 숨겨진 '대기용 방'**: 4명 제한·상태 계산·팀 목록·팀 번호 등 방을 다루는 모든 곳에 예외가 필요해 일반 모드를 깨뜨릴 위험이 크다.
- **대기 명단을 DB에 저장**: 방은 메모리에만 있으므로 재시작 시 일관성이 없고, 마이그레이션·쿼리 작업만 늘어난다.

## 1. 구조와 데이터

### 수업 모드

- 마이그레이션 `supabase/migrations/2026-10-21-add-class-mode.sql`:
  `boardgame.classes`에 `mode text not null default 'normal' check (mode in ('normal','competition'))`를 추가한다. 기존 수업은 모두 `normal`이 된다.
- `POST /api/admin/classes`가 `{ name, mode }`를 받는다. `mode`가 없거나 잘못되면 `normal`로 저장한다.
- `GET /api/admin/classes`가 각 수업의 `mode`를 함께 내려준다.
- 공개 API `GET /api/classes/:classId/mode` → `{ mode }`를 추가한다. 플레이어 화면이 분기할 때 쓴다. 미배정(`unassigned`)이거나 없는 수업은 `normal`로 응답한다.

### 대기 명단 — `server/classPool.js` (새 모듈, 메모리)

수업별로 **아직 팀에 배정되지 않은** 플레이어를 담는다.

```js
// pools: Map<classId, Map<playerUuid, PoolPlayer>>
// PoolPlayer = { playerUuid, name, affiliation, character, socketId, connected, joinedAt, gameState }
// gameState는 rooms.js의 defaultGameState()와 같은 구조이며 isCompleted가 '입력 완료'를 뜻한다.
joinPool(classId, { playerUuid, name, affiliation, character, socketId })  // 같은 uuid면 재접속으로 처리(socketId 갱신, gameState 유지)
updatePoolPlayerState(classId, playerUuid, gameState)
markPoolDisconnected(socketId)
removeFromPool(classId, playerUuid)       // 삭제·배정 시 사용, 꺼낸 PoolPlayer를 돌려준다
listPool(classId)                          // joinedAt 오름차순
findPoolPlayer(playerUuid)                 // 재접속 시 어느 수업 명단에 있는지 찾는다
deletePool(classId)                        // 수업 삭제 시(제출 기록도 함께 지움)
rememberSubmitted(classId, playerUuid, sessionId)  // 결과 등록 시 기록 — 재접속한 플레이어를 결과 화면으로 보낼 때 쓴다
findSubmitted(playerUuid)                  // → sessionId | null
```

연결이 끊겨도 자동으로 지우지 않는다(관리자가 직접 삭제).

### 배정 = 대기 명단 ↔ 방 사이 이동

- 대기 명단 → 팀: `removeFromPool`로 꺼낸 플레이어를 `gameState` 그대로 기존 방의 `players`에 넣는다(`rooms.js`에 `addAssignedPlayer(code, player)` 추가). `isHost`는 false이며 팀장 개념은 쓰지 않는다.
- 팀 → 대기 명단: 방에서 빼서(`removePlayerByUuid`) `gameState` 그대로 대기 명단에 다시 넣는다.
- 팀 → 다른 팀: 위 두 과정을 한 번에 처리한다.
- 배정된 뒤에는 방이 일반 모드와 같은 객체이므로 상태 계산(`computeLiveRoomStatus`), 가격, `saveGameResult`, 결과 화면이 그대로 동작한다.
- 경쟁 모드 수업의 방은 `room.mode = 'competition'`을 가진다(방 생성 시 수업 모드를 복사). 화면이 팀 코드 배지를 숨길 때와 서버가 경쟁 규칙을 적용할 때 쓴다.

### 소켓

- 대기 플레이어 소켓은 `class-pool:{classId}` 채널에 들어간다.
- 팀에 배정되면 서버가 그 플레이어의 소켓을 방 채널(`room.code`)에 `join`시킨다. 그래서 결과 등록 시 보내는 기존 `game-submitted` 이벤트를 그대로 받는다. 팀에서 빠지면 방 채널에서 `leave`시킨다.
- 대기 명단이 바뀔 때마다 기존 `broadcastClassRooms(classId)`로 관리자 화면에 `class-rooms-updated`를 보낸다.

새 소켓 이벤트:

| 이벤트 | 보내는 쪽 | 내용 |
|---|---|---|
| `join-class-pool` | 플레이어 | `{ classId, playerUuid, name, affiliation, character }` → ack `{ ok, state: 'pool' \| 'assigned' \| 'submitted', gameState, sessionId? }` |
| `update-pool-player-state` | 플레이어 | `{ classId, gameState }` — 대기 명단에 있거나 배정된 방에 있거나 같은 경로로 저장한다 |

## 2. 플레이어 화면 흐름

1. **QR 접속 → 이름 입력 → 캐릭터 선택**: 기존 화면 그대로.
2. **분기**: `CharacterSelect`에서 다음으로 넘어갈 때 `classId`가 있으면 `GET /api/classes/:classId/mode`를 확인한다. 경쟁 모드면 `/lobby` 대신 `/compete/:classId`로 이동한다(이름·소속·캐릭터는 지금처럼 쿼리로 넘김). 팀 생성·참가 화면은 보이지 않는다.
3. **자산 입력 (`/compete/:classId`, 새 페이지 `CompetitionPlay`)**
   - `IndividualPage`의 단계 UI(직업 → 성공열쇠 → 주식 → 부동산 → 현금)를 **`AssetInputSteps` 컴포넌트로 분리**해 두 화면이 함께 쓴다. 일반 모드 화면과 동작은 바뀌지 않는다.
   - `AssetInputSteps`는 `hidePrices` prop을 받는다. 경쟁 모드에서는 종목 옆 가격 표시를 숨기고 수량만 받는다.
   - 입력이 바뀔 때마다 `update-pool-player-state`로 서버에 저장한다.
4. **대기 화면** (같은 경로, `gameState.isCompleted`가 true일 때)
   - 내 캐릭터 이미지, 이름, 문구: **"결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요"**
   - **다시 입력하기** 버튼: `isCompleted`를 false로 저장하고 입력 단계로 돌아간다.
   - 팀 배정 여부는 학생에게 보여주지 않는다.
   - 화면 디자인은 다른 온보딩 화면과 같은 `onboarding-mode` 프레임을 쓴다.
5. **결과 화면**: `game-submitted { sessionId }`를 받으면 기존 결과 화면 `/result/:sessionId`로 이동한다.

### 재접속

- 새로고침하거나 다시 들어오면 sessionStorage의 `player_uuid`로 `join-class-pool`을 다시 보낸다.
  - 대기 명단에 있으면 → 저장된 `gameState`로 입력 단계 또는 대기 화면을 복원한다.
  - 팀에 배정돼 있으면 → 서버가 방의 `socketId`를 갱신하고 방 채널에 다시 넣는다. 화면은 대기 화면 또는 입력 단계.
  - 끊긴 사이에 결과가 등록됐으면(`state: 'submitted'`) → 받은 `sessionId`로 결과 화면에 보낸다. 이를 위해 경쟁 모드 결과 등록 시 `classPool`에 `playerUuid → sessionId`를 기록해 둔다(`rememberSubmitted(classId, playerUuid, sessionId)`, 메모리). 지금 코드에는 uuid로 결과를 찾는 기능이 없으므로 새로 만든다.

## 3. 관리자 화면

### 수업 생성

- `AdminClassList`의 "수업 생성하기" 폼에 **일반 / 경쟁** 선택(라디오 버튼 2개, 기본값 일반)을 추가한다.
- 경쟁 모드 수업 카드에는 **"경쟁" 배지**를 붙인다.

### 팀 현황 페이지 (`AdminClassDashboard`) — 경쟁 모드일 때만 달라지는 부분

레이아웃: **통계 카드(전체 팀·미등록·등록 완료·전체 팀원) → 참여자 블럭(신규) → 팀 카드 그리드**

**참여자 블럭 (`CompetitionPoolBlock`)**

- 아직 팀에 배정되지 않은 플레이어를 캐릭터 이미지 + 이름 카드로 보여준다.
- 상태 표시: "입력 중" / "입력 완료", 연결이 끊기면 "연결 끊김".
- 플레이어마다 삭제 버튼(확인 창 후 `DELETE /api/admin/classes/:classId/pool/:playerUuid`).
- 비어 있으면 "QR로 들어온 참여자가 여기에 표시돼요".
- 데이터: `GET /api/admin/rooms?classId=` 응답과 별도로 `GET /api/admin/classes/:classId/pool`에서 받고, `class-rooms-updated` 때 함께 다시 불러온다.

**드래그 앤 드롭** (라이브러리 없이 HTML5 기본 drag & drop, PC 기준)

- 참여자 블럭 → 팀 카드: 그 팀에 배정한다.
- 팀 카드의 플레이어 슬롯 → 다른 팀 카드: 팀을 옮긴다.
- 팀 카드의 플레이어 슬롯 → 참여자 블럭: 배정을 취소한다.
- 4명이 찬 팀은 드롭을 받지 않고, 드롭하면 "팀 인원이 가득 찼어요 (최대 4명)" 토스트를 띄운다.
- 서버 API: `POST /api/admin/classes/:classId/assign` `{ playerUuid, toRoomCode }`. `toRoomCode`가 `null`이면 대기 명단으로 되돌린다. 성공 시 `broadcastClassRooms`로 모든 관리자 화면을 갱신한다.
- 드래그 기능은 경쟁 모드에서만 켠다(`AdminGridView`/`AdminGridCard`에 `draggable` 관련 prop을 넘길 때만 동작).

**팀 카드**

- 기존 `AdminGridCard`를 그대로 쓰고 `room.mode === 'competition'`이면 **팀 코드 배지만 숨긴다**.
- 팀장 표시(★)는 경쟁 모드에서 숨긴다(팀장 개념 없음).
- 가격 설정, 팀/주식/부동산 탭, 상태 배지, 관전·수정 화면(`AdminSpectateModal`)은 그대로 쓴다.
- 빈 팀은 기존 "방 만들기" 카드(`POST /api/admin/rooms`)로 만든다.

**결과 등록 버튼**

- 기존 "전체 등록" 버튼을 경쟁 모드에서는 **"결과 등록"**이라는 이름으로 쓴다.
- 활성 조건: 대기 명단이 비어 있고, 아직 등록되지 않은 팀의 모든 플레이어가 `isCompleted`이고, 등록할 팀이 1개 이상.
- 비활성일 때 버튼 옆에 이유를 보여준다. 예: "미배정 2명 · 입력 중 1명".
- 서버(`POST /api/admin/classes/:classId/submit-pending`)도 경쟁 모드 수업이면 같은 조건을 다시 확인하고, 맞지 않으면 `409 { error: '미배정 또는 입력 중인 참여자가 있어요' }`로 거부한다. 조건이 맞으면 기존 로직대로 팀마다 `saveGameResult` 후 `game-submitted`를 보낸다.

**테이블 뷰 / 유형 분포 뷰**: 기존 그대로. 테이블 뷰에는 팀에 배정된 플레이어만 나온다.

## 4. 예외 처리

- **대기 중 연결 끊김**: 대기 명단에 남고 "연결 끊김"으로 표시된다. 같은 기기에서 다시 들어오면 이어서 진행한다. 자동 삭제하지 않는다.
- **배정 충돌**: 플레이어가 이미 다른 곳으로 옮겨졌거나, 대상 팀이 가득 찼거나, 대상·출발 팀이 이미 결과 등록된 팀이면 서버가 `409`와 이유를 돌려주고 화면은 토스트로 알린다.
- **팀(방) 삭제**: 경쟁 모드 방을 삭제하면 그 팀의 플레이어는 지워지지 않고 `gameState`를 유지한 채 대기 명단으로 돌아간다.
- **수업 삭제**: `deletePool(classId)`로 대기 명단도 함께 지운다.
- **모드가 맞지 않는 진입**: `/compete/:classId`로 일반 모드 수업에 들어오면 `/lobby?classId=`로 보낸다. 경쟁 모드 수업으로 `/lobby?classId=`에 들어오면 `/compete/:classId`로 보낸다.
- **서버 재시작**: 대기 명단은 방처럼 메모리에만 있으므로 사라진다. 지금 방과 같은 수준이며 이번 범위에서 다루지 않는다.

## 5. 테스트

**서버**

- `classPool` 단위 테스트: 입장, 같은 uuid 재접속(gameState 유지), 상태 갱신, 연결 끊김 표시, 삭제, 목록 순서.
- 배정 API: 대기 명단 → 팀, 팀 → 팀, 팀 → 대기 명단(gameState 유지), 4명 초과 거부, 등록된 팀 거부, 다른 수업의 플레이어·팀 거부.
- 경쟁 모드 `submit-pending`: 미배정 또는 입력 중인 플레이어가 있으면 409, 모두 준비되면 팀마다 저장하고 `game-submitted` 전송, 플레이어별 `sessionId` 기록.
- `join-class-pool` 재접속: 대기 명단 / 배정됨 / 결과 등록됨 세 경우의 응답.
- 수업 생성: `mode` 저장, 잘못된 값은 `normal`.
- 경쟁 모드 방 삭제 시 플레이어가 대기 명단으로 돌아감.

**화면**

- `AdminClassList`: 모드 선택이 생성 요청에 포함됨, 경쟁 배지 표시.
- `CharacterSelect`: 경쟁 모드 수업이면 `/compete/:classId`로 이동.
- `CompetitionPlay`: 가격이 보이지 않음, 입력 완료 시 대기 화면과 문구, "다시 입력하기"로 입력 단계 복귀, `game-submitted` 수신 시 결과 화면 이동, 재접속 시 상태 복원.
- `CompetitionPoolBlock`: 플레이어·상태 표시, 삭제, 드롭 시 배정 API 호출.
- `AdminGridCard`: 경쟁 모드에서 팀 코드 배지·팀장 표시 숨김.
- `AdminClassDashboard`: 결과 등록 버튼의 비활성 조건과 안내 문구.

**회귀**: 기존 테스트 전체 통과. `AssetInputSteps` 분리 후에도 `IndividualPage` 테스트가 그대로 통과해야 한다.

## 범위 밖

- 수업 생성 후 모드 변경
- 수업 전체 순위 화면
- 터치(태블릿) 환경의 드래그 앤 드롭
- 서버 재시작 시 대기 명단 복구
