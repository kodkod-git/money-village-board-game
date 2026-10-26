# 경쟁 모드 팀 대결 설계 (참여자 가격 · 팀 비교 대시보드)

- 작성일: 2026-10-26
- 요청 문서: `proposal/20261026_team_competition.md`
- 선행 설계: `docs/superpowers/specs/2026-10-21-competition-mode-design.md`

## 목표

경쟁 모드를 **팀끼리 대결하는 모드**로 만든다.

1. 수업 목록에서 "경쟁" 배지를 수업 이름 **옆**에 보여준다.
2. 경쟁 모드 참여자는 **각자** 주식·부동산 가격을 정한다(팀 단위 가격 설정은 쓰지 않는다).
3. 결과 화면에서 팀 비교 대시보드 4장을 옆으로 넘겨 보고, 마지막 장에서 기존 랭킹을 본다.

일반 모드의 동작은 바뀌지 않아야 한다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 관리자 팀 가격 설정 | 경쟁 모드 팀 카드에서는 숨긴다. 관리자는 관전·수정 화면에서 **그 참여자의 가격**을 고친다. |
| 가격 입력 위치 | 별도 단계로 넣는다: `직업 → 성공열쇠 → 주식 가격 → 주식 → 부동산 가격 → 부동산 → 현금` (7단계) |
| 대시보드 수치 | 팀원 합계. 현금 = 현금 합, 주식·부동산 = 참여자별 `수량 × 본인 가격` 합(평가액), 총 자산 = 기존 총자산(성공열쇠 배수 포함) 합 |
| 비교 범위 | 같은 수업의 등록된 모든 팀. 값이 큰 순서로 정렬하고, 우리 팀은 강조 색, 나머지는 회색 |
| 넘기기 | 항상 ①부터 시작. 점 5개 + 좌우 화살표. 라이브러리 없이 CSS scroll-snap |
| 참여자 가격 저장 | `gameState.prices`에 두고, `game_results`에 가격 컬럼을 추가한다(접근 방식 A) |

### 검토했지만 택하지 않은 방식

- **참여자마다 세션을 따로 저장(1인 1세션)**: 팀 순위, 팀 결과 화면, 관리자 팀 카드가 모두 깨진다.
- **평가액만 저장하고 가격은 저장하지 않기**: 보고서·안내서의 종목별 금액이 틀리게 나온다.

## 1. 경쟁 배지 (`AdminClassList`)

- `.itemBtn`이 세로 정렬이라 배지가 이름 밑에 나온다. 이름과 배지를 가로 한 줄(`.itemTitleRow`, `display: flex; align-items: center; gap: 6px`)로 묶고, 날짜는 그 아래에 둔다.

## 2. 참여자 가격 설정 단계

### `AssetInputSteps`

- `hidePrices` prop을 없애고 `editablePrices`(boolean) prop을 새로 둔다.
  - `false`(일반 모드, 기본값): 지금처럼 5단계이고, 수량 단계에는 `prices` prop의 방 가격을 보여준다.
  - `true`(경쟁 모드): 7단계. 수량 단계에는 `gameState.prices`를 보여준다.
- 단계는 배열(`STEPS`)로 정의하고, 화면 분기는 단계 번호 대신 **단계 키**(`job`, `badges`, `stockPrices`, `stocks`, `realEstatePrices`, `realEstate`, `cash`)로 한다. 두 모드가 같은 렌더링 코드를 쓴다.
- `VISITED_KEY_BY_STEP`도 단계 키로 바꾼다. 가격 단계에는 visited 키가 없다.

### 가격 단계 화면

- 관리자 가격 설정 화면의 목록 부분(아이콘 · 종목명 · "단위: 원" · `2,000 원 ›` 버튼 → `NumberInputModal`, 0원에서 시작, 최대 `MAX_ASSET_PRICE`)을 **공용 컴포넌트 `src/components/PriceListEditor.jsx`**로 분리한다.
  - props: `{ category: 'stocks' | 'realEstate', prices, onChange }` — 목록 하나와 계산기 모달을 그린다.
  - `PriceSettingModal`은 탭·헤더·확인 버튼만 갖고 목록은 `PriceListEditor`로 그린다. 모양과 동작은 바뀌지 않는다.
- 가격 단계: 제목 "주식 가격" / "부동산 가격", 부제 "게임이 끝났을 때의 가격을 입력해주세요". 오른쪽 위에 **초기화** 버튼이 있고, 누르면 그 종류만 `DEFAULT_PRICES`로 되돌린다. 탭은 없다.
- 기본값은 `DEFAULT_PRICES`이고, 입력하지 않고 "다음"을 눌러도 된다.
- 가격이 바뀔 때마다 `onChange({ ...gameState, prices })`를 부르고, `CompetitionPlay`가 기존 `update-pool-player-state`로 저장한다.

### `CompetitionPlay`

- `<AssetInputSteps editablePrices …>`로 바꾼다.
- `gameState.prices`가 없으면(이번 변경 전에 들어온 참여자 등) 화면에 넣기 전에 `DEFAULT_PRICES`로 채운다.
- "다시 입력하기"를 눌러도 `prices`는 그대로 둔다.

## 3. 데이터 · 서버

### 저장

- 마이그레이션 `supabase/migrations/2026-10-26-add-player-prices.sql`: `boardgame.game_results`에 `stock_prices jsonb`, `real_estate_prices jsonb`를 추가한다(null 허용). 일반 모드 행은 null로 남는다.
- `rooms.js`의 `defaultGameState()`는 바꾸지 않는다. 경쟁 모드 참여자만 `gameState.prices`를 가진다.

### 가격 고르기 · 확인

- `resolvePrices(gameState, fallbackPrices)` → `gameState?.prices ?? fallbackPrices`. `server/db.js`와 `src/utils/calculateAssets.js` 양쪽에 둔다(두 파일은 서로의 사본이라는 기존 주석을 따른다).
- `sanitizePrices(prices)` (서버, `server/prices.js` 새 모듈): `STOCK_LABELS`, `REAL_ESTATE_LABELS`의 키만 남기고, 0 이상 `MAX_ASSET_PRICE` 이하의 정수가 아닌 값은 `DEFAULT_PRICES` 값으로 바꾼다. `prices`가 객체가 아니면 `undefined`를 돌려준다(가격 없음).
  - `update-pool-player-state`, 관리자 참여자 상태 수정 경로, 등록 후 수정(`PATCH` 결과 수정)에서 `gameState.prices`에 적용한다.

### 평가액 계산

- `saveGameResult`: 참여자마다 `resolvePrices(player.gameState, prices)`로 평가액을 계산한다. `player.gameState.prices`가 있으면 `stock_prices`, `real_estate_prices` 컬럼에 저장한다. 세션의 `stock_prices`·`real_estate_prices`에는 지금처럼 방 가격이 들어간다.
- `updateGameResult`: 행의 `stock_prices`가 있으면 그것을, 없으면 세션 가격을 쓴다. 고친 값에 `prices`가 들어 있으면 그 가격으로 다시 계산하고 컬럼도 바꾼다.
- 진행 중 상태 계산(관리자 팀 카드의 실시간 금액 등 `calculateAssetBreakdown`을 부르는 곳)도 `resolvePrices`를 거친다.

### API

- `GET /api/results/:sessionId`: 각 참여자에 `stockPrices`, `realEstatePrices`(행 값 ?? 세션 값)를 넣는다. 최상위 `stockPrices`, `realEstatePrices`는 하위 호환을 위해 남겨둔다.
- `GET /api/rankings`: `RANKING_SELECT`에 행의 `stock_prices, real_estate_prices`를 더하고, 응답의 `stockPrices`, `realEstatePrices`를 `행 값 ?? 세션 값`으로 채운다.
- 새 공개 API `GET /api/results/:sessionId/competition`:
  - 세션이 없거나, 세션의 수업이 없거나, 수업 `mode`가 `competition`이 아니면 `404`.
  - 같은 수업의 등록된 세션을 `created_at` 오름차순으로 정렬하고, `title`이 있으면 제목으로, 없으면 순서대로 "팀 N"으로 부른다(관리자 팀 현황과 같은 규칙).
  - 팀마다 `game_results`의 `cash`, `stock_value`, `real_estate_value`, `total_assets`를 합산한다.
  - 응답: `{ mySessionId, teams: [{ sessionId, name, cash, stockValue, realEstateValue, totalAssets, playerCount }] }` (`mySessionId`는 요청한 세션 id).

### 프론트의 가격 읽기

- `EconomicReport`, `ParentGuide`: 내 행의 `stockPrices`·`realEstatePrices`를 먼저 쓰고, 없으면 최상위(세션) 가격을 쓴다.
- `RankingPage` 팀 범위: 행의 가격을 먼저 쓰고, 없으면 세션 가격을 쓴다.
- `adminPlayerAdapters.toAdminPrices`: 변경 없음(행의 `stockPrices`를 이미 읽는다).

### 관리자

- `AdminGridCard`: `room.mode === 'competition'`이면 가격 설정 버튼과 주식·부동산 탭의 가격 표시를 숨긴다(수량은 그대로 보인다).
- `AdminSpectateModal`: 경쟁 모드면 가격 설정 버튼이 `AdminPriceSettingModal`을 **그 참여자의 `gameState.prices`**(없으면 `DEFAULT_PRICES`)로 열고, 확인하면 기존 참여자 상태 저장 경로로 `prices`를 저장한다. 일반 모드는 지금처럼 방 가격을 고친다.

## 4. 결과 화면 대시보드

### `RankingPage` (`/result/:sessionId`)

- 처음 로드할 때 `/api/results/:sessionId/competition`을 함께 요청한다. 응답이 올 때까지는 기존 로딩 상태를 보여준다.
  - `404`이거나 실패하면 → 지금 화면 그대로(대시보드 없음).
  - 성공하면 → `CompetitionResultCarousel`로 감싼다.
- `/ranking`(홈 랭킹)은 요청하지 않으며 바뀌지 않는다.
- 기존 랭킹 본문(제목 · 카테고리 탭 · 범위 탭 · 시상대 · 표 · 참여자 수정 모달)을 `src/components/RankingContent.jsx`로 분리한다. 일반 모드와 캐러셀 ⑤가 같이 쓴다. 데이터 불러오기 상태는 지금처럼 `RankingPage`가 갖고 props로 넘긴다.
- "처음으로" 버튼과 공유·만족도 조사·경제적 잠재력 유형 버튼은 캐러셀 바깥 위쪽에 두어 모든 장에서 보이게 한다.

### `CompetitionResultCarousel` (`src/components/CompetitionResultCarousel.jsx`)

- props: `{ teams, mySessionId, children }`. `children`은 ⑤ 랭킹이다.
- 순서: ① 현금 → ② 주식 → ③ 부동산 → ④ 총 자산 → ⑤ 랭킹.
- 가로 스크롤 컨테이너에 `scroll-snap-type: x mandatory`를 쓰고, 각 장은 `width: 100%`, `scroll-snap-align: start`.
- 아래쪽에 점 5개(현재 장 강조, 눌러서 이동)와 좌우 화살표 버튼(첫 장의 왼쪽, 마지막 장의 오른쪽은 비활성)을 둔다. 이동은 `scrollTo({ behavior: 'smooth' })`.
- 현재 장은 스크롤 위치(`scrollLeft / clientWidth` 반올림)로 계산한다.
- 항상 ①부터 시작한다.

### `TeamStatSlide` (`src/components/TeamStatSlide.jsx`)

- props: `{ title, valueKey, teams, mySessionId }`.
- 제목:
  - 현금: "더 많은 현금을 가진 팀은?"
  - 주식: "주식으로 더 많은 돈을 번 팀은?"
  - 부동산: "부동산으로 더 많은 돈을 번 팀은?"
  - 총 자산: "총 자산이 더 많은 팀은?"
- 제목 아래: 🏆 1위 팀 이름. 1위 값이 같은 팀이 여럿이면 " · "로 이어서 보여준다(예: "팀 1 · 팀 3").
- 가로 막대그래프(CSS만 사용): 값이 큰 순서로 위에서부터 놓는다(동점이면 팀 순서). 줄마다 `팀 이름 | 막대 | 금액`을 보여준다.
  - 막대 길이 = `값 / 1위 값 × 100%`. 1위 값이 0이면 모든 막대 길이가 0이다.
  - 금액은 `toLocaleString('ko-KR')` + "원". 0원은 막대 없이 "0원"으로 표시한다.
  - 우리 팀(`sessionId === mySessionId`)은 강조 색 막대 + "우리 팀" 표시, 나머지는 회색.
- 팀이 1개여도 그대로 보여준다.

## 5. 예외 처리

- **가격이 없는 참여자**: 방 가격(기본값)으로 계산한다. 입력 화면에서는 기본값으로 채운다.
- **잘못된 가격 값**: `sanitizePrices`가 정리한다.
- **대시보드 요청 실패**: 대시보드 없이 기존 랭킹 화면만 보여준다.
- **등록되지 않은 팀**: 등록된 세션만 합산한다.
- **등록 후 관리자 수정**: 다음에 화면을 열 때 합계에 반영된다(실시간 갱신 없음).

## 6. 테스트

**서버**

- `resolvePrices`: 참여자 가격 우선, 없으면 대체 가격.
- `sanitizePrices`: 모르는 키 제거, 음수·소수·최대값 초과·문자열은 기본값으로 바꿈, 객체가 아니면 `undefined`.
- `saveGameResult`: 참여자 가격으로 평가액을 계산하고 새 컬럼에 저장, 가격이 없는 참여자는 세션 가격을 쓰고 컬럼은 null.
- `updateGameResult`: 행 가격이 있을 때와 없을 때, 고친 값에 가격이 들어 있을 때.
- `GET /api/results/:sessionId/competition`: 일반 모드·없는 세션은 404, 팀별 합산, 팀 이름 규칙(제목 / "팀 N"), `mySessionId`.
- `GET /api/results/:sessionId`, `GET /api/rankings`: 참여자별 가격(행 값 ?? 세션 값).

**화면**

- `AssetInputSteps`: `editablePrices`면 7단계, 가격 단계 입력·초기화가 `onChange`로 전달, 수량 단계에 정한 가격 표시. 기본값이면 5단계 그대로.
- `PriceListEditor`: 목록 표시, 계산기 입력 반영. `PriceSettingModal` 기존 테스트 통과.
- `CompetitionPlay`: 가격 단계가 보임, 가격이 없으면 기본값으로 채움, "다시 입력하기" 후에도 가격 유지.
- `AdminClassList`: 경쟁 배지가 이름과 같은 줄(`.itemTitleRow`) 안에 있음.
- `AdminGridCard`: 경쟁 모드에서 가격 설정 버튼·가격 표시 숨김.
- `AdminSpectateModal`: 경쟁 모드에서 참여자 가격을 열고 저장.
- `TeamStatSlide`: 정렬, 우리 팀 강조, 동점 1위, 0원.
- `CompetitionResultCarousel`: 5장, 점·화살표로 이동, 첫·마지막 장에서 화살표 비활성.
- `RankingPage`: 경쟁 모드면 캐러셀, 404·실패면 기존 화면.
- `EconomicReport`, `ParentGuide`: 참여자 가격을 먼저 씀.

**회귀**: 기존 테스트 전체 통과. 일반 모드 `IndividualPage` 테스트가 그대로 통과해야 한다.

## 범위 밖

- 대시보드 실시간 갱신
- 팀 평균 비교
- 매입가 기반 수익 계산
- 수업 전체 순위 화면
