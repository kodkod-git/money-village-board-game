# 팀(클랜) 통계 스토리 설계

- 작성일: 2026-10-30
- 요청 문서: `proposal/20261030_competition_statistics.md` (참고: 인스타그램 스토리 화면 `proposal/image-3.png`, 유튜브 리캡)
- 선행 설계: `docs/superpowers/specs/2026-10-29-clan-tab-design.md`

## 목표

트로피 탭의 클랜 통계 배너를 누르면, 지금 화면 위로 어두운 배경이 서서히 덮이고 **인스타그램 스토리처럼 넘겨 보는 세로 카드**로 클랜 대결 결과를 보여준다. 교실 화면(프로젝터)에 띄워 학생들과 함께 보는 용도다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 비교 수치 | 클랜 **합계**(클랜 인원은 운영에서 비슷하게 맞춘다) |
| 장 구성 | 6장: 인트로 → 현금 → 주식 → 부동산 → 총 자산 → 최종 순위 |
| 넘기기 | 수동만(자동 넘김 없음). 화살표 버튼, 카드 탭, 키보드 ←/→, Esc 닫기 |
| 카테고리 장 연출 | 꼴찌부터 막대가 차례로 차오르고 마지막에 1위 공개 |
| 계산 위치 | 서버(`server/clanRecap.js`), 새 API 하나 |
| 화면 형태 | 트로피 탭 위 오버레이(portal). 기존 "준비 중" section은 지운다 |
| 총 자산 | 기존 `total_assets`(성공열쇠 배수 포함) 합계. 현금+주식+부동산 합과 다를 수 있다 |

### 검토했지만 택하지 않은 방식

- **화면에서 합산**: 학생 입력마다 다시 받는 `GET …/clans` 응답이 커지고, 통계 계산이 화면에 섞인다.
- **별도 URL 페이지**: 관리자 화면은 section 상태로 화면을 바꾸므로 인증·라우팅을 새로 만들어야 한다.
- **1인당 평균**: 인원을 맞춰 운영하므로 합계가 더 직관적이다.

## 1. 데이터

### `server/clanRecap.js` — `buildClanRecap(rows, clans)`

- 입력: `getRankings({ classId })` 행(`resultId`, `cash`, `stockValue`, `realEstateValue`, `totalAssets`), `listClans(classId)`(`{ id, name, memberIds }`).
- 멤버 중 행이 있는 사람만 센다(DB에서 사라진 결과 제외). 멤버가 0명인 클랜은 뺀다.
- 값이 `null`이면 0으로 더한다. 결과는 `Math.round`한 정수.
- 반환:

```js
{
  teamCount,      // 비교에 들어간 클랜 수
  memberCount,    // 그 클랜들의 인원 합
  teams: [{ id, name, memberCount, cash, stockValue, realEstateValue, totalAssets }], // 클랜 목록 순서
}
```

### API `GET /api/admin/classes/:classId/clans/recap`

- `requireAdmin` + `denyClassAccess`. `loadClanRows(classId)`로 행을 읽고(사라진 결과 정리), `buildClanRecap(rows, listClans(classId))`를 돌려준다.
- 실패 시 `500 { error: '팀 대결 결과를 불러오지 못했어요' }`.
- `GET /clans/recap`은 `PATCH`·`DELETE /clans/:clanId`와 메서드가 달라 겹치지 않는다.

## 2. 화면

### 열기 (`AdminClassDashboard`)

- 배너를 누르면 recap을 불러온다. 불러오는 동안 배너를 비활성화한다(`ClanRecapBanner`에 `disabled` prop).
- 실패 → 토스트(서버 오류 문구 또는 "팀 대결 결과를 불러오지 못했어요").
- `teamCount === 0` → 토스트 "팀에 참여자를 배정하면 결과를 볼 수 있어요". 오버레이를 열지 않는다.
- 성공 → `ClanRecapStory`를 연다. 닫으면 트로피 탭 그대로.

### 정리

- `src/pages/ClanRecapPage.jsx`(+css, test) 삭제.
- `AdminDashboard`: `clan-recap` section, `teamStatusTab` 상태, `activeSection` 예외, `ClanRecapPage` import 삭제. `AdminClassDashboard`에 `initialTab`·`onOpenClanRecap`을 넘기지 않는다.
- `AdminClassDashboard`: `initialTab`·`onOpenClanRecap` prop 삭제(탭 초기값은 `'grid'`).

### `ClanRecapStory` (`src/components/admin/ClanRecapStory.jsx`)

- props: `{ className, recap, onClose }`. `createPortal(…, document.body)`로 그려 사이드바까지 덮는다. `role="dialog"`, `aria-modal="true"`, `aria-label="팀 대결 결과"`.
- **배경**: `position: fixed; inset: 0`, 0.4초에 걸쳐 투명 → `rgba(10, 10, 12, 0.92)`(fade). 배경을 눌러도 닫히지 않는다.
- **카드**: 가운데, 세로 9:16, 높이 `min(88vh, 820px)`, 둥근 모서리. 열릴 때 살짝 커지며 나타난다(scale 0.96 → 1). 장마다 배경 그라데이션:
  - 인트로·최종 순위: 초록(배너와 같은 계열) / 현금: 초록 / 주식: 파랑 / 부동산: 주황 / 총 자산: 보라
- **위쪽**: 진행 막대 6칸(지난 장 채움, 현재 장 강조, 다음 장 흐림, `data-state="done|current|todo"`), 그 아래 수업 이름. 화면 오른쪽 위 모서리에 × 닫기(`aria-label="닫기"`).
- **넘기기**:
  - 카드 좌우 바깥의 ‹ ›(`aria-label="이전"`, `"다음"`). 첫 장에선 ‹, 마지막 장에선 › 숨김.
  - 카드 왼쪽 1/3을 누르면 이전, 나머지는 다음(첫·마지막 장에서는 아무 일 없음).
  - 키보드: ← 이전, → 다음, Esc 닫기(`window` keydown, 닫히면 해제).
- 항상 인트로부터 시작한다. 현재 장 번호는 오버레이 상태로만 둔다.
- 열려 있는 동안 `document.body`의 스크롤을 막고 닫으면 되돌린다.

### 장

1. **`RecapIntroSlide`**: 🏆, "{수업 이름} 팀 대결 결과", "{teamCount}개 팀 · {memberCount}명이 겨뤘어요", "오른쪽으로 넘겨 결과를 확인하세요 ›".
2–5. **`RecapCategorySlide`** (`{ title, valueKey, teams }`)
   - 제목: "현금을 가장 많이 모은 팀은?" / "주식으로 가장 많이 번 팀은?" / "부동산으로 가장 많이 번 팀은?" / "총 자산이 가장 많은 팀은?"
   - 값이 큰 팀이 위(동점이면 클랜 순서). 줄마다 `팀 이름 | 막대 | 금액`. 막대 길이 = `값 / 1위 값 × 100%`(1위 값이 0이면 모두 0).
   - 금액은 `toLocaleString('ko-KR')` + "원".
   - **공개 연출**: 맨 아래 줄부터 `step = min(350ms, 2400ms / 팀 수)` 간격으로 막대가 0 → 제 길이로 차오른다(각 0.5초). 마지막 막대가 다 찬 뒤 "🏆 {1위 팀 이름}"이 위쪽에 크게 떠오른다. 동점 1위는 " · "로 이어 쓴다.
   - 연출은 CSS `animation-delay`로 하고 줄마다 `--delay`를 넘긴다. 장이 바뀌면 `key`로 다시 마운트해 처음부터 재생한다.
   - `prefers-reduced-motion: reduce`면 애니메이션 없이 바로 최종 상태.
6. **`RecapFinalSlide`** (`{ teams }`)
   - 총 자산 순위. 1·2·3위 시상대(가운데 1위, 왼쪽 2위, 오른쪽 3위, 높이 차이), 팀 이름과 금액.
   - 4위부터 아래 목록(`N위 팀 이름 금액`).
   - 팀이 1~2개면 있는 만큼만 시상대에 올린다.

장 컴포넌트는 `src/components/admin/recap/` 아래에 둔다. 순위 계산(정렬·동점 1위 찾기)은 `src/utils/clanRecap.js`의 순수 함수로 둔다:

```js
rankTeams(teams, valueKey)   // 값 내림차순, 동점이면 원래 순서 유지 → 새 배열
topTeams(teams, valueKey)    // 1위 값과 같은 팀들(원래 순서) → 배열. teams가 비면 []
```

## 3. 예외 처리

| 상황 | 동작 |
|---|---|
| 비교할 클랜 0개(클랜이 없거나 모두 빈 클랜) | 토스트, 오버레이 열지 않음 |
| 클랜 1개 | 그대로 보여준다(1위 = 그 팀) |
| 모든 값이 0 | 막대 길이 0, 금액 "0원", 1위는 동점 전원 |
| recap 요청 실패 | 토스트, 배너 다시 활성화 |
| 열어 둔 사이 배정이 바뀜 | 반영하지 않는다(다시 열면 새로 불러옴) |
| 서버 재시작 | 클랜이 비어 0개 → 토스트 |

## 4. 테스트

**서버**
- `buildClanRecap`: 합계, 빈 클랜 제외, 사라진 결과 제외, `null`은 0, `teamCount`·`memberCount`, 클랜 순서 유지.

**화면**
- `rankTeams`/`topTeams`: 정렬, 동점 순서, 동점 1위 여러 팀, 빈 배열.
- `RecapCategorySlide`: 제목, 위에서부터 큰 순서, 막대 너비, 1위 표시(동점 포함), 0원.
- `RecapFinalSlide`: 시상대 1·2·3위와 4위 이하 목록, 팀 1개.
- `ClanRecapStory`: 인트로부터 시작, 다음/이전 버튼과 첫·마지막 장 버튼 숨김, 키보드 ←/→/Esc, 진행 막대 상태, 닫기 버튼, body 스크롤 잠금/해제.
- `AdminClassDashboard`: 배너 → recap 요청 → 오버레이 열림, 0개면 토스트, 실패면 토스트.
- `AdminDashboard`/`ClanRecapPage` 관련 테스트는 정리.

## 범위 밖

- 자동 넘김(타이머)
- 오버레이 실시간 갱신
- 학생 화면에 결과 공유, 이미지 저장
- 1인당 평균 비교
