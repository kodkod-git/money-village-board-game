# 설계 스펙: 사용자 피드백 3건 반영

**날짜:** 2026-08-05
**출처:** `proposal/20260806_user_feedback.md`

---

## 배경

사용자로부터 3가지 피드백을 받았다:

1. 주식/부동산 가격·보유수량에 상한이 없어 비정상적으로 큰 값을 입력할 수 있다.
2. `IndividualPage`(직업/성공카드/부동산/주식/현금 입력 화면)에서 입력 도중 뒤로가기를 누르면 아무 경고 없이 이동하고, 재입장 시 실제 입력 여부와 무관하게 모든 단계가 "완료"로 표시된다.
3. "소속" 개념이 더 이상 쓰이지 않고 "수업"(관리자가 만드는 class) 단위로 게임이 관리되는데, 랭킹 페이지는 여전히 "소속" 탭과 "소속 · 팀코드" 표시를 쓰고 있다.

---

## 1. 주식/부동산 가격·수량 상한

### 현재 구조

- **가격 설정**: `src/pages/Team.jsx`의 `PriceSettingModal` — 호스트가 게임 시작 전 주식/부동산 종목별 가격을 설정. 내부적으로 `NumberInputModal`을 쓰지만 `maxValue`를 넘기지 않아 무제한.
- **수량 설정**: `src/components/QuantitySelector.jsx` — `AssetCard` → `AssetListEditor`를 거쳐 플레이어 입력 화면(`IndividualPage.jsx`의 부동산/주식 단계)과 관리자 수정 화면(`StockEditModal`/`RealEstateEditModal`, `AdminEditModal`이 사용)에서 공통으로 쓰인다. `+`/`-` 버튼과 내부 `NumberInputModal` 모두 상한 없음(`-`만 0 하한 있음).
- 기존 현금 상한(`MAX_CASH`, `src/constants/gameData.js`)은 `NumberInputModal`의 `maxValue` prop으로만 제한되고 서버 검증은 없다 — 이번에도 동일 패턴을 따른다.

### 변경 사항

- `src/constants/gameData.js`에 `MAX_ASSET_PRICE = 1000000`, `MAX_ASSET_QUANTITY = 100` 상수를 추가한다.
- `Team.jsx`의 `PriceSettingModal` 내 `NumberInputModal` 호출에 `maxValue={MAX_ASSET_PRICE}`를 추가한다(주식/부동산 공통).
- `QuantitySelector.jsx`:
  - 내부 `NumberInputModal`에 `maxValue={MAX_ASSET_QUANTITY}`를 추가한다.
  - `+` 버튼 클릭 시 `onChange(Math.min(MAX_ASSET_QUANTITY, value + 1))`로 클램프하고, `value >= MAX_ASSET_QUANTITY`일 때 `disabled` 처리한다(기존 `-` 버튼이 0 하한에서 하는 것과 대칭).
- 서버 측 검증은 추가하지 않는다(기존 `MAX_CASH`와 동일한 신뢰 모델).
- 관리자 수정 화면(`StockEditModal`/`RealEstateEditModal`)은 `QuantitySelector`를 재사용하므로 별도 수정 없이 자동으로 상한이 적용된다.

### 기존 DB 데이터 백필

- `scripts/backfill-holdings-cap.js`(가칭)를 신규 작성한다. `scripts/backfill-booth-values.js`와 동일한 구조(Supabase에서 직접 조회/갱신, `dotenv/config`로 서버 환경변수 사용)를 따른다.
- 대상: `game_results.stock_holdings`, `game_results.real_estate_holdings`의 각 값 중 100을 초과하는 항목.
- 처리:
  1. 100 초과 값을 100으로 클램프.
  2. 클램프된 홀딩으로 `calculateAssetBreakdown`(기존 `server/db.js` 함수, `backfill-booth-values.js`가 이미 사용 중)을 다시 호출해 `stock_value`/`real_estate_value`/`total_assets`를 재계산.
  3. 변경된 row만 업데이트하고, 처리 건수를 콘솔에 로그로 남긴다.
- 이 스크립트는 사용자가 로컬에서 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 환경변수를 갖춘 상태로 직접 실행해야 한다(에이전트는 프로덕션 DB에 접근할 수 없음).

---

## 2. 자산 미입력 시 상태 유지

### 현재 구조 (버그 원인)

`src/pages/IndividualPage.jsx`:

- `gameState`는 `job`, `badges`, `stocks`, `realEstate`, `cash`, `stocksVisited`, `realEstateVisited`, `isCompleted` 필드를 가진다.
- 부동산/주식 단계는 값이 바뀔 때마다 `stocksVisited`/`realEstateVisited`를 `true`로 저장하지만, **성공카드(badges) 단계에는 대응하는 visited 플래그가 없다.**
- 플레이어가 방에 재입장(소켓 재연결 또는 재방문)하면 두 곳(초기 fetch, `join-room` 콜백 이후)에서 각각:
  ```js
  if (gs.job !== null) setCompletedUpTo(4)
  ```
  를 실행한다. 즉 **직업만 선택되어 있으면 무조건 5단계(0~4) 전부를 "완료"로 표시**한다 — 실제로 부동산/주식/현금을 입력했는지와 무관하다. 이것이 피드백에서 말한 "모두 입력된 상태로 나타난다"의 원인이다.
- 뒤로가기 버튼(`<BackButton />`)은 확인 없이 즉시 `navigate(-1)`한다. `src/pages/Team.jsx`에는 이미 `LeaveConfirmModal` + `showLeaveConfirm` 상태로 "방을 나가시겠습니까?" 확인창을 띄우는 동일한 패턴이 있다.

### 변경 사항

**(a) 뒤로가기 확인창**

- `IndividualPage.jsx`에 `showLeaveConfirm` 상태를 추가하고, `<BackButton onClick={() => setShowLeaveConfirm(true)} />`로 바꾼다(입력 단계 0~4 전 구간에 적용).
- `Team.jsx`의 `LeaveConfirmModal`과 같은 스타일의 확인 모달을 추가한다. 문구: "입력 도중에 뒤로가기 버튼을 누르는 경우, 현재까지 입력한 내용이 사라질 수 있습니다. 이전 화면으로 돌아가시겠습니까?" 확인 시에만 `navigate(-1)`을 실행한다.

**(b) 진행 상태를 실제 입력 여부 기반으로 계산**

- `defaultGameState()`에 `badgesVisited: false`를 추가한다(기존 `stocksVisited`/`realEstateVisited`와 동일한 패턴).
- `handleNext()`에서 각 단계를 벗어날 때 해당 visited 플래그를 명시적으로 저장한다 — 값을 하나도 바꾸지 않고 "다음"만 눌러 넘어간 경우까지 정확히 기억하기 위함(현재는 값 변경 시에만 `stocksVisited`/`realEstateVisited`가 저장됨).
- 재입장 시 `completedUpTo`를 계산하는 헬퍼(예: `computeCompletedUpTo(gameState)`)를 추가해 두 곳의 `if (gs.job !== null) setCompletedUpTo(4)`를 대체한다:
  ```
  job !== null        → 최소 0단계 완료
  badgesVisited        → 최소 1단계 완료
  realEstateVisited    → 최소 2단계 완료
  stocksVisited         → 최소 3단계 완료
  isCompleted           → 4단계(현금)까지 완료
  ```
- 결과적으로 재입장 시 실제로 지나간 단계까지만 "완료"로 표시되고, 아직 들어가 보지 않은 단계는 미완료 상태로 남는다.

---

## 3. 랭킹 페이지 "소속" → "수업"

### 현재 구조

- `game_sessions` 테이블에는 이미 `class_id` 컬럼이 있다(방 생성 시 `classId`로 저장, `server/db.js`의 `createGameSession`/`getGameResult`가 사용 중). 반면 `game_results.affiliation`은 플레이어가 직접 입력하는 자유 텍스트(예: "서울중")로, 관리자가 만드는 "수업"(`classes` 테이블)과는 다른 개념이다.
- `src/pages/RankingPage.jsx`의 상단 서브탭(`TABS`)은 `전체 / 소속 / 팀`이며, "소속" 탭은 `me.affiliation` 값으로 `/api/rankings?affiliation=...`을 필터링한다.
- `src/components/RankingTable.jsx`는 각 행 부제로 `{row.affiliation} · {row.teamCode}`를 표시한다.
- `server/db.js`의 `RANKING_SELECT`/`mapRankingRow`는 `affiliation`, `teamCode`만 내려주고 수업 이름은 내려주지 않는다. `/api/results/:sessionId`(`server/index.js`)도 `classId`나 수업 이름을 응답에 포함하지 않는다.
- `server/classes.js`에 `classes` 테이블 CRUD 함수들이 있고, `UNASSIGNED_CLASS = '미배정 수업'` 상수가 이미 존재한다.

### 변경 사항

- **탭**: `RankingPage.jsx`의 `TABS`에서 `{ key: 'affiliation', label: '소속' }`을 `{ key: 'class', label: '수업' }`으로 바꾼다. 필터 기준을 `myAffiliation`(플레이어의 `affiliation` 값) 대신 `myClassId`(현재 세션의 `class_id`)로 바꾼다. `/api/results/:sessionId` 응답에 `classId`를 추가해 이 값을 클라이언트가 읽을 수 있게 한다.
- **랭킹 조회**: `/api/rankings`가 `affiliation` 대신 `classId` 쿼리 파라미터로 필터링하도록 바꾼다. `server/db.js`의 `getAllRankings`/`getBoothRankings`가 `game_sessions.class_id` 기준으로 필터링하고, 수업 이름을 표시하기 위해 `classes` 테이블과 조인(또는 `server/classes.js`에 `getClassName(classId)` 같은 조회 헬퍼를 추가해 사용)한다. `class_id`가 `null`이면 `UNASSIGNED_CLASS`("미배정 수업")로 표시한다.
- **리스트 표시**: `mapRankingRow`가 `affiliation`/`teamCode` 대신 `className`을 내려주도록 바꾸고, `RankingTable.jsx`의 부제를 `{row.affiliation} · {row.teamCode}`에서 `{row.className}` 단독 표시로 바꾼다. 팀코드는 화면에서 완전히 제거한다.
- **팀 탭**: `/api/results/:sessionId`가 내려주는 `players` 배열에도 `className`을 포함시켜(세션당 하나의 값이므로 모든 플레이어가 동일) 팀 탭에서도 동일한 부제 표시 방식을 쓸 수 있게 한다.
- `affiliation` 필드 자체나 플레이어 입력 폼(캐릭터 선택 등에서 소속 입력받는 부분)은 이번 범위에서 건드리지 않는다 — 랭킹 페이지의 표시/필터링만 변경한다.

---

## 테스트

- 기존 `RankingPage.test.jsx`, `RankingTable.test.jsx`, `AssetListEditor.test.jsx`, `NumberInputModal.test.jsx`, `IndividualPage`(테스트 파일 없으면 신규 작성 검토), `server/rooms.test.js`, `server/db.test.js` 등 관련 테스트를 갱신한다.
- 신규 동작(수량/가격 상한, 뒤로가기 확인창, 재입장 시 단계별 완료 상태, 수업 필터링)에 대한 테스트 케이스를 추가한다.
- 백필 스크립트는 별도 자동 테스트 없이 수동 실행으로 검증한다(기존 `backfill-booth-values.js`와 동일한 취급).

---

## 범위 밖

- `affiliation` 필드 및 관련 입력 UI 자체의 제거/변경.
- 가격·수량에 대한 서버 측 검증 추가.
- "방 이름" 같은 새로운 필드 도입(팀코드는 표시에서 제거만 함).
