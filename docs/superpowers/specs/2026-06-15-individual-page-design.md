# Individual Page Design

Date: 2026-06-15

## Overview

When a player clicks their own character in the lobby, they navigate to a personal Individual Page where they input their game state (cash, job, stocks, real estate, success card badges). When all required sections are filled, they can click "입력완료" to signal readiness — this status is visible to all players in the lobby in real time.

## Architecture

### Socket Context (Breaking Change)

`useSocket` is moved from a per-page hook to an App-level React Context so the socket connection persists across route changes.

- **New file**: `src/contexts/SocketContext.jsx` — wraps `useSocket` logic, exposes `{ socket, mySocketId }` via context
- **`src/main.jsx`** — wrap `<App>` with `<SocketProvider>`
- All existing pages replace `useSocket()` with `useSocketContext()`

### New Route

`src/App.jsx` adds:
```
/lobby/:code/individual  →  IndividualPage
```

### Data Flow

```
Player edits field → IndividualPage → socket emit 'update-player-state' { code, gameState }
                                              ↓
                                   Server updates player.gameState
                                              ↓
                                   io.to(room).emit('room-updated')
                                              ↓
                                   All clients update lobby state
```

## Server Changes

### `server/rooms.js`

Each player object gains a `gameState` field, initialized on `addPlayer`:

```js
gameState: {
  cash: null,           // null = not set, number = set
  job: null,            // null = not selected, 'a'–'f' = selected
  stocks: {
    semiconductor: 0, finance: 0, industrial: 0,
    auto: 0, bio: 0, content: 0
  },
  realEstate: {
    gaon: 0, nuri: 0, dami: 0,
    maru: 0, chorong: 0, hani: 0
  },
  badges: [false, false, false, false, false, false],
  stocksVisited: false,      // true after user opens & confirms stocks popup
  realEstateVisited: false,  // true after user opens & confirms real estate popup
  isCompleted: false
}
```

### `server/index.js`

New socket event:

```
update-player-state  (client → server)
  payload: { code, gameState }
  action:  find player by socketId, merge gameState, broadcast room-updated
```

## Individual Page UI

**Route**: `/lobby/:code/individual`

**Layout** (3-zone):

```
┌─────────────────────────────────────────────┐
│  ← 뒤로   [이름]              [뱃지 6개 아이콘] │
├────────────┬──────────────┬─────────────────┤
│            │              │                 │
│  주식 카드  │  캐릭터 이미지 │   현금 카드      │
│ 부동산 카드 │   (중앙)      │                 │
│            │              │                 │
│  직업 카드  │              │                 │
├────────────┴──────────────┴─────────────────┤
│              [입력완료] 버튼                   │
└─────────────────────────────────────────────┘
```

### Components

**상단 바**
- 뒤로가기 버튼 → `navigate(-1)`
- 플레이어 이름 (중앙)
- 성공카드 뱃지 6개 (우측)

**성공카드 뱃지**
- 이미지: `public/badges/{communication,global,idea,money,thinking,trust}.png` (assets/ 에서 이동)
- 잠금 상태: 흑백 필터 + 자물쇠 아이콘 오버레이
- 해제 상태: 원본 이미지
- 클릭 → 토글, 즉시 `update-player-state` emit

**좌측 카드 3개**
1. **주식 카드** — 6종 보유 수량 요약 표시. 클릭 → 주식 팝업
2. **부동산 카드** — 6종 보유 수량 요약 표시. 클릭 → 부동산 팝업
3. **직업 카드** — 이름 + 선택된 직업 표시. 클릭 → 직업 팝업

**중앙**: 캐릭터 이미지

**우측 카드 1개**
- **현금 카드** — 현재 현금 보유량 표시. 클릭 → 현금 팝업

**하단 버튼**
- 비활성화(기본): 모든 조건 미충족 시 회색
- 활성화: 모든 조건 충족 시 강조색 → 클릭 시 `isCompleted: true` emit

### Popups

| 팝업 | 트리거 | 내용 |
|------|--------|------|
| 현금 | 현금 카드 클릭 | +/- 버튼 (1,000원 단위, 꾹 누르면 반복 증감), 현재 값, 확인 |
| 주식 | 주식 카드 클릭 | 6종 각각 +/- (0~99), 확인 → `stocksVisited: true` |
| 부동산 | 부동산 카드 클릭 | 6종 각각 +/- (0~99), 확인 → `realEstateVisited: true` |
| 직업 | 직업 카드 클릭 | 6개 선택지 버튼 (a~f), 선택 즉시 닫힘 |

직업 선택지:
- a. 경영·금융
- b. 연구·기술
- c. 보건·교육
- d. 문화·콘텐츠
- e. 서비스·판매
- f. 생산·운송

## "입력완료" 버튼 활성화 조건

모두 충족 시 버튼 활성화:

1. `cash !== null`
2. `job !== null`
3. `stocksVisited === true`
4. `realEstateVisited === true`
5. `badges.some(b => b === true)` (1개 이상 해제)

## Lobby Changes

### PlayerSlot

- `isOwnPlayer` prop 추가
- 본인 슬롯만 클릭 가능 (cursor: pointer), 클릭 시 individual page 이동
- 상태 뱃지 변경:
  - 방장: `방장 ★`
  - 입력완료: `입력완료`
  - 그 외: 뱃지 없음 (이름만)
- "참가완료" 뱃지 제거

### Lobby.jsx

- `useSocket()` → `useSocketContext()`
- `mySocketId` 사용해 본인 PlayerSlot 판별
- 클릭 핸들러: `navigate(\`/lobby/${code}/individual\`)`

## Access Control

IndividualPage 진입 시:
- 해당 room의 player 중 `socketId === mySocketId`가 없으면 → `/lobby/:code`로 redirect

## Asset Migration

`assets/*.png` (6개) → `public/badges/` 로 이동:
- `communication.png`, `global.png`, `idea.png`, `money.png`, `thinking.png`, `trust.png`

## Files Changed

| 파일 | 변경 유형 |
|------|----------|
| `src/contexts/SocketContext.jsx` | 신규 |
| `src/pages/IndividualPage.jsx` | 신규 |
| `src/pages/IndividualPage.module.css` | 신규 |
| `public/badges/*.png` | 신규 (assets에서 이동) |
| `src/main.jsx` | 수정 (SocketProvider 추가) |
| `src/App.jsx` | 수정 (라우트 추가) |
| `src/pages/Lobby.jsx` | 수정 (useSocketContext, 클릭 핸들러) |
| `src/components/PlayerSlot.jsx` | 수정 (isOwnPlayer, 뱃지 변경) |
| `server/rooms.js` | 수정 (gameState 필드) |
| `server/index.js` | 수정 (update-player-state 이벤트) |
