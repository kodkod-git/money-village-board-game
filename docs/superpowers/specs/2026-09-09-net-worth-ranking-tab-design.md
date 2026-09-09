# 랭킹 순자산(順資産) 탭 추가 (2026-09-09)

## 배경

- 랭킹에서 성공카드(성공열쇠) 배수가 반영되지 않은 "순수 자산" 기준 순위를 보고 싶다는 요청.
- 현재 총자산 계산: `총자산 = (현금 + 주식평가액 + 부동산평가액) × (성공카드 개수 × 0.5)` (`server/db.js` `calculateAssetBreakdown`).
  성공카드가 0개면 총자산이 0이 되어, 배수를 뺀 값이 더 의미 있는 경우가 있다.
- **순자산 정의**: `순자산 = 현금 + 주식평가액 + 부동산평가액` — 즉 배수 곱하기 직전의 `baseAssets`.

## 데이터

`game_results` 테이블에는 `cash`, `stock_value`, `real_estate_value` 컬럼이 이미 있고
`/api/rankings`·`/api/results/:sessionId` 응답에도 `cash`/`stockValue`/`realEstateValue`가 이미 포함된다.
→ **DB 스키마 변경 없음.** 순자산은 세 값의 합으로 파생.

구 데이터에서 `stock_value`/`real_estate_value`가 `null`일 수 있으므로 합산 시 `null → 0`으로 처리한다.

## 정렬 위치 결정: 서버

`getRankings`에 `category: 'netWorth'`를 추가해 **서버에서 정렬**한다.

- 이유: 전체/수업 스코프의 `RankingPage`, 그리고 `AdminRankingView`는 정렬을 전적으로 서버에 의존한다
  (`AdminRankingView`엔 클라이언트 정렬 경로가 아예 없음). 클라 정렬로 가면 두 화면 모두에 정렬 분기를 새로 넣어야 한다.
- 팀 스코프(`/api/results/:sessionId`)만 예외적으로 클라에서 재정렬한다 — 기존 주식/부동산 탭과 동일한 처리.

## 서버 변경 (`server/db.js`)

### `getRankings`

```js
function netWorthOf(r) {
  return (Number(r.cash) || 0) + (Number(r.stock_value) || 0) + (Number(r.real_estate_value) || 0)
}

export async function getRankings({ classId = null, category = null } = {}) {
  const isNetWorth = category === 'netWorth'
  const column = isNetWorth
    ? 'total_assets'
    : category ? RANKING_ORDER_COLUMN[category] : 'total_assets'
  if (!column) throw new Error(`Unknown ranking category: ${category}`)

  let query = supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order(column, { ascending: false })

  if (classId === 'unassigned') {
    query = query.is('game_sessions.class_id', null)
  } else if (classId) {
    query = query.eq('game_sessions.class_id', classId)
  }

  const { data, error } = await query
  if (error) throw error

  const sorted = isNetWorth
    ? [...data].sort((a, b) => netWorthOf(b) - netWorthOf(a))
    : data

  return sorted.map(mapRankingRow)
}
```

- `netWorth` 정렬 시 base 쿼리는 `total_assets DESC` 그대로 두고(안정 정렬 → 동점은 총자산 순), JS에서 순자산 기준 재정렬.
- 알 수 없는 category는 기존대로 throw (`RANKING_ORDER_COLUMN`에 없으면).

### `mapRankingRow`

반환 객체에 `netWorth` 필드 추가:

```js
netWorth: netWorthOf(r),
```

`RankingTable`/`RankingPodium`/`AdminRankingView`가 `row[valueKey]`로 값을 읽으므로 모든 행에 숫자 필드가 필요하다.

## `/api/rankings` 라우트

변경 없음 — `category` 쿼리 파라미터를 이미 그대로 `getRankings`에 전달한다.

## 프론트: `src/pages/RankingPage.jsx`

- `CATEGORY_TABS`에 4번째로 추가: `{ key: 'netWorth', label: '순자산' }` → `총자산 / 주식 / 부동산 / 순자산`
- `VALUE_KEYS`에 `netWorth: 'netWorth'` 추가
- 전체/수업 스코프 fetch: 기존 `if (category !== 'totalAssets') params.set('category', category)` 로직이
  `netWorth`일 때 `category=netWorth`를 붙여 서버가 정렬 → 그대로 동작. **추가 변경 불필요.**
- 팀 스코프 `.then` 콜백: `data.players`에는 `netWorth`가 없으므로 매핑 단계에서 계산해 넣는다.

```js
const players = (data.players ?? [])
  .map(p => ({
    ...p,
    netWorth: (p.cash ?? 0) + (p.stockValue ?? 0) + (p.realEstateValue ?? 0),
    stockPrices: data.stockPrices,
    realEstatePrices: data.realEstatePrices,
  }))
  .sort((a, b) => (b[vk] ?? 0) - (a[vk] ?? 0))
  .map((p, i) => ({ ...p, rank: i + 1 }))
```

`vk = VALUE_KEYS[category]`가 `'netWorth'`이면 이 정렬이 순자산 기준으로 동작한다.

## 프론트: `src/pages/AdminRankingView.jsx`

- `CATEGORY_TABS`에 추가 (총자산 바로 뒤): `총자산 / 순자산 / 현금 / 부동산 / 주식`
- `VALUE_KEYS`에 `netWorth: 'netWorth'` 추가
- fetch 로직 변경 없음 — `category !== 'totalAssets'`이면 `?classId=X&category=netWorth` 전송, 서버 정렬
- 포디움/테이블은 `row[valueKey]`로 자동 동작. 테이블 컬럼(현금/부동산/주식/총자산)은 탭과 무관하게 항상 표시되므로 변경 없음.
- 부제(`activeLabel`)는 자동으로 "… · 순자산 기준 순위를 확인할 수 있습니다"로 표기.

## 컴포넌트

`RankingTable.jsx` / `RankingPodium.jsx` — 변경 없음. `valueKey` prop으로 이미 임의 숫자 필드를 렌더한다.

## 테스트 (TDD)

- `server/db.test.js` (`describe('getRankings')`):
  - `category: 'netWorth'`이면 `cash + stock_value + real_estate_value` 내림차순으로 정렬해 반환 (총자산 순서와 다른 케이스로 검증)
  - `stock_value`/`real_estate_value`가 `null`인 행도 0으로 취급해 정렬
  - `mapRankingRow` 반환에 `netWorth` 필드 포함 (기존 `toEqual` 케이스에 `netWorth` 값 추가)
- `src/pages/RankingPage.test.jsx`:
  - 홈/결과 진입 모두에서 "순자산" 탭이 보인다 (기존 탭 개수 단언 갱신)
  - 순자산 탭 클릭 시 `/api/rankings?category=netWorth` 호출, 응답 렌더
  - 팀 스코프에서 순자산 탭 선택 시 `현금+주식+부동산` 합 기준으로 행 재정렬 + rank 재계산
    (팀원 2명, 순자산 순서 ≠ 총자산 순서)
- `AdminRankingView` — 테스트 파일 없음(레포 컨벤션), 추가 안 함.

## 범위 제외

- 페이지 부제("총 자산 순위를 확인하세요") 동적화
- 순자산 전용 Figma 디자인 (기존 탭 스타일 재사용)
- 성공카드 배수 계산 로직 자체는 불변
