# 관리자 모드 데모 설계 (2026-07-01)

> 원본 제안서: `proposal/20260701_admin_mode.md`
> 범위: 실제 소켓/DB 연동 없이, 목업 데이터로 관리자 모드 UI 전체 흐름을 확인할 수 있는 **프론트엔드 전용 데모**.

---

## 0. 배경

관리자 모드는 통신·DB 접근이 실제로 이뤄져야 완성되는 기능이 많아 지금 전부 구현하지는 않는다. 대신 데모 버전을 만들어 화면 흐름과 레이아웃을 미리 검증한다. 나중에 실제 백엔드 연동 시에는 이번 데모의 프론트엔드 계산 로직(§3)은 그대로 유지되지 않을 가능성이 높다 — 백엔드가 계산된 값을 내려줄 것이기 때문이다. 따라서 이번 유틸은 데모 전용이며, 영구적으로 재사용될 코드로 설계하지 않는다.

## 1. 진입 & 라우팅

- `LandingPage.jsx`(route `/`) 우상단에 톱니바퀴 아이콘 버튼 추가. 클릭 시 인증 없이 `/admin`으로 이동한다(데모이므로 별도 인증 없음).
- `App.jsx`에 `<Route path="/admin" element={<AdminDashboard />} />` 추가.
- `AdminDashboard` 상단에 "← 나가기" 버튼(`BackButton` 재사용 또는 `navigate('/')`)으로 홈으로 복귀.

## 2. 레이아웃 / 디자인 시스템

- 기존 라이트 테마 디자인 토큰(컬러 `--purple` 등, Nunito 폰트, 카드 radius/shadow 등)은 그대로 재사용한다.
- 컨테이너만 데스크탑 전용으로 새로 설계: `max-width: 1280px` 중앙 정렬(`AdminDashboard.module.css` 신규). 기존 모바일 480~560px 컨테이너와는 별개이며, 반응형 대응은 하지 않는다(데스크탑 전용).
- 상단에 탭 바: **"그리드 뷰" / "테이블 뷰"** 2개 버튼. 로컬 state로 토글하며 별도 라우트는 아니다(추후 3번째 탭 추가를 염두에 둔 구조).

## 3. 목업 데이터 & 자산 계산

- `src/utils/calculateAssets.js` 신규: `server/db.js`의 `calculateTotalAssets(gameState, prices)` 공식(`(현금 + 주식평가액 + 부동산평가액) * 뱃지수 * 0.5`)을 미러링한 순수 함수.
  - `calculateAssetBreakdown(gameState, prices)` → `{ cash, stockValue, realEstateValue, totalAssets }` 반환. 테이블 뷰의 "부동산총액"/"주식총액" 컬럼에 필요해 분해값도 함께 노출한다.
  - 서버 파일(`server/db.js`)은 직접 import하지 않는다 — supabase 클라이언트가 프론트 번들에 끼어드는 것을 피하기 위해 로직만 복제한다.
- `src/data/adminMockData.js` 신규: `rooms.js`의 실제 room 구조(`code`, `players[]`, `prices`)를 흉내낸 가짜 배열.
  - 방 4~6개, 상태를 골고루 섞어 구성: 빈 로비(0명), 일부 참여중(1~3명), 4명 다 채워져 진행중, 등록완료.
  - 각 플레이어는 실제 `gameState`(현금, 보유 주식/부동산 수량, 뱃지, 직업, `isCompleted`)를 하드코딩하고, 총액은 저장하지 않는다 — `calculateAssetBreakdown`으로 렌더링 시점에 계산한다.

## 4. 그리드 뷰

- `AdminGridView.jsx`: 목업 방 목록을 카드로 렌더링.
- 진행중 방: 카드 안에 4개 슬롯(참여한 캐릭터 이미지 + 빈 슬롯은 기존 `PlayerSlot`/`MemberSlot` 스타일 재사용). 카드 클릭 시 관전 팝업 오픈.
- 등록완료 방: 카드에 "등록 완료" 배지 표시, **클릭 비활성화**(참여도 관전도 불가).
- 관전 팝업: `Lobby.jsx`에 `readOnly` + `mockRoom` prop을 추가.
  - prop이 있으면 socket 연결/fetch effect(`useEffect`로 방 정보 조회, rejoin, room-updated 구독 등)를 전부 스킵하고, 전달받은 mock room 데이터로 렌더링.
  - 액션 버튼(나가기, 추방, 가격설정, 결과등록, 프로필 수정 이동)은 전부 숨긴다.
  - 팝업은 오버레이 클릭 또는 X 버튼으로 닫는다.

## 5. 테이블 뷰

- `AdminTableView.jsx`: 모든 mock 방의 플레이어를 평탄화해 1인 1행으로 표시(팀 구분 없이 통합 리스트).
- 컬럼: `팀코드 | 이름 | 소속 | 직업 | 현금 | 부동산총액 | 주식총액 | 총자산 | 상태(입력완료/미입력)`.
- 각 행의 자산 컬럼은 `calculateAssetBreakdown(player.gameState, room.prices)`로 계산.
- `gameState.isCompleted`가 `false`인 플레이어는 자산 관련 컬럼을 `-`로 표시하고 상태를 "미입력"으로 표시.
- 마크업/스타일은 `RankingTable.jsx`를 참고하되, 컬럼 구성이 달라 별도 컴포넌트로 작성한다.

## 6. 범위 밖 (Out of scope)

- 실제 소켓/DB 연동, 관리자 인증, 제안서에 언급된 "추후 추가 예정"인 3번째 탭.
- 반응형(모바일) 대응.
- `src/utils/calculateAssets.js`를 영구적인 공용 유틸로 유지하는 것 — 실제 백엔드 연동 시 서버가 계산된 값을 내려줄 가능성이 높아 이 유틸은 데모 전용으로 간주한다.

## 7. 파일 변경 목록

**신규**
- `src/pages/AdminDashboard.jsx` / `AdminDashboard.module.css`
- `src/pages/AdminGridView.jsx` (또는 `src/components/admin/` 하위)
- `src/pages/AdminTableView.jsx`
- `src/data/adminMockData.js`
- `src/utils/calculateAssets.js`

**수정**
- `src/pages/LandingPage.jsx` — 톱니바퀴 아이콘 버튼 추가
- `src/App.jsx` — `/admin` 라우트 추가
- `src/pages/Lobby.jsx` — `readOnly`/`mockRoom` prop 가드 추가(기존 동작 변경 없음)
