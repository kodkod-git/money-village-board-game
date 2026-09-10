# 팀원 자산 "자세히 보기" — 설계 문서

- 날짜: 2026-09-10
- 관련 제안: `proposal/20260910_asset_detail_page.md`
- 상태: 설계 확정, 구현 계획 대기

## 배경 / 문제

관리자 모드의 팀 현황 모달(`AdminSpectateModal`)에서 카드를 누르면 팀원별 요약 카드
(`AdminPlayerCard`)가 보인다. 여기에는 총자산·성공카드·부동산·주식이 요약되어 나오지만
**현금이 얼마인지, 정확히 어떤 성공카드/부동산/주식을 보유했는지** 확인하기 어렵다.

"수정" 버튼(`AdminPlayerCard` → `AdminEditModal`)을 누르면 상세 정보가 나오지만 한 번에
한 명만 볼 수 있다. 관리자는 **모든 팀원의 자산을 자세하게, 그리고 한눈에** 보고 싶어 한다.

## 목표

- 팀 현황 모달에 "자세히 보기" 액션 추가 (버튼 위치: `삭제` / `결과 등록` 옆, 항상 표시).
- 클릭 시 팀원 전원의 자산 상세를 **가로로 나란히** 보여주는 화면을 연다.
- 각 카드는 "수정" 모달과 동일한 정보를 **1-column**(영수증 형태)으로 담고, 보유 자산량에
  따라 높이가 달라진다.
- 팀 최대 인원은 4명이므로 4장이 가로 스크롤 없이 한 화면에 들어오도록 한다.

## 비목표 (YAGNI)

- 이 화면에서의 자산 편집 — 순수 읽기 전용. 편집은 기존 "수정" 플로우 유지.
- 팀 간 이동(이전/다음 팀) — 자세히 보기는 현재 팀만 대상. 닫으면 팀 현황으로 복귀.
- 인쇄/내보내기 기능.
- 새 API 또는 서버 변경.

## 사용자 결정 사항 (브레인스토밍)

| 질문 | 결정 |
| --- | --- |
| 방향(영수증형 가로 배치 + AdminEditModal 읽기전용을 1-column으로) | 확정 |
| 한 화면에 보이는 카드 수 | 최대 4명(팀 정원)이 스크롤 없이 |
| 카드 헤더에 캐릭터·이름·직업 노출 | 노출 |
| 빼거나 합칠 항목 | 없음 (직업/성공카드/현금/부동산/주식 모두 표시) |
| 모달 구조 | 팀 현황 모달을 "교체"하는 UX — 단, 자세히 보기일 때만 화면 전체로 확장하고 닫으면 820px 팀 현황으로 복귀 |
| "자세히 보기" 버튼 노출 시점 | 항상 표시 (등록 전/후 무관) |
| 카드 내용 구현 방식 | A안 — 전용 `PlayerAssetReceipt` 신규 + 공유 `AdminAssetSummary` 추출 |

## 구현 방식

### 컴포넌트 구조

**신규**

- `src/components/admin/AdminTeamAssetsModal.jsx` + `.module.css`
  - 전체 화면 오버레이. `createPortal(document.body)`로 렌더 — 부모 `.popup`(AdminDashboard.module.css)의
    `width: min(820px, 94vw)` + `overflow: hidden` 제약을 벗어나기 위함.
  - 구조: 오버레이 배경 → 패널(`width: min(1200px, 96vw); max-height: 92vh`) →
    헤더(`{room.title ?? `${index+1}팀`} · 팀원 자산 상세`, 닫기 ✕) →
    가로 스트립(`display:flex; gap; align-items:flex-start`, 카드 적으면 `justify-content:center`,
    넘치면 `overflow-x:auto`) → 하단 `닫기` 버튼.
  - props: `room`, `prices`, `teamLabel`, `onClose`.
  - 닫힘: ESC / 오버레이 클릭 / 헤더 ✕ / 하단 닫기 버튼.

- `src/components/admin/PlayerAssetReceipt.jsx` + `.module.css`
  - 1-column 영수증 카드. `flex: 0 0 clamp(240px, 24vw, 300px)`.
  - 구조: 헤더(캐릭터 이미지, 이름, 직업 부제) →
    미니카드: `직업`(아이콘+라벨 또는 `무직`/`미입력`), `성공카드`(칩 목록 또는 `미입력`),
    `현금`(`toLocaleString()`원), `부동산`(`AdminAssetSummary`, 단위 `개`),
    `주식`(`AdminAssetSummary`, 단위 `주`) →
    하단 `총 자산`(`calculateAssetBreakdown(gameState, prices).totalAssets`).
  - props: `player`, `prices`.

- `src/components/admin/AdminAssetSummary.jsx`
  - 현재 `AdminEditModal.jsx` 내부 로컬 함수 `AssetSummaryList`를 그대로 추출한 것.
  - `{ labels, images, values, folder, unit, testIdPrefix }` → 보유 키만 필터해
    아이콘·이름·수량 행 렌더, 보유 없으면 `미보유`.
  - 자체 `AdminAssetSummary.module.css`를 갖는다. 기존 `AdminEditModal.module.css`의
    `.assetList` / `.assetRow` / `.assetIcon` / `.assetName` / `.assetAmount` / `.emptyAsset`
    규칙을 이 파일로 이동하고, `AdminEditModal.module.css`에서는 제거한다.
    `PlayerAssetReceipt`도 이 컴포넌트를 그대로 사용하므로 별도 스타일 주입 없음.

**수정**

- `src/components/admin/AdminSpectateModal.jsx`
  - `const [showDetail, setShowDetail] = useState(false)` 추가.
  - `.actions`에 `<button className={styles.detailBtn} onClick={() => setShowDetail(true)}>자세히 보기</button>`
    — `삭제` 버튼 옆, 항상 표시.
  - 렌더 말미에 `{showDetail && <AdminTeamAssetsModal room={room} prices={room.prices}
    teamLabel={room.title ?? `${index + 1}팀`} onClose={() => setShowDetail(false)} />}`.
  - 편집 중(`editingPlayerUuid`)일 때의 early-return 경로와는 독립.

- `src/components/admin/AdminEditModal.jsx`
  - 로컬 `AssetSummaryList` 정의 제거 → `import AdminAssetSummary from './AdminAssetSummary'` 로
    교체. 렌더 동작·마크업·testid 동일 유지.

- `src/components/admin/AdminSpectateModal.module.css`
  - `.detailBtn` 스타일 추가 (기존 `.priceBtn`/`.deleteBtn` 톤에 맞춤).

### 데이터 & 실시간 반영

- 자산 계산: 기존 `utils/calculateAssets`의 `calculateAssetBreakdown(gameState, prices)` 재사용.
  `AdminPlayerCard`/`AdminEditModal`과 동일 소스라 총자산 수치가 일치.
- 라벨/이미지: `constants/gameData`의
  `JOB_LABELS`, `JOB_IMAGES`, `BADGE_NAMES`, `BADGE_LABELS`,
  `REAL_ESTATE_LABELS`, `ESTATE_IMAGES`, `STOCK_LABELS`, `STOCK_IMAGES`.
- 실시간: `AdminSpectateModal`은 미등록 팀에 대해 3초 폴링(`/api/rooms/:code` → `onPlayerUpdate`
  → 부모 `rooms` 갱신 → `room` prop 재하향). `AdminTeamAssetsModal`은 이 `room`을 그대로
  받으므로 자세히 보기를 열어둔 채로도 값이 갱신됨. 등록된 팀은 데이터 고정.

### 엣지 케이스

- 빈 슬롯: `room.players` 내 `null` 요소는 스트립에서 제외 — 실제 참가자 카드만 렌더.
- 보유/입력 없음: 부동산·주식 `미보유`, 성공카드 `미입력`, 직업 `무직`(`jobVisited`) 또는
  `미입력` — `AdminEditModal`의 문구 규칙 그대로.
- 참가자 0명(전원 null): "자세히 보기" 버튼은 표시하되, 모달에 "표시할 팀원이 없습니다" 빈 상태.
- 좁은 화면: 카드 min 240px + 스트립 `overflow-x:auto` 가로 스크롤 폴백. 패널
  `width: min(1200px, 96vw); max-height: 92vh`, 스트립 세로 넘침 시 패널 내부 스크롤.
- 접근성: 오버레이에 `role="dialog"`, 닫기 버튼 `aria-label`, ESC 핸들러.

## 테스트

- `PlayerAssetReceipt.test.jsx` — 보유 목록 렌더, `미보유`/`미입력`/`무직` 상태, 총자산 표시,
  성공카드 칩 개수.
- `AdminTeamAssetsModal.test.jsx` — non-null 참가자 수만큼 카드 렌더, `null` 슬롯 제외,
  닫기 콜백(✕/오버레이/닫기 버튼/ESC), 빈 상태 문구.
- `AdminSpectateModal.test.jsx` — "자세히 보기" 버튼 존재(등록 전/후 모두), 클릭 시
  `AdminTeamAssetsModal` 오픈, 닫으면 팀 현황 복귀.
- `AdminEditModal.test.jsx` — 기존 테스트가 `AdminAssetSummary` 추출 후에도 전부 통과(회귀).

## 영향 범위

- 서버/DB/API 변경 없음.
- `AdminEditModal`은 내부 리팩터링만(동작 동일). 랭킹 페이지의 `AdminEditModal readOnly`
  재사용 경로도 영향 없음.
- 신규 컴포넌트 3개 + CSS, 수정 컴포넌트 2개 + CSS 1개.
