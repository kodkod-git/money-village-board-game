# 설계 스펙: 사용자 피드백 반영 (방 제목 / 가격설정 권한 / 랭킹 탭 / 자산 팝업 버그)

**날짜:** 2026-08-12
**출처:** `proposal/20260812_user_feedback.md`

---

## 배경

사용자로부터 4가지 피드백을 받았다:

1. 관리자가 만든 방은 참여자가 없어 `RoomCard`/관전 화면에 `???님의 방`처럼 이름이 비어 보인다. 관리자가 방 이름을 직접 설정할 수 있어야 한다.
2. "방장" 개념이 사라졌는데도 주식/부동산 가격 설정은 여전히 방장(첫 입장자)만 할 수 있다. 방장의 가격 설정 권한을 없애고 관리자가 대신 설정할 수 있어야 한다.
3. 랭킹 페이지의 탭 구조(전체/부스 → 전체/수업/팀, 주식/부동산)를 "총자산/주식/부동산" 위 탭과 "전체/수업/팀" 아래 탭의 2단 구조로 재편해야 한다.
4. 랭킹 페이지에서 참여자를 클릭하면 뜨는 자산 상세 팝업이 화면에서 잘려 보이는 반응형 버그가 있다.

---

## 1. 관리자 방 제목 편집

### 현재 구조

- `server/rooms.js`의 `createRoom({ classId })`은 방 객체(`{ code, createdAt, updatedAt, players, prices, classId }`)에 이름 필드를 두지 않는다.
- `listPublicRoomsByClassId()`가 내려주는 `hostName`은 `room.players.find(p => p.isHost)?.name`이며, 관리자가 만든 방은 아직 참여자가 없어 `null`이다.
- `src/components/RoomCard.jsx`(로비 목록)는 `{hostName ?? '???'}님의 방`을 표시한다.
- `src/components/admin/AdminGridView.jsx` 카드에는 이름 표시가 아예 없다(팀코드 배지만 있음).
- `src/components/admin/AdminSpectateModal.jsx` 상단의 `{index + 1}팀`(`navTitle`)은 배열 인덱스 기반 표시일 뿐, 실제 저장된 이름이 아니다.
- `server/classes.js`의 `classes` 테이블(Supabase)이 수업별 메타데이터를 영속 저장한다.

### 변경 사항

- **데이터 모델**: 방 객체에 `title` 필드를 추가한다(기본값 `null`). 학생이 로비에서 만드는 방은 `title: null`로 유지되어 `RoomCard`가 지금처럼 `{hostName}님의 방`을 계속 표시한다(변경 없음).
- **관리자 방 생성 시 기본 이름**: `POST /api/admin/rooms`가 방을 만들 때 `title`을 `TEAM ${n}`으로 채운다. `n`은 해당 수업 안에서 관리자가 만든 방의 누적 순번이며, 방을 삭제해도 재사용하지 않는다. 이를 위해 `classes` 테이블에 정수 컬럼(예: `room_counter`, 기본값 0)을 추가하고, 관리자 방 생성 때마다 원자적으로 증가시켜 그 값을 이름에 사용한다(수업이 DB에 영속되므로 서버 재시작에도 번호가 유지된다).
- **표시**:
  - `AdminGridView.jsx` 카드에 `room.title`이 있으면 이름 배지를 추가로 표시한다(기존 팀코드 배지와 별개 위치).
  - `AdminSpectateModal.jsx`의 `navTitle`을 `room.title ?? `${index + 1}팀``으로 교체한다.
- **편집**: `room.title`이 있는 방(=관리자가 만든 방)에 한해 `AdminSpectateModal`의 제목 텍스트를 클릭하면 인라인 텍스트 입력으로 전환되어 이름을 바꿀 수 있다. 저장은 신규 라우트 `PATCH /api/admin/rooms/:code`(body: `{ title }`, 관리자 인증 필요)로 처리하고, 성공 시 목록을 갱신한다. `title`이 `null`인 방(학생 생성 방)은 편집 UI를 노출하지 않는다.

### 범위 밖

- 학생이 만든 방의 이름을 관리자가 편집하는 기능.
- 학생이 로비에서 직접 방 이름을 입력하는 기능.

---

## 2. 가격 설정 권한 이전 (방장 → 관리자)

### 현재 구조

- `src/pages/Team.jsx`: `isHost = players.find(p => p.socketId === socket?.id)?.isHost`, `canManageRoom = readOnly || isHost`. `canManageRoom`이 참일 때만 "가격 설정" 버튼과 `PriceSettingModal`(주식/부동산 탭 전환 + 종목별 가격 입력)이 렌더링된다. 확정 시 `!readOnly`일 때만 소켓 이벤트 `update-room-prices`를 emit한다.
- `server/index.js`의 `socket.on('update-room-prices', ...)` → `server/rooms.js`의 `updateRoomPrices(socketId, prices)`가 `room.prices`를 갱신하고 `room-prices-updated`를 방 전체에 브로드캐스트한다.
- 관리자 쪽에는 가격을 "보는" 기능(`AdminEditModal`이 `prices`를 받아 총자산 계산에 사용)만 있고, 가격을 "바꾸는" UI/라우트는 없다.

### 변경 사항

- **클라이언트 (`Team.jsx`)**: `isHost`/`canManageRoom` 기반 가격 설정 버튼과 `PriceSettingModal` 렌더링을 제거한다. 학생 화면에서 가격 설정 진입점이 완전히 사라진다. (`isHost` 값 자체와 강퇴 등 다른 용도의 사용처는 이번 범위에서 건드리지 않는다.)
- **컴포넌트 재사용**: `Team.jsx`에 내부 정의되어 있던 `PriceSettingModal`을 별도 파일(예: `src/components/admin/PriceSettingModal.jsx`)로 분리해 관리자 화면에서 재사용한다.
- **서버**: `update-room-prices` 소켓 이벤트와 `updateRoomPrices()`(학생 경로 전용)를 제거한다. 대신 신규 REST 라우트 `PATCH /api/admin/rooms/:code/prices`(관리자 인증, body: `{ stocks, realEstate }`)를 추가해 `room.prices`를 갱신하고, 기존과 동일하게 `room-prices-updated`를 해당 방 소켓들에 브로드캐스트한다(진행 중인 학생 화면에 실시간 반영). **`room.registered`가 참인 방은 403을 반환**해 등록 완료 후 가격 변경을 막는다.
- **UI (`AdminSpectateModal.jsx`)**: 상단 액션 영역(`결과 등록`/`삭제` 버튼 부근)에 "가격 설정" 버튼을 추가한다. `room.registered`인 방에서는 버튼을 숨긴다. 클릭 시 분리된 `PriceSettingModal`을 열고, 확인 시 `PATCH /api/admin/rooms/:code/prices`로 저장한다.

### 범위 밖

- `isHost` 필드 자체의 제거(강퇴 등 다른 로직이 계속 사용).
- 등록 완료된 방의 사후 가격 수정(및 그에 따른 저장된 `total_assets` 재계산).

---

## 3. 랭킹 페이지 탭 개편

### 현재 구조

- `src/pages/RankingPage.jsx`: `TOP_TABS`(전체 랭킹/부스 랭킹, 2개) → `topTab === 'overall'`이고 `isV2`일 때만 `TABS`(전체/수업/팀, 3개)가 추가로 보이고, `topTab === 'booth'`일 때는 `BoothCategoryTabs`(주식/부동산)가 대신 보인다.
- `server/index.js`의 `GET /api/rankings`는 `category` 파라미터가 있으면 `getBoothRankings(category)`(전체 스코프 고정)를, 없으면 `getAllRankings(classId)`를 호출한다 — 즉 지금은 "부스(주식/부동산) 랭킹은 항상 전체 스코프"이고 "수업/팀 스코프는 항상 총자산 기준"이라는 제약이 있다.
- `server/db.js`의 `RANKING_SELECT`는 이미 모든 행에 `total_assets`/`stock_value`/`real_estate_value`를 함께 내려준다 — `getAllRankings`와 `getBoothRankings`는 정렬 컬럼만 다를 뿐 조회 로직이 사실상 동일하다.
- "팀" 스코프(`activeTab === 'team'`)는 `/api/results/:sessionId`로 진행 중 세션의 `players`를 그대로 가져와 쓰는데, 이 값에는 자산 합계가 계산되어 있지 않다(현재는 `topTab === 'overall'`에서만 쓰이므로 `RankingTable`이 참조하는 `totalAssets` 필드가 비어 있는 채로 동작해 왔다 — 이번 개편으로 실제로 값을 채워야 노출 가능해진다).
- `src/utils/calculateAssets.js`의 `calculateAssetBreakdown(gameState, prices)`가 이미 `stockValue`/`realEstateValue`/`totalAssets`를 계산해준다(현재 자산 상세 팝업에서 사용 중).

### 변경 사항

- **탭 구조**: `TOP_TABS`를 `총자산 / 주식 / 부동산` 3개로 교체한다(`BoothCategoryTabs`와 "부스" 개념은 이 3-tab에 흡수되어 제거). 마이데이터가 없을 때(`!isV2`)는 이 3개 탭만 보이고 스코프는 항상 전체다.
- 마이데이터가 있을 때(`isV2`)는 기존 `TABS`(전체/수업/팀)를 위 3개 탭 **전부** 아래에 동일하게 노출한다(현재는 "총자산" 아래에만 있음) → 표시되는 탭은 3+3=6개, 선택 가능한 조합은 3×3=9가지.
- **백엔드**: `getAllRankings(classId)`와 `getBoothRankings(category)`를 `getRankings({ classId, orderBy })` 하나로 합친다(`orderBy`는 `total_assets`/`stock_value`/`real_estate_value` 중 하나). `GET /api/rankings`가 `classId`와 `category`를 동시에 받아 이 함수에 전달하도록 바꾼다.
- **"팀" 스코프 계산**: 서버 변경 없이, `RankingPage.jsx`가 `/api/results/:sessionId`로 받은 각 플레이어의 `gameState`와 방의 `prices`를 `calculateAssetBreakdown`에 넣어 `totalAssets`/`stockValue`/`realEstateValue`를 클라이언트에서 계산하고, 선택된 카테고리 값 기준으로 정렬해 `rank`를 부여한 뒤 `RankingTable`에 넘긴다.

### 범위 밖

- 랭킹 정렬/필터 조합을 서버 쿼리 파라미터로 직접 캐싱하거나 URL에 반영하는 것.

---

## 4. 자산 상세 팝업 클리핑 버그 수정

### 현재 구조 (버그 원인)

- `src/pages/RankingPage.module.css`의 `.popup`이 `max-height: 90vh`를 쓴다. 반면 프로젝트 전반(`index.css`, `AdminClassList.module.css`, `AdminDashboard.module.css`)은 모바일 주소창으로 인한 뷰포트 오차를 피하기 위해 이미 `dvh`(dynamic viewport height) 단위를 쓰는 컨벤션이 있다.
- `vh`는 모바일에서 주소창이 보일 때 실제 보이는 화면보다 크게 계산된다. `.overlay`(`position: fixed; inset: 0; display: flex; align-items: center;`)가 팝업을 중앙 정렬할 때, 팝업 높이가 `90vh`로 실제 화면보다 크게 잡히면 팝업 자체가 화면 위/아래로 넘쳐 잘린다. `.popup`의 `overflow-y: auto`는 팝업 "내부" 콘텐츠 스크롤만 처리할 뿐, 팝업 자체가 뷰포트 밖으로 나가는 것은 막지 못한다.

### 변경 사항

- `.popup`의 `max-height: 90vh`를 `max-height: 90dvh`로 바꾼다(기존 컨벤션과 통일).
- `.overlay`에 `overflow-y: auto; padding: 24px 0;`를 추가해, `dvh`로도 팝업이 화면보다 커지는 극단적으로 작은 화면에서도 오버레이 자체가 스크롤되어 상/하단이 스크롤로 접근 가능하게 한다.

### 범위 밖

- `Team.module.css:222`, `AdminDashboard.module.css:123`의 동일한 `vh` 패턴(버그 리포트 대상이 아님, 필요 시 별도 후속 작업).

---

## 테스트 계획

- `RoomCard.test.jsx`: `title`이 없을 때 기존 `님의 방` 표시가 유지되는지.
- `AdminGridView.test.jsx`: `room.title`이 있을 때 이름 배지가 표시되는지.
- `AdminSpectateModal.test.jsx`: `room.title`이 있는 방에서 제목 클릭 시 편집 모드로 전환되고 저장 시 올바른 라우트를 호출하는지, `title`이 없는 방에서는 편집 UI가 없는지, "가격 설정" 버튼이 `registered` 여부에 따라 노출/숨김되는지, 클릭 시 올바른 라우트로 저장하는지.
- `Team.test.jsx`: 가격 설정 버튼/모달 관련 기존 테스트를 제거하고, 학생 화면에 더 이상 진입점이 없음을 확인하는 테스트로 대체한다.
- `RankingPage.test.jsx`, `RankingTable.test.jsx`: 새 6-tab 구조(3×2) 렌더링, 마이데이터 유무에 따른 아래 탭 노출, 9가지 조합에서 올바른 쿼리/정렬이 호출되는지, "팀" 스코프에서 클라이언트 계산 값이 올바르게 표시되는지.
- `server/db.test.js`: 합쳐진 `getRankings({ classId, orderBy })`가 기존 `getAllRankings`/`getBoothRankings` 테스트 케이스를 모두 커버하는지.
- `server/rooms.test.js`, `server/classes.test.js`: 방 `title` 기본값/저장, `room_counter` 증가(삭제 후 재사용되지 않음), 가격 PATCH 라우트의 `registered` 방 거부 케이스.
- CSS 클리핑 수정은 자동 테스트 대상이 아니므로 수동 확인(모바일 뷰포트 시뮬레이션)으로 검증한다.

---

## 범위 밖 (전체 공통)

- 학생이 로비에서 직접 방 이름을 입력하는 기능.
- 등록 완료된 방의 사후 가격 수정.
- 랭킹 조합의 URL 반영/캐싱.
- `Team.module.css`/`AdminDashboard.module.css`의 동일 `vh` 패턴 정리.
