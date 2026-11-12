# 공식전 랭킹 시스템 설계

- 요청 문서: `proposal/20261112_official_ranking.md`
- 작성일: 2026-11-12

## 목표

"대회"로 진행한 게임만 따로 모아, 테이블 간 가격 차이에 영향받지 않는 **순위 포인트** 기준의 공식 랭킹을 제공한다. 기존(일반) 랭킹 페이지는 그대로 둔다.

## 용어

- **대회**: 공식전 단위. `classes` 행 중 `kind = 'official'`인 것. 일반 시스템의 수업과 같은 구조다. (예: 2026 시즌1)
- **게임(테이블)**: 한 방(session)에서 함께 플레이한 한 판. 공식전 기준 인원은 4명이지만 2~3명 테이블도 집계한다.
- **공식 참가자**: 대회에 실명으로 등록한 플레이어(`official_players` 행). 식별 기준은 "실명 + 대회"다.

## 확정된 결정 (proposal 6번 항목 포함)

| 항목 | 결정 |
|---|---|
| 6-1 누적 순위에서 같은 사람 묶기 | 묶지 않는다. 누적 순위도 대회별 참가자 단위다. "박병윤 (2026 시즌1)"과 "박병윤 (2026 시즌2)"는 별도 행이다. |
| 6-2 공식전 결과의 일반 랭킹 포함 | 일반 랭킹 "전체" 범위에서 제외한다. 관리자 화면에서 대회를 직접 고르면 수업과 똑같이 그 대회 결과가 보인다. |
| 6-3 4명 미만 테이블 | 결과는 팀 단위로 한 번에 등록되므로 "일부만 등록한 게임"은 생기지 않는다. 대신 4명 미만 테이블은 인원수에 맞춘 포인트표를 쓴다. 1명 테이블은 집계에서 제외한다. |
| 관리자 수동 추가 플레이어 | 대회 방에서는 수동으로 추가할 때도 실명을 입력하고 중복 확인을 거쳐 공식 참가자와 연결한다. |
| 포인트 계산 위치 | DB에 저장하지 않고 조회할 때 서버 JS에서 계산한다. 관리자가 결과를 수정하거나 팀을 삭제해도 즉시 반영된다. |
| 공식 참가자 생성 시점 | 이름을 입력하는 단계에서 생성한다(중복 확인 팝업이 입장할 때 필요하기 때문). |

## 점수 규칙

### 순위 포인트 (메인)

테이블 안에서 `total_assets`(총자산) 순으로 순위를 매기고, 인원 n에 맞춰 포인트표 `[10, 6, 3, 1]`의 앞 n개를 쓴다.

| 인원 | 1위 | 2위 | 3위 | 4위 |
|---|---|---|---|---|
| 4명 | 10 | 6 | 3 | 1 |
| 3명 | 10 | 6 | 3 | – |
| 2명 | 10 | 6 | – | – |
| 1명 | 집계 제외 | | | |

- 총자산이 같으면 공동 순위로 보고, 그 순위들이 차지하는 포인트를 평균 내서 나눠 준다. 예: 4명 중 공동 1위 2명 → 각 (10+6)/2 = 8점, 다음 사람은 3위로 3점.
- 공동 1위는 모두 "1위 횟수"에 포함한다.
- 한 참가자의 포인트는 모든 게임에서 받은 포인트의 합이다.
- 테이블 순위 계산에는 그 테이블 전원의 결과를 쓴다. `official_player_id`가 null인 행이 있으면(정상 흐름에서는 생기지 않음) 인원과 순위 계산에는 포함하고 포인트만 주지 않는다.

### 최고 자산 기록 (보조)

공식전 한 판에서 기록한 `total_assets` 중 가장 높은 값이다. 1명 테이블 기록은 집계 대상이 아니므로 여기서도 제외한다. 화면에는 "테이블마다 가격이 달라 참고용 기록"이라고 안내한다.

### 정렬

- 포인트 순위: 포인트 합계가 높은 순 → 같으면 최고 자산이 높은 순.
- 최고 자산 순위: 최고 자산이 높은 순.
- 두 값 모두 같으면 같은 등수를 준다(1, 1, 3 방식).
- 집계된 게임이 1판 이상인 참가자만 보여 준다. 이름만 등록하고 게임을 마치지 않은 참가자는 나타나지 않는다.

## 1. DB

마이그레이션: `supabase/migrations/2026-11-12-add-official-ranking.sql`

```sql
ALTER TABLE boardgame.classes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'class'
  CHECK (kind IN ('class', 'official'));

CREATE TABLE IF NOT EXISTS boardgame.official_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES boardgame.classes(id) ON DELETE CASCADE,
  real_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, real_name)
);

ALTER TABLE boardgame.game_results
  ADD COLUMN IF NOT EXISTS official_player_id uuid
  REFERENCES boardgame.official_players(id) ON DELETE SET NULL;
```

- 컬럼 이름은 예전에 삭제한 `mode`(경쟁 모드)와 겹치지 않도록 `kind`로 한다.
- 기존 수업은 모두 `kind = 'class'`가 된다.
- `real_name`은 앞뒤 공백을 제거해서 저장한다. 비교도 같은 기준으로 한다.
- 배포 순서: 마이그레이션 실행 → 코드 배포. 새 컬럼에는 모두 기본값이 있거나 null을 허용하므로, 기존 코드가 먼저 동작해도 문제없다.
- `supabase/schema.sql`에도 반영한다.

## 2. 서버

### `server/classes.js`

- `createClass(name, adminId, kind = 'class')`: `kind`를 저장한다. `'class'`나 `'official'`이 아닌 값이 들어오면 `'class'`로 저장한다.
- `listClassesForAdmin`: 각 항목에 `kind`를 포함한다. 미배정 수업은 `'class'`다.
- `getClassInfo(classId)` → `{ kind, name }`: 미배정이거나 없는 수업이면 `{ kind: 'class', name: null }`을 돌려준다.

### `server/officialPlayers.js` (신규)

- `normalizeRealName(name)`: 앞뒤 공백을 제거한다.
- `findOfficialPlayer(classId, realName)` → 행 또는 null.
- `createOfficialPlayer(classId, realName)`: 새 행을 만든다. 동시에 생성되어 unique 위반(23505)이 나면 기존 행을 다시 조회해서 돌려준다.
- `getOfficialPlayer(id)`: `join-room`과 수동 추가 검증에 쓴다(id가 해당 대회 소속인지 확인).

### `server/officialRanking.js` (신규, 순수 함수)

- `POINTS = [10, 6, 3, 1]`
- `tablePoints(results)` → `Map<officialPlayerId, { points, isFirst }>`
  - 인원 1명이면 빈 Map을 돌려준다.
  - 총자산이 같은 그룹마다 해당 순위 구간의 포인트 평균을 준다.
  - `officialPlayerId`가 없는 행은 순위 계산에만 쓴다.
- `buildOfficialRankings(rows)` → `{ points: Row[], bestAssets: Row[] }`
  - 입력은 대회 게임의 `game_results` 행(세션 id, 대회 id·이름, `official_player_id`, `name`, `character`, `total_assets`, `created_at` 포함)이다.
  - 세션별로 묶어서 `tablePoints`를 적용한 뒤, 참가자별로 다음 값을 모은다.
    - `officialPlayerId`, `realName`, `contestId`, `contestName`
    - `points`, `games`, `wins`
    - `bestAssets`, `bestAssetsContestName`
    - `character`(가장 최근 `created_at` 게임의 캐릭터)
  - 정렬 규칙에 따라 두 목록을 만들고 `rank`를 매긴다.
  - 행 이름은 공식 참가자의 `real_name`을 쓴다(`game_results.name`이 아님).

### `server/db.js`

- `saveGameResult`: 각 행에 `official_player_id: player.officialPlayerId ?? null`을 추가한다.
- `getOfficialResultRows({ classId })`: `game_sessions!inner(class_id, classes!inner(name, kind))` 조인으로 `kind = 'official'`인 결과만 가져오고, `official_players(real_name)`도 함께 가져온다. `classId`가 있으면 그 대회만 가져온다.
- `getRankings`: `classId`가 없을 때(전체 범위) 대회 결과를 제외한다. `classes.kind`가 `'official'`인 세션을 빼되, 미배정(`class_id` null) 세션은 유지한다. `classId`가 있으면 지금처럼 그 수업이나 대회의 결과를 보여 준다.
- `getGameResult` 응답의 플레이어 정보에 `officialPlayerId`를 포함한다.

### API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/classes/:classId/kind` | `{ kind, name }`. 대회 QR(`/join?classId=`) 입장 판별용. |
| GET | `/api/rooms/:code/kind` | `{ kind, classId, name }`. 팀 QR이나 팀 코드 입장 판별용. 방이 없으면 404. |
| POST | `/api/contests/:classId/players/resolve` | body `{ realName, confirm? }`. 아래 참고. |
| GET | `/api/official-rankings?classId=` | `{ contests: [{ id, name, createdAt }], points: Row[], bestAssets: Row[] }`. `classId`가 없으면 누적 범위다. |
| POST | `/api/admin/classes` | 기존 API. `{ name, kind }`를 받는다. |

`resolve` 동작:

- 대회가 아니거나(`kind !== 'official'`) 이름이 비어 있으면 400.
- 같은 이름이 없으면 새로 만들고 `{ officialPlayerId }`를 돌려준다.
- 같은 이름이 있고 `confirm`이 없으면 `{ exists: true, label: "박병윤 (2026 시즌1)" }`을 돌려준다(생성하지 않는다).
- 같은 이름이 있고 `confirm: true`면 기존 참가자의 `{ officialPlayerId }`를 돌려준다.

`/api/rooms/:code/submit`과 관리자 `submit-pending` 등록 조건은 바꾸지 않는다(2~4명 등록 가능).

### 방과 소켓 (`server/rooms.js`, `server/index.js`)

- `createRoom`: 방을 만들 때 대회 여부를 `room.isOfficial`에 저장한다. 서버가 검증할 때마다 DB를 조회하지 않기 위해서다.
- `join-room` payload에 `officialPlayerId`를 추가한다. 대회 방이면 다음을 검사한다.
  - `officialPlayerId`가 없거나, 그 대회 소속이 아니면 거절한다. 안내: "대회 QR로 다시 들어와 주세요".
  - 같은 방에 같은 `officialPlayerId`가 다른 `playerUuid`로 이미 있으면 거절한다. 안내: "이미 이 테이블에 참가 중이에요". 같은 `playerUuid`로 재접속하는 경우는 허용한다.
  - 통과하면 플레이어 정보에 `officialPlayerId`를 저장한다.
- 일반 방에서는 `officialPlayerId`를 무시한다(null로 저장).
- 관리자 수동 추가 API(`addManualPlayer`)는 `officialPlayerId`를 받는다. 대회 방이면 필수이고, `join-room`과 같은 소속·중복 검사를 거친다.

## 3. 입장 흐름 (프론트)

### `NameInput` (`/join`)

1. 들어오면 대회 여부를 확인한다. `classId`가 있으면 `/api/classes/:classId/kind`, `code`가 있으면 `/api/rooms/:code/kind`를 호출한다. 판별이 끝날 때까지 입력칸을 비활성화한다. 조회에 실패하면 일반 흐름으로 진행한다(서버 `join-room`에서 한 번 더 막는다).
2. 일반이면 지금과 똑같이 동작한다.
3. 대회이면 다음처럼 바뀐다.
   - 상단에 대회 이름을 보여준다(예: 🏆 2026 시즌1).
   - 라벨은 "실명을 입력하세요", placeholder는 "예) 홍길동 (실명)"이다.
   - [다음]을 누르면 `resolve`를 호출한다.
     - 응답에 `officialPlayerId`가 있으면 다음 단계로 간다.
     - `exists: true`면 확인 팝업을 띄운다. 문구: "{label} 님이 맞나요?"
       - [네, 맞아요] → `confirm: true`로 다시 호출하고 다음 단계로 간다.
       - [아니요] → 팝업을 닫고 입력칸 아래에 "같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: 박병윤B)"를 보여준 뒤 입력칸에 포커스를 준다.
   - `resolve`를 호출하는 동안에는 버튼을 비활성화한다. 실패하면 오류 문구를 보여준다.
4. 다음 단계로 넘길 때 `officialPlayerId`를 쿼리에 추가한다. 경로는 `/select` → `/lobby`이고, `affiliation`을 넘기는 방식과 같다. `name`에는 실명을 넣는다.

### `CharacterSelect`, `Lobby`

- `officialPlayerId` 쿼리를 다음 단계로 넘긴다.
- `Lobby`는 `join-room`에 `officialPlayerId`를 담아 보낸다. `sessionStorage`의 `player_profile`에도 저장해서 재접속할 때 그대로 쓴다.
- `join-room`이 거절되면 서버 안내 문구를 그대로 보여준다.

### 내 기록 식별

- 결과 화면(`/result/:sessionId`)은 `/api/results/:sessionId` 응답에서 내 `playerUuid`와 일치하는 플레이어를 찾는다. 그 플레이어에게 `officialPlayerId`가 있으면 `localStorage`의 `official_player_ids`(대회 id → 공식 참가자 id 맵)에 저장한다. `localStorage` 접근은 try/catch로 감싼다.
- 이 방식은 기기 단위라서, 다른 기기에서는 "내 기록"이 표시되지 않는다(허용).

## 4. 관리자 화면

### 게임 목록 탭 (`AdminClassList`, `adminNavItems.js`)

- 탭 label과 화면 제목을 "수업 목록"에서 "게임 목록"으로 바꾼다.
- 상단 생성 영역을 two-column으로 바꾼다.
  - 왼쪽: 수업 생성하기 (기존 그대로, `kind: 'class'`)
  - 오른쪽: 대회 생성하기 (대회 이름 입력 → `kind: 'official'`)
  - 모바일 폭에서는 세로로 쌓는다(기존 모바일 대응 패턴을 따른다).
- 목록에서 `kind === 'official'`인 항목은 이름 옆에 "공식" 뱃지를 붙인다.
- 대시보드, 결과 확인, 가격 설정, QR, 이름 변경, 삭제는 수업과 같게 동작한다.

### 대회 대시보드 (`AdminClassDashboard`)

- 제목의 대회 이름 옆에 "공식" 뱃지를 붙인다.
- 1명으로 등록된 팀 카드에는 "공식 집계 제외(1인)" 표시를 붙인다.

### 수동 플레이어 추가 (`AdminAddPlayerModal`)

- 대회 방이면 이름 라벨을 "실명"으로 바꾼다.
- 저장하기 전에 `resolve`를 호출한다. `exists`면 모달 안에서 "{label} 님이 맞나요?"를 확인받는다.
  - [네] → `confirm`으로 다시 호출한다.
  - [아니요] → 이름을 바꾸도록 안내한다.
- 받은 `officialPlayerId`를 수동 추가 API에 함께 보낸다.

## 5. 공식 랭킹 페이지

### 라우트와 진입

- 새 라우트 `/ranking/official`과 페이지 `src/pages/OfficialRankingPage.jsx`를 만든다. 쿼리 `?classId=`가 있으면 해당 대회 범위로 시작한다.
- `RankingPage`의 오른쪽 상단에 "공식 랭킹 보러가기" 버튼을 둔다. 홈 랭킹(`/ranking`)과 결과 화면(`/result/:sessionId`) 모두에 표시한다.
- 공식 랭킹 페이지의 뒤로가기는 이전 기록이 있으면 `navigate(-1)`, 없으면 `/ranking`으로 간다.

### 대회 게임 직후의 결과 화면 (`/result/:sessionId`)

- 세션의 수업이 대회이면, 범위 탭 "우리 수업"의 이름을 "우리 대회"로 바꾼다. 이 탭을 누르면 `/ranking/official?classId=...`로 이동한다.
- "우리 팀" 범위는 그대로 둔다(테이블 안 총자산 순위).
- "전체" 범위는 일반 랭킹이고, 대회 결과가 빠진다.

### 화면 구성

- 프레임은 `onboarding-mode`, 제목은 "공식 랭킹"이다.
- 범위 선택: [누적] 버튼과 대회 드롭다운(`<select>`, 최신 대회부터)을 둔다.
- 탭: [포인트 순위](기본), [최고 자산]. 최고 자산 탭에는 "테이블마다 가격이 달라 참고용 기록이에요."라고 안내한다.
- 1~3위는 `RankingPodium`으로, 나머지는 `RankingTable`로 보여준다.

| | 값 칸 | 둘째 줄 |
|---|---|---|
| 포인트 순위 | "24점" (소수점이 있으면 소수 첫째 자리까지, 예: "24.5점") | "5게임 · 1위 2회" |
| 최고 자산 | "1,234,000원" | 기록한 대회 이름 |

- 누적 범위에서는 이름을 "박병윤 (2026 시즌1)"로 표시한다. 대회별 범위에서는 실명만 표시한다.
- 캐릭터는 그 참가자의 가장 최근 게임 캐릭터를 쓴다.
- 내 기록: `localStorage`의 `official_player_ids`에 있는 id와 일치하는 행을 맨 아래에 고정한다. 누적 범위에서는 저장된 모든 id 중 첫 번째 일치 행을 쓰고, 대회별 범위에서는 그 대회의 id를 쓴다.
- 빈 상태에는 "아직 집계된 공식 게임이 없어요"를 보여준다.
- 행 클릭 동작은 넣지 않는다.

### `RankingTable` / `RankingPodium` 확장 (하위 호환)

- `formatValue(row)` prop: 기본값은 지금처럼 "N원"이다.
- `getRowKey(row)` prop: 기본값은 지금의 key 규칙이다.
- `highlightKey` + `getHighlightId(row)` prop: 기본값은 지금처럼 `highlightPlayerUuid`와 `row.playerUuid`를 비교한다.
- 고정된 내 행의 둘째 줄도 `getSub`를 따른다. 기본 `getSub`가 `row.className`이므로 기존 화면은 그대로다.
- 기존 호출부는 바꾸지 않는다.

## 6. 테스트

- `server/officialRanking.test.js`
  - 4명, 3명, 2명 포인트
  - 1명 테이블 제외(포인트와 최고 자산 모두)
  - 공동 1위 2명(8/8/3/1), 공동 2위, 3명 공동(19/3점씩), 전원 동점
  - 공동 1위의 1위 횟수 처리
  - `official_player_id`가 null인 행이 섞인 테이블
  - 포인트가 같을 때 최고 자산 순, 완전 동점이면 같은 등수
  - 최근 캐릭터 선택
  - 여러 대회의 행이 섞였을 때 참가자별로 분리되는지
- `server/officialPlayers.test.js`: 이름 공백 정규화, 23505가 나면 기존 행을 돌려주는지
- `server/classes.test.js`: `kind` 저장(잘못된 값은 `'class'`), 목록에 `kind` 포함, `getClassInfo`
- `server/db.test.js`: `saveGameResult`가 `official_player_id`를 저장하는지, `getRankings` 전체 범위에서 대회가 빠지는지, `getOfficialResultRows` 필터
- `server/rooms.test.js` / API
  - 대회 방에 `officialPlayerId` 없이, 또는 다른 대회 id로 입장하면 거절
  - 같은 사람의 중복 입장 거절과 재접속 허용
  - 수동 추가 검증
  - `resolve`의 세 가지 분기
- 프론트
  - `NameInput`: 대회 분기 UI, 확인 팝업의 네/아니요, 일반 흐름 회귀
  - `AdminClassList`: 제목, 두 생성 폼, 뱃지
  - `OfficialRankingPage`: 범위 전환, 탭 전환, 단위 표시, 내 기록 고정, 빈 상태
  - `RankingTable`: 새 prop 기본값이 기존 동작과 같은지
  - `RankingPage`: 공식 랭킹 버튼, 대회 결과 화면의 "우리 대회" 이동
- 수동 확인: 대회 생성 → 대회 QR로 4명 입장(동명이인 [아니요], 같은 사람 [네] 포함) → 등록 → 공식 랭킹의 누적/대회별과 두 탭 확인 → 일반 랭킹 전체에서 대회 결과가 빠졌는지 확인

## 범위 밖

- 대회를 넘는 "선수" 개념(시즌 간 동일인 합산, 동명이인 병합)
- 공식 랭킹 행 클릭(보고서 보기)
- 다른 기기에서의 "내 기록" 식별
- 공식 참가자 이름 수정과 병합 같은 관리 기능
