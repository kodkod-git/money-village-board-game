# 관리자 결과 등록 개선: 연결 끊김 허용 + 수동 등록

## 배경

관리자용 팀 현황 화면(`AdminSpectateModal`)에서 두 가지 요청이 있었다.

1. **연결 끊김이어도 등록 허용**: 현재 팀원 중 한 명이라도 `connected: false`면 "결과 등록"이 완전히 막혀 있다(`docs/superpowers/specs/2026-08-24-block-registration-disconnected-design.md`에서 도입). 실제로는 연결이 끊긴 학생 화면에만 결과가 안 보일 뿐 나머지는 정상 진행 가능하므로, 경고 후 관리자 동의하에 진행할 수 있어야 한다. 이번 변경은 개별 등록과 전체(일괄) 등록 모두에 적용한다.
2. **오프라인으로 끝난 게임의 결과를 관리자가 직접 입력**: 참가자가 라이브로 접속하지 않고(또는 중간에 나가고) 오프라인으로 보드게임을 진행한 경우, 관리자가 팀원 한 명씩 이름/캐릭터/직업/성공열쇠/주식/부동산/현금을 직접 입력해 결과를 등록할 수 있어야 한다.

## 변경 범위

### 1. 연결 끊김이어도 결과 등록 허용

#### 1.1 개별 등록 — `src/components/admin/AdminSpectateModal.jsx`

- "결과 등록" 버튼의 `disabled={hasDisconnectedPlayer}`와 버튼 아래 안내 문구(`registerWarning`, `registerGroup` 래퍼)를 제거한다. 버튼은 항상 클릭 가능하다.
- `confirmRegister` `ConfirmDialog`의 `description`을 연결 상태에 따라 분기한다:
  - 정상: `이 팀의 결과를 등록하시겠습니까?` (기존 유지)
  - `hasDisconnectedPlayer`가 true: `연결끊김 상태인 참가자가 존재하고, 일부 참여자에게는 결과화면이 나오지 않을 수 있습니다. 그래도 진행하시겠습니까?`
- "예" 클릭 시 기존 `handleRegister` 그대로 호출한다(변경 없음).
- `AdminSpectateModal.module.css`에서 더 이상 쓰이지 않는 `.registerGroup`, `.registerWarning`을 정리한다.

#### 1.2 전체(일괄) 등록 — `src/pages/AdminClassDashboard.jsx` + `server/index.js`

- 클라이언트: "전체 등록" 버튼 클릭 시 여는 `confirmBulkRegister` `ConfirmDialog`의 `description`을, 현재 로드된 `rooms` 중 `status === 'completed-but-unregistered' && !registered`인 방들 가운데 연결 끊긴 팀원이 있는 방이 하나라도 있으면 1.1과 동일한 경고 문구로, 없으면 기존 문구(`등록 대기 중인 팀을 모두 결과 등록하시겠습니까?`)로 분기한다.
- 서버 `/api/admin/classes/:classId/submit-pending`: `pendingRooms = allPendingRooms.filter(room => !hasDisconnectedPlayer(room))` 필터를 제거하고 `allPendingRooms`를 그대로 등록 대상으로 쓴다. 응답의 `skipped`는 이제 항상 0이 되므로 `skipped` 필드 자체와 관련 로직을 제거하고 `{ registered, total }`만 반환한다.
- 클라이언트 `handleBulkRegister`: `skipped` 관련 분기(`else if (skipped > 0) ...`)를 제거한다. `total === 0`이면 기존처럼 "등록 대기 중인 팀이 없습니다" 토스트를 유지한다.

#### 1.3 서버 정리 — `server/index.js`, `server/rooms.js`

- `/api/rooms/:code/submit`에서 `if (hasDisconnectedPlayer(room)) return res.status(400)...` 검증을 제거한다(이제 연결 끊김이어도 등록을 허용하는 것이 의도된 동작이므로).
- 위 두 곳(1.2, 1.3) 변경 후 `hasDisconnectedPlayer`를 호출하는 곳이 없으므로, `server/rooms.js`에서 해당 함수 export를 삭제하고 `server/index.js`의 import에서도 제거한다.
- 참가자 카드의 "연결 끊김" 배지(`AdminPlayerCard.jsx`, `AdminGridCard.jsx`, `player.connected === false` 표시)는 정보성 표시이므로 그대로 둔다.

### 2. 관리자 직접 등록하기

#### 2.1 진입점 — `src/components/admin/AdminSpectateModal.jsx`

- `.actions`의 "자세히 보기"(`detailBtn`)와 "삭제"(`deleteBtn`) 버튼 사이에 "직접 등록하기" 버튼을 추가한다.
- `room.registered`이거나 `room.players.length >= 4`(팀 최대 인원)면 버튼을 숨긴다.
- 클릭 시 `showAddPlayer` state를 켜고 `AdminAddPlayerModal`을 띈다.
- 저장 성공 시 `onRoomChanged?.()`로 목록을 갱신한다(기존 `handleSave`와 동일 패턴).

#### 2.2 새 컴포넌트 `src/components/admin/AdminAddPlayerModal.jsx`

참가자가 "자산 입력" 버튼을 눌렀을 때 나오는 화면(`src/pages/IndividualPage.jsx`, 라우트 `/team/:code/individual`)과 동일한 구성 요소·레이아웃을 재사용하되, 라우트 이동 대신 고정 오버레이 팝업으로 띈다.

- **재사용 컴포넌트**: `StepBar`, `JobPicker`, `BadgePicker`, `AssetListEditor`, `NumberInputModal` — 전부 소켓/라우터에 의존하지 않는 순수 프레젠테이션 컴포넌트라 그대로 가져다 쓴다. 스타일도 `IndividualPage.module.css`의 `.page`/`.stepContent`/`.stepContentFill`/`.fillWrapper`/`.bottomBar`/`.nextBtn`/`.cashCard` 등을 그대로 import해서 쓴다(이 스타일들이 `--sx`/`--sy` 컨테이너 쿼리 변수에 의존하므로, 모달 최상위에 `.page`와 동일한 컨테이너 컨텍스트를 그대로 유지해야 기존 화면과 동일하게 보인다).
- **7단계**: `이름 → 캐릭터 → 직업 → 성공열쇠 → 주식 → 부동산 → 현금` (`StepBar`에 7개 라벨 전달).
  1. **이름**: `NameInput.jsx`와 동일한 입력창(`maxLength=20`). 비어 있으면 "다음" 비활성화.
  2. **캐릭터**: `CharacterSelect.jsx`와 동일하게 `CHARACTERS` 상수 + `CharacterCard` 그리드. 선택 전엔 "다음" 비활성화. 같은 방 내 캐릭터 중복 제한은 두지 않는다(현재 실시간 참가 흐름에도 `isCharacterTaken`이 실제로 호출되는 곳이 없어 사실상 제한이 없으므로 동일하게 맞춘다).
  3. **직업**: `JobPicker` — 선택 안 해도 다음으로 진행 가능(비워두면 "무직"으로 저장, 실제 참가자 흐름과 동일).
  4. **성공열쇠**: `BadgePicker` — 필수 아님.
  5. **주식**: `AssetListEditor` (`STOCK_LABELS`/`STOCK_IMAGES`, 방의 `prices.stocks` 전달) — 필수 아님.
  6. **부동산**: `AssetListEditor` (`REAL_ESTATE_LABELS`/`ESTATE_IMAGES`, 방의 `prices.realEstate` 전달) — 필수 아님.
  7. **현금**: `IndividualPage`의 현금 카드 UI(버튼 클릭 → `NumberInputModal` 팝업) 재사용. 이 단계의 버튼 라벨은 "완료".
- **뒤로 이동**: `StepBar`가 이미 지원하는 "완료한 단계 라벨 클릭 시 해당 단계로 이동" 동작을 그대로 쓴다(별도 구현 불필요). `completedUpTo`는 세션 로컬 상태로, "다음"을 누를 때마다 `Math.max(prev, step)`로 갱신한다(참가자 흐름과 동일한 방식이나, 서버에 저장된 진행 상태를 복원할 필요는 없으므로 항상 -1에서 시작).
- **취소**: 모달 상단 ✕ 클릭 시 관리자 쪽 공통 `ConfirmDialog`(tone="danger")로 "지금까지 입력한 내용이 사라집니다. 취소하시겠습니까?" 확인 후 닫는다. 도중에 서버로 아무것도 전송하지 않으므로, 취소하면 방에는 아무 흔적도 남지 않는다.
- **저장 시점**: 7단계 전부는 로컬 draft state(`{ name, character, job, badges, stocks, realEstate, cash }`)에만 쌓인다. 마지막 "완료" 클릭 시에만 서버에 한 번 저장한다.

#### 2.3 서버 — `server/rooms.js`, `server/index.js`

- `rooms.js`에 `addManualPlayer(code, { name, character, gameState })` 추가:
  - 방을 찾고, `room.players.length >= MAX_PLAYERS`면 `Error('Room is full')`을 던진다(`addPlayer`와 동일한 방어).
  - `playerUuid`는 `crypto.randomUUID()`로 서버에서 생성.
  - `{ socketId: null, name, character, isHost: false, playerUuid, affiliation: '', connected: true, gameState }`를 `room.players`에 push하고 `room.updatedAt`을 갱신한다.
  - `connected: true`로 고정한다 — 실제 소켓 연결이 없는 플레이어이므로 "연결 끊김" 배지가 잘못 뜨지 않게 항상 정상 취급한다.
- `index.js`에 `POST /api/admin/rooms/:code/players` 신설:
  - body: `{ name, character, job, badges, stocks, realEstate, cash }`. `name`(trim 후 비어있지 않음)과 `character`가 없으면 400.
  - 기존 관리자 라우트들과 동일하게 `findRoomClassId` + `hasClassAccess`로 권한 검사.
  - `gameState`는 `defaultGameState()` 형태를 기준으로 `{ cash: cash ?? 0, job: job ?? null, stocks: { ...기본값, ...stocks }, realEstate: { ...기본값, ...realEstate }, badges: badges ?? [false*6], jobVisited: true, stocksVisited: true, realEstateVisited: true, isCompleted: true }`로 구성한다 — 관리자가 전 단계를 한 번에 입력했으므로 즉시 완료 처리한다(`updatePlayerStateByUuid`가 관리자 수정 시 `isCompleted: true`를 세우는 것과 같은 원칙).
  - `addManualPlayer` 호출이 `Room is full` 등을 던지면 400으로 응답.
  - 성공 시 `io.to(code).emit('room-updated', { players: room.players })`, `broadcastClassRooms(room.classId)`를 호출하고 새로 추가된 플레이어 정보를 응답한다.
  - 이렇게 추가된 플레이어는 이후 `AdminPlayerCard`의 "수정"/"퇴장" 버튼으로 일반 참가자와 동일하게 다룰 수 있다(별도 분기 불필요).

## 에러 처리

- 1번(연결 끊김 허용): 서버 쪽 400 방어 로직을 제거하므로, 이제 정상 흐름에서는 등록이 항상 성공한다(방이 존재하고 전원 `isCompleted`인 경우). 기존 `if (!res.ok) return`류의 실패 처리는 방 삭제/네트워크 오류 등 다른 이유로 실패할 때를 위해 그대로 둔다.
- 2번(직접 등록): `POST /api/admin/rooms/:code/players`가 400/403/404를 반환하면 마법사는 닫지 않고 그대로 유지한다(관리자가 재시도할 수 있도록). 인원이 이미 4명이 된 경우(다른 관리자 탭에서 동시에 추가한 경쟁 상황 등) 서버가 400을 반환하므로, 클라이언트는 해당 에러를 토스트/알럿으로 안내한다.

## 테스트

- `server/rooms.test.js`: `addManualPlayer`가 플레이어를 정상 추가하는지, `MAX_PLAYERS` 초과 시 에러를 던지는지. 기존 `hasDisconnectedPlayer` 테스트는 제거.
- `server/index.test.js`(또는 해당 스펙 파일): `/api/rooms/:code/submit`이 연결 끊긴 플레이어가 있어도 200을 반환하는지. `/api/admin/classes/:classId/submit-pending`이 연결 끊긴 팀도 포함해 전부 등록하는지(`skipped` 없이). `POST /api/admin/rooms/:code/players`가 정상 추가/400(인원 초과, 필수값 누락)/403(권한 없음)을 올바르게 반환하는지.
- `src/components/admin/AdminSpectateModal.test.jsx`: 연결 끊긴 팀원이 있어도 "결과 등록" 버튼이 활성 상태인지, 클릭 시 경고 문구가 포함된 확인 다이얼로그가 뜨는지. "직접 등록하기" 버튼이 4명 만원/등록완료 상태에서 숨겨지는지, 클릭 시 `AdminAddPlayerModal`이 열리는지.
- `src/pages/AdminClassDashboard.test.jsx`: 연결 끊긴 팀이 섞여 있을 때 "전체 등록" 확인 다이얼로그 문구가 바뀌는지, 기존 `skipped` 토스트 테스트는 제거.
- `src/components/admin/AdminAddPlayerModal.test.jsx`(신규): 7단계를 순서대로 진행해 마지막 "완료"에서 올바른 payload로 API를 호출하는지, 이름/캐릭터 미입력 시 "다음"이 막히는지, 도중 취소 시 확인 다이얼로그를 거쳐 아무 API 호출 없이 닫히는지, `StepBar` 라벨 클릭으로 이전 단계로 돌아갈 수 있는지.

## 범위 밖

- 연결이 끊긴 참가자를 강제 퇴장시키거나 재연결을 유도하는 기능.
- `connected` 판정 로직(끊김 감지 타이밍) 자체의 변경.
- 이미 등록(완료)된 팀에 대해 사후에 플레이어를 추가하는 기능(등록 완료 방은 "직접 등록하기" 버튼이 보이지 않는다).
- 캐릭터 중복 방지 로직 신설(현재 실시간 참가 흐름에도 없는 제약을 새로 추가하지 않는다).
