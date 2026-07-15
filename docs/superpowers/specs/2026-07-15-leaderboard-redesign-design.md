# 랭킹 페이지 리디자인 설계 (2026-07-15)

> 원본 제안서: `proposal/20260715_leader_board.md`
> 참고 디자인: `design/랭킹-전체.png`, `design/랭킹-부스.png` (이 파일을 그대로 따라 구현하는 데 초점)
> 범위: 기존 랭킹 페이지(`RankingPage.jsx`)에 (1) 전체 랭킹/부스 랭킹 최상위 탭, (2) 시상대(podium) UI, (3) 랭킹 리스트에 "팀" 컬럼을 추가한다.

---

## 0. 배경

현재 랭킹 페이지는 두 진입점을 갖는다.

- **홈 화면 "랭킹" 버튼** (`/ranking`, sessionId 없음): 전체 랭킹만 테이블로 보여줌. 서브탭 없음.
- **결과 등록 후** (`/result/:sessionId`, sessionId 있음): 전체/소속/팀 서브탭이 있는 테이블.

이번 리디자인은 두 진입점 모두에 최상위 탭(전체 랭킹/부스 랭킹)과 시상대 UI를 추가한다. 기존 서브탭(전체/소속/팀)은 결과등록 후 진입에서만 계속 노출된다(변경 없음).

"부스 랭킹"은 노동/직업/은행/주식/부동산/행운 6개 카테고리에 대한 전체 순위를 보여주는 신규 기능이다. 다만 현재 데이터 모델은 현금을 단일 총액으로만 받고 있어 노동/직업/은행/행운의 개별 금액을 계산할 방법이 없다. **이번 구현 범위는 주식·부동산 2개 카테고리로 한정**하고, 나머지 4개는 탭은 노출하되 비활성화(준비중)로 둔다.

## 1. 적용 범위 & 진입점

- `/ranking`(sessionId 없음), `/result/:sessionId`(sessionId 있음) 양쪽 모두에 최상위 탭(`전체 랭킹` / `부스 랭킹`)을 노출한다.
- `전체 랭킹` 탭 하위 서브탭(전체/소속/팀)은 **sessionId가 있을 때만** 노출한다(기존 `isV2` 게이팅 그대로 유지). sessionId가 없으면 서브탭 없이 전체 리스트만 보여준다.
- `부스 랭킹` 탭은 sessionId 유무와 무관하게 항상 동일한 UI(카테고리 피커 + 전체 대상 랭킹)를 보여준다. 소속/팀으로 필터링하지 않는다(제안서 §2.2 "전체에 대해서").

## 2. 데이터 모델 & 백엔드

### 2.1 스키마 변경

`supabase/schema.sql`의 `game_results`에 컬럼 추가:

```sql
ALTER TABLE game_results
  ADD COLUMN stock_value NUMERIC,
  ADD COLUMN real_estate_value NUMERIC;
```

`total_assets`와 달리 `NOT NULL` 제약은 걸지 않는다. 과거 데이터 백필 전 과도기를 허용하고, 추후 노동/직업/은행/행운 등 다른 카테고리를 같은 패턴으로 추가할 때도 컬럼을 nullable로 유지하는 편이 확장에 유리하다.

### 2.2 `server/db.js` 변경

- `calculateTotalAssets(gameState, prices)` → `calculateAssetBreakdown(gameState, prices)`로 리팩터링. 클라이언트의 `src/utils/calculateAssets.js`(관리자 모드 데모에서 만든 것)와 동일하게 `{ cash, stockValue, realEstateValue, totalAssets }`를 반환한다. 기존 호출부(`saveGameResult`)는 `breakdown.totalAssets`를 사용하도록 수정.
- `saveGameResult()`: insert하는 row에 `stock_value: breakdown.stockValue`, `real_estate_value: breakdown.realEstateValue` 추가.
- 신규 함수 `getBoothRankings(category)` (`category: 'stock' | 'realEstate'`): `game_results`를 `stock_value` 또는 `real_estate_value` 기준 내림차순 정렬해 조회. 컬럼이 이미 계산되어 저장되어 있으므로 세션 조인 불필요 — `getAllRankings`와 거의 동일한 형태의 쿼리.
- `getAllRankings()`, `getBoothRankings()` 둘 다 반환 객체에 `teamCode`(= `game_sessions.team_code`, `game_results`에서 `session_id`로 참조) 필드를 추가한다. 랭킹 리스트의 "팀" 컬럼에 사용.

### 2.3 `server/index.js` 변경

- `GET /api/rankings`에 `category` 쿼리 파라미터 추가: `?category=stock`, `?category=realEstate`. 없으면 기존처럼 `total_assets` 기준(`getAllRankings`).
- `category`가 있으면 `getBoothRankings(category)` 호출. `affiliation` 파라미터는 부스 랭킹에는 적용하지 않는다(§1 참고).

## 3. 프론트엔드 컴포넌트

### 3.1 `RankingPage.jsx` 상태 재구성

- `topTab: 'overall' | 'booth'` 상태 추가. 최상위 탭 UI는 sessionId 유무와 무관하게 항상 렌더링.
- `overall` + sessionId 있음: 기존 `activeTab`(전체/소속/팀) 서브탭 로직 그대로 유지.
- `overall` + sessionId 없음: 서브탭 없이 `/api/rankings` 결과만 표시(기존 V1 동작과 동일).
- `booth`: `boothCategory` 상태(`'stock' | 'realEstate'`, 기본값 `'stock'`) 추가. 카테고리 변경 시 `/api/rankings?category=...`를 호출.

fetch 매트릭스:

| topTab | 서브탭/카테고리 | 요청 |
|---|---|---|
| overall | 전체 | `GET /api/rankings` |
| overall | 소속 (sessionId 有) | `GET /api/rankings?affiliation=X` |
| overall | 팀 (sessionId 有) | `GET /api/results/:sessionId` |
| booth | 주식 | `GET /api/rankings?category=stock` |
| booth | 부동산 | `GET /api/rankings?category=realEstate` |

### 3.2 신규 컴포넌트: `RankingPodium.jsx` (+ `.module.css`)

- props: `rows`(상위 1~3위, 있는 만큼만 전달됨), `valueLabel`(예: "총자산", "주식 평가액").
- 정렬된 rows 배열의 앞 3개를 그대로 슬라이스해 사용 — 별도 API 없음.
- 레이아웃: 1위 중앙(검정 배경 카드, 가장 큼) · 2위 좌측 · 3위 우측. `design/랭킹-전체.png` 참고.
- 인원이 3명 미만이면 있는 만큼만 렌더링(예: 2명이면 1·2위 자리만, 3위 자리는 렌더링하지 않음 — 빈 자리를 플레이스홀더로 채우지 않는다).

### 3.3 신규 컴포넌트: `BoothCategoryTabs.jsx` (+ `.module.css`)

- 6개 카테고리를 2행 3열 pill 버튼으로 렌더링: `노동, 직업, 은행` / `주식, 부동산, 행운` (`design/랭킹-부스.png` 순서 그대로).
- `노동/직업/은행/행운`은 `disabled` 처리 + 시각적으로 흐리게(준비중 느낌). 클릭해도 `onSelect` 호출 안 됨.
- `주식/부동산`만 클릭 가능, 선택 시 `boothCategory` 변경.

### 3.4 `RankingTable.jsx` 수정

- 컬럼 구성 변경: `등수 / 캐릭터 / 이름 / 소속 / 팀 / {valueLabel}`. "팀" 컬럼 추가, "총자산" 헤더는 `valueLabel` prop으로 대체(기본값 `"총자산"`).
- "팀" 값은 백엔드가 내려주는 `teamCode`를 그대로 표시한다(가공 없음, 예: `AB1234`).
- pinned row("나의 기록")도 동일하게 "팀" 컬럼과 `valueLabel`을 반영.
- `highlightPlayerUuid` 기반 pinned row 로직은 기존 그대로 재사용 — `booth` 탭에서도 동일하게 동작(내 플레이어의 주식/부동산 평가액 기준 등수가 하이라이트됨).

### 3.5 값 표시 규칙

- `overall` 탭: `row.totalAssets` 사용, `valueLabel = "총자산"`.
- `booth`+주식: `row.stockValue` 사용(뱃지 배수 미적용 — 부스 자체의 순수 평가액), `valueLabel = "주식 평가액"`.
- `booth`+부동산: `row.realEstateValue` 사용, `valueLabel = "부동산 평가액"`.

## 4. 과거 데이터 백필

- `stock_value`/`real_estate_value` 컬럼은 신규 제출분부터만 채워진다. 배포 전 1회성 백필이 필요하다.
- `scripts/backfill-booth-values.js` 신규 스크립트: `game_sessions` ⋈ `game_results`를 `session_id`로 조인해 모든 기존 row를 순회하며, `server/db.js`의 `calculateAssetBreakdown(gameState, prices)`를 재사용해 `stock_value`/`real_estate_value`를 계산 후 UPDATE.
  - 순수 SQL(JSONB 순회) 대신 Node 스크립트로 작성해 §2.2의 계산 로직을 중복 없이 재사용한다.
  - 로컬/스테이징에서 배포 전 수동 1회 실행(`node scripts/backfill-booth-values.js`), 실행 결과(업데이트된 row 수)를 로그로 출력해 확인 가능하게 한다.

## 5. 테스트 전략

TDD로 아래 순서로 작성한다(자세한 스텝은 구현 계획에서 다룸).

- `server/db.js` 관련 테스트: `calculateAssetBreakdown` 반환값(`cash`/`stockValue`/`realEstateValue`/`totalAssets`) 검증, `saveGameResult`가 `stock_value`/`real_estate_value`를 포함해 insert하는지 mock 검증, `getBoothRankings`가 카테고리별로 올바른 컬럼 기준 정렬 쿼리를 호출하는지 검증.
- `RankingPodium.test.jsx`: 3명/2명/1명/0명 케이스별 렌더링(빈 자리 미표시 확인), `valueLabel` 반영 확인.
- `BoothCategoryTabs.test.jsx`: 비활성 카테고리 클릭 시 `onSelect` 미호출, 활성 카테고리(주식/부동산)만 클릭 시 호출.
- `RankingTable.test.jsx`: 기존 테스트에 "팀" 컬럼 렌더링 검증 추가, `valueLabel` prop에 따라 헤더/pinned row 라벨이 바뀌는지 검증.
- `RankingPage.test.jsx`:
  - 홈 진입(sessionId 없음) + 부스 랭킹 탭: 서브탭 없이 카테고리 피커만 노출되는지.
  - 결과등록 후 진입(sessionId 있음) + 전체 랭킹 탭: 기존 소속/팀 서브탭 동작 회귀 없는지.
  - 부스 랭킹 + 주식 카테고리 선택 시 `/api/rankings?category=stock` 호출 검증.
- `scripts/backfill-booth-values.js`는 1회성 스크립트이므로 자동 테스트 대상에서 제외하고, 로컬 실행 후 결과 row 수 확인으로 검증한다.

## 6. 범위 밖 (Out of scope)

- 부스 랭킹의 노동/직업/은행/행운 카테고리 구현 — 개별 금액을 저장할 입력 플로우/DB 설계가 필요한 별도 프로젝트로 취급한다. 이번엔 탭만 노출하고 비활성화한다.
- 팀 이름 입력 기능 — "팀" 컬럼은 기존 방 코드(`team_code`)를 그대로 표시하며, 사람이 읽기 좋은 팀 이름을 별도로 입력받는 기능은 만들지 않는다.
- 학교/학급 분리 — 디자인 목업은 "학교/학급/팀" 3단계지만, 현재 DB는 단일 `affiliation` 필드만 가지므로 "전체/소속/팀" 구조를 그대로 유지한다.

## 7. 파일 변경 목록

**신규**
- `src/components/RankingPodium.jsx` / `RankingPodium.module.css`
- `src/components/BoothCategoryTabs.jsx` / `BoothCategoryTabs.module.css`
- `scripts/backfill-booth-values.js`

**수정**
- `src/pages/RankingPage.jsx` — 최상위 탭(`topTab`) 상태, 부스 랭킹 fetch 로직 추가
- `src/components/RankingTable.jsx` — "팀" 컬럼, `valueLabel` prop 추가
- `server/db.js` — `calculateTotalAssets` → `calculateAssetBreakdown` 리팩터링, `saveGameResult`에 `stock_value`/`real_estate_value` insert 추가, `getAllRankings`/`getBoothRankings`에 `teamCode` 포함
- `server/index.js` — `/api/rankings`에 `category` 쿼리 파라미터 처리 추가
- `supabase/schema.sql` — `game_results`에 `stock_value`/`real_estate_value` 컬럼 추가
