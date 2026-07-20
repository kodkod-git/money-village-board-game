# 관리자 모드 개편 — 관전/수정 화면 + 실데이터 연동

- Source proposal: `proposal/20260720_admin_mode_db.md`
- Reference mockups: `design/관리자 관전.png`, `design/관리자 수정.png`
- Date: 2026-07-20

## 배경

현재 관리자 모드(`/admin`)는 목업 데이터(`src/data/adminMockData.js`)로만 동작한다. 그리드뷰에서
팀 카드를 클릭하면 플레이어용 `Lobby` 컴포넌트를 `readOnly`로 재사용한 팝업이 뜨는데, 이는
디자인 목업(`관리자 관전.png`)과 다르고, 팀원 자산을 개별 수정하는 기능도 없다.

이번 작업은 다음 네 가지를 다룬다.
1. 관리자 관전 팝업을 목업 디자인대로 새로 구성 (팀 카드 형태의 요약 뷰)
2. 팀원별 관리자 수정 화면 신규 구현
3. 자산(직업/성공카드/현금/부동산/주식) 개별 수정 시, 플레이어 온보딩 화면과 동일한 입력 UI 재사용
4. 목업 데이터 제거, 실제 데이터(진행중인 방 + 완료된 팀) 연동

## 현재 구조 요약

- **진행중인 방(room)**: `server/rooms.js`의 인메모리 `Map`에만 존재. 소켓(`socket.io`)으로
  실시간 갱신되며, `socketId` 기준으로 플레이어를 식별한다.
- **완료된 팀**: `결과 등록` 버튼(`Lobby.jsx`)을 누르면 `POST /api/rooms/:code/submit` →
  `server/db.js`의 `saveGameResult`가 Supabase `game_sessions`/`game_results` 테이블에 저장.
  이후 해당 방은 메모리에서 사라지고, 결과는 Supabase에만 남는다.
- **`IndividualPage.jsx`**: 플레이어가 자기 자신의 자산을 입력하는 5단계 스텝 플로우
  (직업 → 성공카드 → 부동산 → 주식 → 현금). `socket.id`로 "나 자신"만 찾아 수정하는 구조라
  다른 플레이어를 수정하는 용도로는 쓸 수 없다.
- `/admin` 라우트는 인증 없이 열려 있다 (현행 유지, 이번 범위 밖).

## 합의된 결정 사항

- 관리자가 관전 팝업에서 팀원 자산을 수정하면, 진행중인 팀의 경우 **즉시 해당 플레이어의
  실제 화면에도 반영**된다 (양방향 동기화).
- 관리자 대시보드에는 **진행중인 팀 + 완료된 팀 전부** 표시한다.
- **완료된 팀(Supabase 저장분)도 관리자가 수정 가능**하다 (제출 후 불변성 보장은 이번 범위에서
  다루지 않음).
- `/admin` 접근 제어(인증)는 이번 작업 범위 밖 — 현행(누구나 접근 가능) 유지.

## 아키텍처

### 서버

**`server/rooms.js`**
- `listAllRooms()` 신규: 메모리에 있는 모든 방을 배열로 반환.
- `updatePlayerStateByUuid(code, playerUuid, partialGameState)` 신규: 기존
  `updatePlayerState`는 `socketId` 기준이라 관리자가 쓸 수 없음. `playerUuid`로 플레이어를 찾아
  `gameState`를 병합(merge) 업데이트하고 갱신된 `room`을 반환.

**`server/db.js`**
- `getAllCompletedTeams()` 신규: 모든 `game_sessions` + 연결된 `game_results`를 조회해
  관리자 대시보드가 기대하는 room 모양(`{code, prices, players}`)으로 매핑.
- `updateGameResult(sessionId, playerUuid, partialFields)` 신규: 지정한 `game_results` 행을
  UPDATE. `stock_holdings`/`real_estate_holdings`/`cash`/`badges`/`job` 등 변경 후
  `calculateAssetBreakdown`으로 `total_assets`/`stock_value`/`real_estate_value` 재계산해 같이
  저장.

**`server/index.js`** — 신규 라우트
- `GET /api/admin/rooms`
  - `listAllRooms()`(진행중) + `getAllCompletedTeams()`(완료)를 합쳐서 반환.
  - 각 방 객체 모양: `{ code, status: 'live' | 'completed', registered, prices, players: [{ playerUuid, name, character, affiliation, gameState }] }`
  - `registered`는 `status === 'completed'`와 동일한 의미로, 기존 그리드뷰 배지 로직과의
    호환을 위해 유지.
- `PATCH /api/admin/rooms/:code/players/:playerUuid`
  - body: 변경할 `gameState` 필드 일부 (예: `{ cash: 15000 }`, `{ job: 'b' }`,
    `{ stocks: { semiconductor: 3 } }`).
  - 서버가 먼저 메모리에서 `code`를 찾는다.
    - 있으면 → `updatePlayerStateByUuid` 호출 후, 해당 방 소켓 룸에 기존 `room-updated` 이벤트를
      그대로 브로드캐스트 (플레이어 화면 실시간 반영, 별도 이벤트 타입 불필요).
    - 없으면 → Supabase에서 `team_code`로 세션을 찾아 `updateGameResult` 호출.
  - 둘 다 못 찾으면 404.

### 프론트엔드

**데이터 로딩**
- `AdminDashboard.jsx`: 마운트 시 `GET /api/admin/rooms` 호출, `ADMIN_MOCK_ROOMS` 참조 제거.
- 진행중 팀의 실시간 갱신을 위해 소켓 `room-updated` 이벤트도 구독하여 목록의 해당 방만 갱신
  (완료된 팀은 정적이라 별도 구독 불필요).
- `src/data/adminMockData.js`, `src/data/adminMockData.test.js` 삭제.

**`AdminGridView` / `AdminTableView`**
- 데이터 소스만 실제 API 응답으로 교체, 기존 컬럼/카드 로직은 변경 없음.
- `AdminGridView` 카드 클릭 시 여는 대상을 `Lobby readOnly` → `AdminSpectateModal`로 교체.
  `AdminDashboard.jsx`에서 `<Lobby readOnly mockRoom={...}>` 관련 코드 제거.

**`AdminSpectateModal`** (신규, `design/관리자 관전.png` 기준)
- 상단: `‹ 뒤로`(팝업 닫기), `N팀` 타이틀, 좌우 화살표로 팀 이동, 진행 dot indicator
  (그리드에 표시된 전체 팀 목록 순서로 순환, 진행중+완료 통틀어서).
- 2×2 `AdminPlayerCard` 그리드 (최대 4명). 빈 슬롯은 기존 그리드뷰처럼 "대기중" 표시.
- 카드 내용: 캐릭터 이미지, 이름, 직업, 총자산, 성공카드/부동산/주식
  (기존 `/badges/*.png`, `/badges/estate/*.png`, `/badges/stock/*.png` 재사용), 우측 상단
  `수정` 버튼.
- `수정` 클릭 → 같은 팝업 안에서 `AdminEditModal` 화면으로 전환 (팝업 자체는 유지, 뒤로가기로
  관전 화면 복귀).

**`AdminEditModal`** (신규, `design/관리자 수정.png` 기준)
- 상단: `‹ 뒤로`(관전 화면 복귀), 캐릭터+이름.
- 좌측 열 카드: 직업 / 성공카드 / 현금, 각각 `수정` 버튼.
- 우측 열 카드: 부동산 / 주식, 각각 `수정` 버튼.
- 하단 우측: 총자산 합계 — 필드 수정 즉시 프론트에서 재계산해 반영.
- 각 `수정` 버튼 클릭 → 해당 필드 입력 컴포넌트를 모달로 오픈.

**필드 입력 컴포넌트 추출 (`IndividualPage.jsx` 리팩터)**
- 현재 `IndividualPage.jsx`에 인라인으로 박혀 있는 아래 3가지를 재사용 가능한 컴포넌트로 분리:
  - `JobPicker` — 직업 선택 그리드 (`step === 0` 블록)
  - `BadgePicker` — 성공카드 선택 그리드 (`step === 1` 블록)
  - `AssetListEditor` — 부동산/주식 `AssetCard` 리스트 (`step === 2`, `step === 3` 블록, 라벨/이미지/가격 맵을 props로 받도록)
- `IndividualPage`는 이 컴포넌트들을 기존과 동일한 5단계 스텝 플로우 안에서 사용 (동작 변경 없음).
- `AdminEditModal`은 같은 컴포넌트를 단일 필드용 모달로 사용. 현금은 기존
  `NumberInputModal` 그대로 재사용.
- 관리자가 필드 값을 확정하면 `PATCH /api/admin/rooms/:code/players/:playerUuid` 호출 →
  성공 시 `AdminEditModal`/`AdminSpectateModal`의 로컬 상태 갱신 (진행중 팀이면 소켓을 통해
  실제 플레이어 화면에도 반영됨).

## 테스트 계획

- 서버: `listAllRooms`, `updatePlayerStateByUuid`(rooms.test.js), `getAllCompletedTeams`,
  `updateGameResult`(db.test.js), `GET /api/admin/rooms` / `PATCH
  /api/admin/rooms/:code/players/:playerUuid` 라우트 테스트.
- 프론트: `AdminSpectateModal.test.jsx`, `AdminEditModal.test.jsx` 신규 작성.
  `AdminDashboard.test.jsx`, `AdminGridView.test.jsx`, `AdminTableView.test.jsx`를 fetch 기반
  데이터 흐름에 맞게 갱신. `adminMockData.test.js` 삭제.
- `IndividualPage.test.jsx`(있다면)는 리팩터 후에도 기존 동작이 그대로인지 회귀 확인.

## 범위 밖

- `/admin` 라우트 인증/접근 제어.
- 진행중인 방(room) 상태를 Supabase로 이전하는 구조 변경 (라이브 게임 아키텍처는 유지).
- 완료된 팀 수정 시 데이터 불변성/이력 관리.
