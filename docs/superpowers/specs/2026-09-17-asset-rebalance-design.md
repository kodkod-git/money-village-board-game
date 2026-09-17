# 성공열쇠/주식/부동산 개편 — 설계 문서

- 날짜: 2026-09-17
- 관련 제안: `proposal/20260917_changes.md`
- 상태: 설계 확정, 구현 계획 대기

## 배경 / 문제

성공열쇠(성공카드) 6종의 문구가 실제 게임에서 쓰기엔 딱딱하고, 주식/부동산 각 6종 중
실제로 쓰는 건 3종뿐이라 입력 화면이 불필요하게 복잡하다. 또한 성공열쇠 배수 공식이
`badgeCount * 0.5`라서 0~1개 보유 시 최종자산이 0원 또는 절반이 되어버리는 문제가 있다.
관리자 수업목록도 생성순 정렬이 없고 빈 이름으로 수업을 만들 수 있어 UX가 거칠다.

## 목표

1. 성공열쇠 6종 문구를 새 이름으로 교체.
2. 성공열쇠 배수 공식을 완만한 곡선(0~2개 x1 ~ 6개 x2)으로 교체.
3. 주식 6종 → 3종(반도체/금융/바이오), 부동산 6종 → 3종(단독주택/빌라/아파트)으로 축소하고
   문구 단순화. 삭제 3종은 DB엔 남기되 화면/자산 계산에서 제외.
4. 주식/부동산 입력 카드 그리드를 3개 기준 레이아웃(넓을 때 1행3열, 좁을 때 3행1열)으로 조정.
5. 배수 공식 변경 + 활성 종목 축소로 달라지는 기존 게임 결과의 `total_assets`를 일괄 재계산.
6. 관리자 수업목록을 생성일 최신순으로 정렬하고, 빈 이름으로 수업 생성 시도 시 경고 팝업 표시.

## 비목표 (YAGNI)

- 주식/부동산 삭제 3종의 DB 컬럼 자체 삭제/마이그레이션 — 값만 그대로 남겨두고 화면·계산에서만 제외.
- 성공열쇠 배수 공식을 관리자가 화면에서 직접 조정하는 기능 — 여전히 코드 상수.
- 관리자 수업목록에 정렬 기준 선택 UI(이름순/최신순 토글) — 최신순 고정.
- `PriceSettingModal.jsx`/`gameData.js` 라벨 중복 통합 외의 추가 리팩터링.

## 사용자 결정 사항 (브레인스토밍)

| 질문 | 결정 |
| --- | --- |
| 7개 항목을 하나의 스펙으로 묶을지 | 하나로 묶어 진행 |
| 삭제된 주식/부동산 3종의 기존 보유 가치를 total_assets에 포함할지 | 제외 (DB엔 남기되 자산가치 계산에서 빠짐) |
| 관리자 수업목록 정렬 순서 | 최신순(생성일 내림차순) |
| `gameData.js`/`PriceSettingModal.jsx` 라벨 중복 통합 여부 | 통합 (가격설정 화면도 항상 최신 라벨 사용) |

## 구현 방식

### 1. 라벨/종목 정리

`src/constants/gameData.js`:

- `BADGE_LABELS` 문구 교체: `money→노동`, `idea→직업`, `trust→은행`, `thinking→주식`,
  `global→부동산`, `communication→행운`. (내부 키 이름 `BADGE_NAMES`는 저장된 게임 결과와의
  `badges[]` 인덱스 호환을 위해 그대로 유지 — 화면 문구만 바뀐다.)
- `STOCK_LABELS`를 3개로 축소: `semiconductor: 반도체`, `finance: 금융`, `bio: 바이오`.
  `industrial`/`auto`/`content` 키는 제거. `STOCK_IMAGES`도 같은 3키로 축소.
- `REAL_ESTATE_LABELS`를 3개로 축소: `gaon: 단독주택`, `dami: 빌라`, `chorong: 아파트`.
  `nuri`/`maru`/`hani` 키는 제거. `ESTATE_IMAGES`/`ESTATE_PRICES`도 같은 3키로 축소.

`src/components/PriceSettingModal.jsx`에 중복 정의된 `STOCK_LABELS`/`REAL_ESTATE_LABELS`/
`STOCK_IMAGES`/`REAL_ESTATE_IMAGES`/`DEFAULT_PRICES`는 제거하고 `constants/gameData`에서
import하도록 교체(`DEFAULT_PRICES`는 남은 3키 기준으로 재작성). 이 파일을 재-export하는
`AdminGridCard.jsx`/`AdminPriceSettingModal.jsx`의 import는 그대로 동작(경유지만 바뀜).

**연쇄 효과**: `AssetListEditor`, `AdminEditModal`, `RealEstateEditModal`, `StockEditModal`,
`AdminPlayerCard`, `PlayerAssetReceipt`는 모두 `Object.keys(STOCK_LABELS/REAL_ESTATE_LABELS)`를
순회하는 구조라 상수 축소만으로 입력화면·관리자화면·랭킹 개인자산화면에서 자동으로 3종만
노출된다. `game_results.stock_holdings`/`real_estate_holdings` DB 컬럼은 6종 키를 그대로 보존한다.

### 2. 성공열쇠 배수 + 활성 종목만 합산

`server/db.js`의 `calculateAssetBreakdown`이 유일한 계산 지점(클라이언트는 저장된
`total_assets`를 그대로 표시).

```js
import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../src/constants/gameData.js'

function badgeMultiplier(badgeCount) {
  if (badgeCount >= 6) return 2
  if (badgeCount === 5) return 1.5
  if (badgeCount === 4) return 1.2
  if (badgeCount === 3) return 1.1
  return 1
}

export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(STOCK_LABELS).reduce(
    (sum, key) => sum + (stocks[key] ?? 0) * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(REAL_ESTATE_LABELS).reduce(
    (sum, key) => sum + (realEstate[key] ?? 0) * (prices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  const totalAssets = baseAssets * badgeMultiplier(badgeCount)

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
```

`gameData.js`는 순수 JS 상수 파일(React/브라우저 의존 없음)이라 Node로 직접 실행되는
`server/db.js`에서도 그대로 import 가능 — 활성 종목 키를 서버 쪽에 중복 정의하지 않는다.

### 3. 입력 컴포넌트 레이아웃

`src/pages/IndividualPage.module.css`의 `.assetListFill`:

- 넓은 화면(현재 `grid-template-columns: repeat(3, ...)`)은 항목이 3개뿐이라 **CSS 변경 없이**
  자동으로 1행 3열이 된다.
- 좁은 화면(현재 기본값 `repeat(2, ...)`)만 `repeat(1, minmax(0, 1fr))`로 바꿔 3행 1열로 만든다.

### 4. 기존 데이터 백필

기존 `scripts/backfill-holdings-cap.js`와 동일한 패턴으로 `scripts/backfill-asset-rebalance.js`
신규 작성:

1. 모든 `game_sessions`(가격 정보)와 `game_results`(보유 종목/뱃지) 로드.
2. (2번에서 수정된) `calculateAssetBreakdown`으로 각 결과 재계산.
3. `game_results.stock_value`, `real_estate_value`, `total_assets`를 재계산값으로 업데이트.

전체 행이 배수 공식 변경의 영향을 받으므로(기존 백필과 달리) "변경분만" 필터링하지 않고
전 행을 재계산·갱신한다. 관리자 화면/랭킹 개인자산 화면은 1번의 라벨 축소로 이미 삭제
종목을 표시하지 않으므로, 이 스크립트는 숫자(자산 총액) 보정만 담당한다. 1회성 스크립트로
자동화 없이 배포 시 수동 실행한다(`node scripts/backfill-asset-rebalance.js`).

### 5. 관리자 수업목록

`server/classes.js`의 `listClassesForAdmin`:

- 슈퍼관리자 쿼리: `.order('name')` → `.order('created_at', { ascending: false })`.
- 일반관리자 쿼리(현재 정렬 없음): 조회 후 `created_at` 내림차순으로 정렬해 반환.
- `'unassigned'` 가상 항목은 실제 DB 레코드가 아니므로 정렬 대상에서 제외하고 지금처럼
  배열 맨 끝에 고정.

`src/pages/AdminClassList.jsx`의 `handleCreateClass`:

- 현재 `if (!newClassName.trim()) return`(무반응)을 경고 상태로 교체.
- 기존 `ConfirmDialog` 컴포넌트를 알림형(확인 버튼만)으로 재사용해 "수업 이름을 입력해주세요"
  경고 팝업을 띄운다. 확인을 누르면 팝업만 닫히고 입력창에 포커스가 남는다.

## 테스트

- `gameData.test.js` — `STOCK_LABELS`/`REAL_ESTATE_LABELS`/`BADGE_LABELS` 키 개수·값 갱신(6→3개
  단언 수정), `STOCK_IMAGES`/`ESTATE_IMAGES`/`ESTATE_PRICES` 키 일치 유지.
- `db.test.js` — 새 배수표 전 구간(0~2개 x1, 3개 x1.1, 4개 x1.2, 5개 x1.5, 6개 x2) 케이스 갱신,
  삭제된 종목 보유량이 `stockValue`/`realEstateValue`/`totalAssets`에 반영되지 않는 케이스 추가.
- `AssetListEditor.test.jsx` — 3개 카드만 렌더되는지 확인.
- `AdminClassList.test.jsx` — 최신순 정렬 확인, 빈 이름 제출 시 경고 팝업 노출·API 미호출 확인.
- `classes.test.js` — `listClassesForAdmin`이 `created_at` 내림차순으로 반환하는지(슈퍼/일반
  관리자 양쪽) 확인.
- 백필 스크립트는 별도 자동 테스트 없음(1회성 운영 스크립트, 기존 `backfill-*.js`와 동일 관행).

## 영향 범위

- `src/constants/gameData.js`, `src/components/PriceSettingModal.jsx` — 라벨/이미지 상수 축소·통합.
- `server/db.js` — 배수 공식 + 활성 종목 필터링, `src/constants/gameData.js` 신규 import.
- `src/pages/IndividualPage.module.css` — 그리드 컬럼 1곳 수정.
- `scripts/backfill-asset-rebalance.js` — 신규 1회성 스크립트.
- `server/classes.js`, `src/pages/AdminClassList.jsx` — 정렬 + 빈 이름 경고.
- DB 스키마 변경 없음. API 엔드포인트 변경 없음.
