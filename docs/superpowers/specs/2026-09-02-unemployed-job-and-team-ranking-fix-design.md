# "무직" 직업 옵션 + 팀 랭킹 정렬 버그 수정 (2026-09-02)

## 배경

- QA/기능 요청: 직업 선택·수정 화면에 "무직"이 필요하다. 별도 카드를 추가하지 말고 각 직업 카드를 토글(껐다 켜기)로 만들고, 아무 카드도 선택하지 않은 채 다음으로 넘어가면 "무직"으로 표기한다.
- 랭킹 버그 리포트: 게임 후 랭킹 페이지에서 "팀" 탭 → "주식"/"부동산" 선택 시 등수가 잘못 표시된다.

## 1. "무직" 직업 옵션

### 상태 표현

`gameState`에 `jobVisited: false` 필드를 추가한다 (`IndividualPage.defaultGameState`).

| `job` | `jobVisited` | 의미 |
|---|---|---|
| `'a'`~`'f'` | (무관) | 해당 직업 |
| `null` | `true` | **무직** (직업 단계를 거쳤고 아무것도 선택 안 함) |
| `null` | `false` | 아직 직업 단계 입력 안 함 |

기존에 저장된 게임 결과(`game_results.job`)는 `null` 또는 `'a'~'f'`이며, 게임이 종료된 데이터에서 `job: null`은 항상 "무직"으로 해석한다 (`jobVisited` 없이).

### 서버 병합 규칙 (`server/rooms.js`)

`updatePlayerState`와 `updatePlayerStateByUuid`가 partial gameState를 병합할 때, **partial에 `job` 키가 존재하면(값이 `null`이어도) `jobVisited: true`도 함께 설정**한다. 참가자가 직업을 고르거나, 관리자가 직업을 수정하면 자동으로 visited 처리된다.

참가자가 아무 카드도 고르지 않고 다음으로 넘어가는 경우는 `IndividualPage`가 명시적으로 `jobVisited: true`를 emit한다(아래).

### 참가자 화면

**`JobPicker` (`src/components/JobPicker.jsx`)**
- 카드 클릭을 토글로 변경: `onChange(value === key ? null : key)`
- 선택된 카드를 다시 누르면 선택 해제

**`IndividualPage` (`src/pages/IndividualPage.jsx`)**
- `defaultGameState`에 `jobVisited: false` 추가
- `VISITED_KEY_BY_STEP`에 `0: 'jobVisited'` 추가 → step 0에서 다음으로 넘어갈 때 일반 visited 로직이 `jobVisited: true`를 emit
- `handleNext`의 `if (step === 0 && !gameState.job) return` 가드 제거
- "다음" 버튼의 `disabled={step === 0 && !gameState.job}` 제거
- `computeCompletedUpTo`: `if (gameState.job !== null || gameState.jobVisited) upTo = 0`

### 관리자 직업 수정 (`src/components/admin/JobEditModal.jsx`)
- 카드 토글: `setSelected(selected === key ? null : key)`
- 아무것도 선택 안 한 채 "확인" → `onChange(null)`. 서버 병합 규칙이 `jobVisited: true`로 저장 → 무직
- 선택이 없을 때 "선택하지 않으면 무직으로 저장됩니다" 안내 문구 표시

### "무직" 라벨 표시

| 파일 | 현재 | 변경 후 |
|---|---|---|
| `AdminEditModal.jsx` (프로필 subtitle) | `job ? JOB_LABELS[job] : '직업 미입력'` | `job ? JOB_LABELS[job] : (jobVisited ? '무직' : '직업 미입력')` |
| `AdminEditModal.jsx` (직업 필드 값) | `job ? (...) : '미입력'` | `job ? (...) : (jobVisited ? '무직' : '미입력')` |
| `AdminPlayerCard.jsx` | `job ? JOB_LABELS[job] : '직업 미입력'` | `job ? JOB_LABELS[job] : (jobVisited ? '무직' : '직업 미입력')` |
| `AdminRankingView.jsx:176` | `JOB_LABELS[row.job] ?? '미입력'` | `JOB_LABELS[row.job] ?? '무직'` |
| `AdminTableView.jsx` `hasAnyInput` | `if (gameState.job) return true` | `if (gameState.job || gameState.jobVisited) return true` |
| `adminPlayerAdapters.js` `toAdminPlayer` | `gameState: { job, ... }` | `jobVisited: true` 추가 (게임 후 데이터는 항상 확정 상태) |

### 서버/DB

`game_results.job`은 이미 nullable. `computeAssetBreakdown`은 job을 사용하지 않는다. 저장/조회 SQL 변경 없음. `jobVisited`는 라이브 룸의 in-memory `gameState`에만 존재하고 DB에 저장하지 않는다.

## 2. 팀 랭킹 정렬 버그

### 원인

- `/api/results/:sessionId`(`server/index.js:429`)는 `getGameResult`(`server/db.js:62`)를 통해 `game_results`를 **항상 `total_assets DESC`로만 정렬**하고 `rank`를 그 순서로 `i+1` 매긴다. `category` 파라미터를 받지 않는다.
- `RankingPage`의 팀 스코프(`src/pages/RankingPage.jsx:57`)는 카테고리를 바꿔도 같은 엔드포인트를 같은 순서로 다시 부르고, **행 순서와 `rank`를 재정렬하지 않는다**. `valueKey`만 바뀌어 값 컬럼만 주식/부동산 값으로 표시되고, 줄 순서·"N위"는 총자산 기준 그대로 남는다.
- 전체/수업 스코프는 `/api/rankings?category=stock`이 서버에서 해당 컬럼으로 정렬하므로 정상. **팀 스코프만 버그.**

### 수정

`RankingPage`의 팀 스코프 `.then` 콜백에서 선택된 카테고리 값으로 클라이언트 재정렬 + rank 재계산:

```js
const vk = VALUE_KEYS[category]
const players = (data.players ?? [])
  .map(p => ({ ...p, stockPrices: data.stockPrices, realEstatePrices: data.realEstatePrices }))
  .sort((a, b) => (b[vk] ?? 0) - (a[vk] ?? 0))
  .map((p, i) => ({ ...p, rank: i + 1 }))
setRows(players)
```

- `category`는 이미 이 effect의 의존성 배열에 있어 탭 전환 시 재정렬된다.
- 동점 처리는 기존 `/api/rankings`와 동일하게 순차 rank(`i + 1`) — dense ranking 안 함.
- 서버 변경 없음.

## 테스트 (TDD)

- `server/rooms.test.js`: partial에 `job` 키가 있으면 `jobVisited: true`가 함께 설정되는지 (`updatePlayerState`, `updatePlayerStateByUuid`)
- `src/components/JobPicker.test.jsx`: 선택된 카드 재클릭 시 `onChange(null)` 호출
- `src/pages/IndividualPage.test.jsx`: step 0에서 직업 미선택으로 "다음" 눌러 진행 가능, `jobVisited: true` emit, StepBar에서 step 0이 완료로 표시
- `src/components/admin/JobEditModal.test.jsx`: 카드 토글, 미선택 확인 시 `onChange(null)`, 안내 문구
- `src/components/admin/AdminEditModal.test.jsx` / `AdminPlayerCard.test.jsx`: `job: null, jobVisited: true` → "무직" 표시, `jobVisited: false` → "미입력"
- `src/components/admin/AdminTableView.test.jsx`: `jobVisited: true`만 있어도 "진행중"
- `src/pages/RankingPage.test.jsx`: 팀 스코프에서 주식/부동산 탭 선택 시 해당 값 기준으로 행이 재정렬되고 rank가 재계산됨 (팀원 2명 이상, 주식 순서 ≠ 총자산 순서)
