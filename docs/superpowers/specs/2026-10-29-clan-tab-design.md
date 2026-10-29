# 경쟁 모드 롤백 · 팀(클랜) 탭 설계

- 작성일: 2026-10-29
- 요청 문서: `proposal/20261029_changed_competition_mode.md`
- 대체하는 설계: `2026-10-21-competition-mode-design.md`, `2026-10-26-team-competition-design.md`

## 목표

1. **경쟁 모드를 없앤다.** 일반/경쟁 모드 구분, 대기 명단, 참여자 가격, 결과 화면 팀 비교 캐러셀과 관련 DB 컬럼을 모두 걷어낸다. 일반 모드는 경쟁 모드 도입 전(`ce284f3^`)과 똑같이 동작해야 한다.
2. **팀 현황 페이지에 트로피 탭을 추가한다.** 결과 등록을 마친 참여자를 관리자가 드래그 앤 드롭으로 **팀(클랜)**에 묶고, 클랜 통계 화면으로 가는 배너를 둔다.

용어: **팀(게임)** = 지금의 방(함께 보드게임을 한 모둠). **팀(클랜)** = 결과 등록 후 관리자가 묶는 새 그룹. 화면에서는 둘 다 "팀"이라 부르고, 이 문서와 코드에서는 클랜을 `clan`으로 쓴다.

새 흐름: 팀(게임) 생성/참여 → 자산 입력 → 관리자가 팀(게임)별 가격 설정 → 결과 발표(일반 모드 결과 화면) → 관리자가 트로피 탭에서 클랜 배정 → 클랜 통계(다음 작업).

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 롤백 방식 | 파일별로 직접 걷어낸다(`git revert` 사용 안 함). 경쟁 모드 커밋 사이에 시너지·부모 안내서 커밋이 섞여 있고 `ParentGuide`가 `pricesForPlayer`를 쓰기 때문이다. |
| 남기는 리팩터 | `AssetInputSteps` 분리, `PriceListEditor` 분리. 동작 변화가 없다. |
| DB 롤백 | 새 마이그레이션에서 `DROP COLUMN IF EXISTS`. 운영 적용 여부와 관계없이 안전하다. |
| 클랜 저장 | 서버 메모리. 재시작·재배포 시 사라진다(아래 "운영 주의"). |
| 참여자 식별 | `game_results.id`(= `resultId`). |
| 클랜 이름 | 처음엔 "팀 N"(수업별 번호, 다시 쓰지 않음), 관리자가 카드 제목을 눌러 바꿀 수 있다. |
| 인원 | 제한 없음. 한 참여자는 클랜 하나에만 속한다. |
| 배너 위치 | 트로피 탭 맨 위. |
| 클랜 통계 화면 | `AdminDashboard`의 새 section `clan-recap`. 이번에는 "준비 중" 화면만 만든다. |

### 검토했지만 택하지 않은 방식

- **`git revert`로 경쟁 모드 커밋 약 33개 되돌리기**: `ParentGuide`·`RankingPage` 등에서 충돌이 많고, 남겨도 되는 리팩터까지 되돌아간다.
- **경쟁 모드 코드를 남겨두고 진입로만 막기**: "모두 롤백" 요청과 맞지 않고 죽은 코드가 남는다.
- **클랜을 DB에 저장**: 사용자가 메모리 저장을 골랐다.

## 1. 롤백 범위

### 서버

| 대상 | 처리 |
|---|---|
| `server/classPool.js`, `server/competition.js`, `server/prices.js` (+ 각 테스트) | 삭제 |
| `server/index.js` | 경쟁 모드 API(`GET /api/classes/:classId/mode`, `…/pool`, `DELETE …/pool/:playerUuid`, `…/assign`, `GET /api/results/:sessionId/competition`)와 소켓 이벤트(`join-class-pool`, `update-pool-player-state`) 삭제. `submit-pending`, 방 삭제, 수업 삭제, 플레이어 수정 경로의 경쟁 분기·`sanitizePrices` 호출 제거. |
| `server/classes.js` | `mode` 저장·조회 제거 |
| `server/rooms.js` | `room.mode`, `addAssignedPlayer` 제거 |
| `server/db.js` | `calculateAssetBreakdown`의 `gameState.prices ?? prices` 제거, `rowPrices`·행 가격 컬럼 읽기/쓰기 제거, `RANKING_SELECT`에서 행의 `stock_prices, real_estate_prices` 제거, `getCompetitionTeams` 삭제. `GET /api/results/:sessionId`의 참여자별 가격 필드 제거(최상위 세션 가격만). |

### DB

- 새 마이그레이션 `supabase/migrations/2026-10-29-drop-competition-mode.sql`:
  ```sql
  ALTER TABLE boardgame.classes DROP COLUMN IF EXISTS mode;
  ALTER TABLE boardgame.game_results DROP COLUMN IF EXISTS stock_prices;
  ALTER TABLE boardgame.game_results DROP COLUMN IF EXISTS real_estate_prices;
  ```
- 이전 마이그레이션 파일 2개는 기록으로 남긴다.
- **배포 순서**: 코드를 먼저 배포한 뒤 마이그레이션을 실행한다(반대로 하면 이전 코드가 없는 컬럼을 조회해 오류).

### 화면

| 대상 | 처리 |
|---|---|
| `CompetitionPlay`, `CompetitionPoolBlock`, `CompetitionResultCarousel`, `TeamStatSlide`, `utils/classMode.js`, `utils/competitionReadiness.js`, `utils/playerPrices.js`, `constants/competition.js` (+ CSS·테스트) | 삭제 |
| `App.jsx` | `/compete/:classId` 경로 삭제 |
| `CharacterSelect` | 모드 확인 분기 삭제(항상 `/lobby`) |
| `AdminClassList` | 일반/경쟁 선택, 경쟁 배지, `.itemTitleRow` 관련 스타일 삭제 |
| `AdminDashboard` | `AdminClassDashboard`에 `mode` 넘기기 삭제 |
| `AdminClassDashboard` | `mode`, 대기 명단, 준비 상태, 드래그 배정 삭제. 등록 버튼은 "전체 등록" 고정 |
| `AdminGridCard`, `AdminGridView`, `AdminSpectateModal` | `competition` prop, 드래그, 참여자 가격 버튼 삭제 |
| `RankingPage` | 대회 결과 요청·캐러셀 분기 삭제, 랭킹 본문을 원래 구조로 |
| `EconomicReport`, `ParentGuide` | `pricesForPlayer` 대신 결과(세션) 가격 사용 |
| `AssetInputSteps` | `editablePrices`·가격 단계 삭제. 5단계만 남기고 `IndividualPage`가 쓴다 |
| `src/utils/calculateAssets.js` | 참여자 가격 우선 로직 삭제 |

## 2. 클랜 서버

### `server/clans.js` (새 모듈, 메모리)

```js
// clansByClass: Map<classId, { counter, clans: Map<clanId, Clan> }>
// Clan = { id, name, createdAt, memberIds: Set<resultId> }
createClan(classId)                       // 이름 "팀 {counter}". counter는 수업별로 1씩 증가하고 재사용하지 않는다
renameClan(classId, clanId, name)         // trim 후 1~20자. 아니면 오류
deleteClan(classId, clanId)               // 멤버는 배정 해제
assignToClan(classId, resultId, clanId)   // clanId null이면 해제. 다른 클랜에 있으면 빼고 옮긴다
listClans(classId)                        // createdAt 오름차순
pruneMembers(classId, validResultIds)     // DB에 없는 resultId를 지운다
deleteClassClans(classId)                 // 수업 삭제 시
```

### 참여자 데이터

- `RANKING_SELECT`에 `id`를 추가한다. `getRankings({ classId })`가 이 수업의 결과 등록 참여자 행을 준다.
- 서버가 행을 메모리 배정과 합친다: 클랜에 속한 행은 그 클랜의 `members`, 나머지는 `participants`. 응답 전에 `pruneMembers`로 DB에서 사라진 `resultId`를 정리한다.
- 참여자 항목: `{ resultId, name, character, teamName }`. `teamName`은 플레이한 팀(게임) 이름(세션 제목, 없으면 팀 현황과 같은 "팀 N" 규칙).

### API (모두 `requireAdmin`)

| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | `/api/admin/classes/:classId/clans` | `{ participants, clans: [{ id, name, members }] }` |
| POST | `/api/admin/classes/:classId/clans` | 빈 클랜 생성 → 만든 클랜 |
| PATCH | `/api/admin/classes/:classId/clans/:clanId` | `{ name }` 이름 변경 |
| DELETE | `/api/admin/classes/:classId/clans/:clanId` | 클랜 삭제, 멤버 해제 |
| POST | `/api/admin/classes/:classId/clans/assign` | `{ resultId, toClanId }`, `toClanId` null이면 해제 |

- 검증: 없는/다른 수업의 클랜 → `404 { error: '팀을 찾을 수 없어요' }`, 이 수업의 결과 등록 참여자가 아님 → `404 { error: '참여자를 찾을 수 없어요' }`, 잘못된 이름 → `400`.

### 실시간 갱신

- 클랜이 바뀌면 기존 `watch-class-rooms` 채널에 `class-clans-updated`를 보낸다.
- 결과 등록(`submit-pending`, `POST /api/rooms/:code/submit`)과 등록된 팀 삭제 후에도 같은 이벤트를 보낸다.
- 수업 삭제 시 `deleteClassClans(classId)`.

## 3. 트로피 탭 화면

### 탭

- `AdminClassDashboard`의 `TABS` 끝에 `{ key: 'clans', label: '팀 대결', icon: '/icons/IconTrophy.svg' }` 추가. 아이콘은 mask용 단색 SVG를 새로 만든다.
- 도구 줄은 그대로 두고 검색창만 이 탭에서 숨긴다.

### 레이아웃 (위 → 아래)

1. **`ClanRecapBanner`** (`src/components/admin/ClanRecapBanner.jsx`)
   - Discord Checkpoint 스타일 가로 띠: 어두운 초록 그라데이션 + 은은한 패턴, 왼쪽 트로피 아이콘, 제목 "팀 대결 결과", 부제 "팀별 자산을 한눈에 비교해 보세요", 오른쪽 테두리 있는 → 버튼.
   - 띠 전체가 버튼(`onOpen`). 누르면 `AdminDashboard` section이 `clan-recap`이 된다.
2. **게임 전체 통계**: 기존 `AdminStatCards({ rooms })` 그대로.
3. **`ClanParticipantBlock`** (`src/components/admin/ClanParticipantBlock.jsx`)
   - `CompetitionPoolBlock` 모양을 옮긴다. 카드 = 캐릭터 + 이름 + 작은 팀(게임) 이름. 머리글 "참여자 N명", 안내 "팀 카드로 끌어다 놓아 배정하세요".
   - 비어 있으면 "결과 등록을 마친 참여자가 여기에 표시돼요". 삭제 버튼 없음.
   - 클랜 멤버를 여기로 놓으면 배정 해제.
4. **클랜 그리드**
   - **`ClanCard`** (`src/components/admin/ClanCard.jsx`)
     - 머리글: 이름(누르면 입력창, Enter/blur 저장, Esc 취소, 비거나 20자 초과면 원래 이름으로), "N명", × 삭제(`ConfirmDialog` 확인 후).
     - 본문: 2×2 슬롯(캐릭터 + 이름), 빈 슬롯은 점선.
     - 5명 이상이면 처음 4명만 보이고 아래에 **"외 N명"** 버튼. 누르면 펼쳐서 모든 멤버를 2열로 보여주고, 다시 누르면 접는다. 펼친 상태에서는 모든 멤버를 끌 수 있다.
   - 그리드 끝에 기존 "방 만들기" 카드 모양의 **"+ 팀 만들기"** 카드.

### 드래그 앤 드롭 (HTML5 기본, PC 기준)

- 드래그 타입 상수 `CLAN_MEMBER_DRAG_TYPE`(`src/constants/clan.js`), 값은 `resultId`.
- 참여자 → 클랜: 배정. 클랜 → 다른 클랜: 이동. 클랜 → 참여자 블럭: 해제. 같은 곳에 놓으면 요청하지 않는다.
- 드래그 중 놓을 수 있는 영역의 테두리를 강조한다.
- 낙관적 갱신: 화면을 먼저 바꾸고, 실패하면 되돌린 뒤 서버 오류 문구를 토스트로 보여주고 목록을 다시 불러온다.

### 데이터 흐름

- 트로피 탭이 열려 있을 때만 `GET …/clans`를 요청한다. `class-clans-updated`를 받으면 다시 불러온다.

### 클랜 통계 화면 (`ClanRecapPage`)

- `AdminDashboard`의 section `clan-recap`. 뒤로가기 버튼 + 수업 이름 + "준비 중이에요" 문구.
- 뒤로가기 시 `team-status` section의 트로피 탭으로 돌아온다(`AdminClassDashboard`에 `initialTab` prop).

## 4. 예외 처리

| 상황 | 동작 |
|---|---|
| 서버 재시작·재배포 | 클랜과 배정이 사라지고 참여자는 블럭으로 돌아온다(운영 주의). |
| 배정 대상 결과가 그사이 삭제됨 | `404` → 토스트 "참여자를 찾을 수 없어요", 다시 불러오기 |
| 클랜이 그사이 삭제됨 | `404` → 토스트 "팀을 찾을 수 없어요", 다시 불러오기 |
| 이름이 비거나 20자 초과 | 화면에서 원래 이름으로 되돌림, 서버도 `400` |
| 등록 후 결과 수정 | `resultId` 기준이라 배정 유지 |
| 등록된 팀 삭제 | 다음 조회 때 `pruneMembers`로 정리 |

### 운영 주의

클랜 배정은 서버 메모리에만 있다. 수업 중(배정 후 통계 확인까지)에는 배포하지 않는다.

## 5. 테스트

**서버**

- `clans.js`: 생성 이름 "팀 N"과 번호 재사용 안 함, 이름 검증, 배정·이동·해제, 삭제 시 멤버 해제, 수업별 분리, `pruneMembers`, `deleteClassClans`.
- API: 참여자/클랜 분리, 사라진 `resultId` 정리, 다른 수업의 클랜·참여자 `404`, 잘못된 이름 `400`, 변경 시 `class-clans-updated` 전송, 결과 등록 후 이벤트 전송.
- 롤백 회귀: 수업 생성·조회에 `mode` 없음, `saveGameResult`가 행 가격 컬럼에 쓰지 않음, 경쟁 모드 API 없음.

**화면**

- `ClanCard`: 4명 이하 2×2, 5명 이상 "외 N명", 펼치기/접기, 이름 수정 Enter/Esc/빈 값, 삭제 확인.
- `ClanParticipantBlock`: 목록·빈 문구, 드롭 시 해제 호출.
- `ClanRecapBanner`: 클릭 시 `onOpen`.
- `AdminClassDashboard`: 트로피 탭 전환 시 클랜 요청, 드래그 배정 API 호출, 실패 시 되돌림, 배너로 recap 이동.
- `AdminDashboard`: recap 뒤로가기 시 트로피 탭으로 복귀.

**회귀**: 기존 테스트 전체 통과(삭제한 경쟁 모드 테스트 제외). `IndividualPage`, `RankingPage`, `EconomicReport`, `ParentGuide`는 세션 가격 기준으로 통과.

## 범위 밖

- 클랜 통계 화면 내용(다음 작업)
- 클랜 DB 저장
- 터치(태블릿) 드래그 앤 드롭
