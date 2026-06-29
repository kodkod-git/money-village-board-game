# 2026-06-29 변경사항 설계 문서

## 개요

6가지 변경사항을 반영한다: 뒤로가기 버튼 통합, 방장 추방 기능, 랭킹 페이지 개선 3건, 개인 페이지 개선 3건.

---

## 1. 화면 이동 — 뒤로가기 버튼

### 목표
모든 화면(LandingPage 제외)에 일관된 `<` 뒤로가기 버튼을 추가한다.

### 컴포넌트
- **신규:** `src/components/BackButton.jsx` + `BackButton.module.css`
- 버튼 위치: `position: fixed`, `top: 16px`, `left: 16px`, 높은 z-index
- 스타일: 크고 명확한 `<` 기호, 원형 또는 사각형 버튼
- 동작: `onClick={() => navigate(-1)}` 통일

### 적용 페이지 (7개)
`NameInput`, `CharacterSelect`, `Home`, `Lobby`, `IndividualPage`, `RankingPage`, `ResultPage`

### 제거 대상
- `IndividualPage`의 기존 `← 뒤로` 버튼 (`styles.backBtn`)
- `RankingPage`의 기존 `← 홈` 버튼

---

## 2. 추방 기능

### 목표
방장이 로비에서 팀원을 추방할 수 있다.

### 클라이언트 변경
- `PlayerSlot`에 `onKick?: () => void` prop 추가
- `isHost && !isOwnPlayer`일 때만 이름 오른쪽에 빨간 "X" 버튼 렌더링
- `Lobby`에서 `isHost`인 경우 각 `PlayerSlot`에 `onKick` 전달:
  ```js
  onKick={() => socket.emit('kick-player', { playerUuid: player.playerUuid })}
  ```
- `you-were-kicked` 소켓 이벤트 수신 시 `/team`으로 navigate

### 서버 변경
- `rooms.js`에 `kickPlayer(hostSocketId, targetPlayerUuid)` 함수 추가
  - 방장 여부 확인 후 해당 `playerUuid`의 플레이어를 room에서 제거
  - 제거된 플레이어의 `socketId` 반환
- `server/index.js`에 `kick-player` 이벤트 핸들러 추가:
  1. `kickPlayer` 호출로 대상 socketId 획득
  2. 대상 소켓에 `you-were-kicked` emit
  3. 나머지 팀원에게 `room-updated` emit

---

## 3. 랭킹 페이지

### 3.1 내 기록 없을 때 플레이스홀더

**변경 대상:** `RankingPage.jsx`, `RankingTable.jsx`

- `RankingPage`에서 V2 여부와 무관하게 항상 `myPlayerUuid`를 `highlightPlayerUuid`로 전달
- `RankingTable`에서 `highlightPlayerUuid` 있지만 `rows`에서 매칭 없을 때 (`pinnedRow === null`), 하단에 노란색 고정 행 렌더링:
  - 등수: `-위`
  - 캐릭터+이름+소속 통합 셀: `게임에 참여하러 가기`
  - 총자산: `-원`
- 플레이스홀더 행 클릭 시: `onRowClick`에 특수 sentinel 값 전달 → `RankingPage`에서 `/team`으로 navigate

### 3.2 탭 명칭 변경

**변경 대상:** `RankingPage.jsx`의 `TABS` 배열

| 기존 | 변경 |
|------|------|
| `글로벌` | `전체` |
| `팀 내` | `팀` |

### 3.3 이름 중복 버그 수정

**변경 대상:** `RankingTable.jsx`

- **원인:** 같은 플레이어가 여러 게임에 참여하면 동일 `playerUuid`가 React key로 중복 → React가 잘못된 row 데이터를 렌더링하거나 클릭 시 잘못된 row의 데이터로 navigate
- **수정:** key를 `${row.sessionId}-${row.playerUuid}`로 변경

---

## 4. 개인 페이지

### 4.1 자산 입력 강제 — 순차 팝업

**변경 대상:** `IndividualPage.jsx`

- `useEffect`에서 플레이어 데이터 로드 후 `job === null`이면 `activePopup`을 `'job'`으로 세팅
- 팝업 순서: `job` → `badges` → `realEstate` → `stocks` → `cash`
- 각 팝업 확인/완료 버튼이 다음 팝업을 자동 오픈 (기존 `setActivePopup(null)` → `setActivePopup(nextStep)`)
- **신규:** `BadgePopup` 컴포넌트 — 기존 인라인 배지 토글 UI를 오버레이 팝업으로 래핑, "완료" 버튼으로 닫기
- `job !== null`인 경우(데이터 존재): 팝업 없이 기존 화면에서 자유롭게 수정 가능

### 4.2 입력 편의성

**변경 대상:** `IndividualPage.jsx` (내부 컴포넌트)

**QuantityPopup (주식/부동산):**
- 기존 `+`/`-` 버튼 → `<input type="range" min={0} max={10} step={1}>` 슬라이더로 교체
- 슬라이더 아래 기존 `CellBar` 유지, 슬라이더 값과 실시간 연동

**CashPopup (현금):**
- 기존 +천/-천/+만/-만 버튼 → 숫자 키패드 UI로 교체
- 키패드 구성: `0`~`9`, `00`, 지우기(`←`), 확인
- 입력값은 문자열로 누적해 숫자로 변환

### 4.3 새로고침 버그 수정

**변경 대상:** `CharacterSelect.jsx`, `IndividualPage.jsx`

**원인:** 새로고침 시 소켓 재연결로 `socket.id`가 변경되어 room의 플레이어 탐색(`find(p => p.socketId === socket.id)`) 실패. 서버는 disconnect 시 `removePlayer`로 플레이어를 제거하므로 room에서 완전히 사라짐.

**수정:**
1. `CharacterSelect`에서 `join-room` emit 직후 localStorage에 프로필 저장:
   ```js
   localStorage.setItem('player_profile', JSON.stringify({ name, affiliation, character, roomCode }))
   ```
2. `IndividualPage`의 플레이어 탐색 로직 수정:
   - 먼저 `socket.id`로 탐색 (정상 케이스)
   - 없으면 localStorage의 `player_profile`로 `join-room` 재emit 후 재탐색
   - `playerUuid`(`localStorage.getItem('player_uuid')`)를 함께 전송하여 기존 gameState 복원 가능하도록 함
3. 탐색 실패 시 기존대로 `/lobby/${code}`로 리다이렉트

---

## 파일 변경 요약

| 파일 | 변경 유형 |
|------|----------|
| `src/components/BackButton.jsx` | 신규 |
| `src/components/BackButton.module.css` | 신규 |
| `src/pages/NameInput.jsx` | BackButton 추가, 기존 뒤로가기 제거 |
| `src/pages/CharacterSelect.jsx` | BackButton 추가, localStorage 프로필 저장 |
| `src/pages/Home.jsx` | BackButton 추가 |
| `src/pages/Lobby.jsx` | BackButton 추가, kick 소켓 이벤트, you-were-kicked 핸들러 |
| `src/pages/IndividualPage.jsx` | BackButton 추가, 순차 팝업, 슬라이더, 키패드, 재연결 로직 |
| `src/pages/RankingPage.jsx` | BackButton 추가, 탭 명칭, myPlayerUuid 항상 전달 |
| `src/pages/ResultPage.jsx` | BackButton 추가 |
| `src/components/PlayerSlot.jsx` | onKick prop 추가 |
| `src/components/PlayerSlot.module.css` | kick 버튼 스타일 |
| `src/components/RankingTable.jsx` | 플레이스홀더 행, key 수정 |
| `server/rooms.js` | kickPlayer 함수 추가 |
| `server/index.js` | kick-player 이벤트 핸들러 추가 |
