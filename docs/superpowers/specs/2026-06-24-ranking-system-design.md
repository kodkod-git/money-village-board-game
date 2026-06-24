# 랭킹 시스템 디자인 스펙

**날짜:** 2026-06-24  
**상태:** 승인됨  
**참조:** `proposal/20260624_ranking_system.md`, `example/ranking_system_page.jpg`

---

## 개요

Money Village 보드게임에 전체 랭킹 시스템을 추가한다. 주요 변경사항은 세 가지다: (1) 플레이어 소속 입력 추가, (2) 랜딩 화면 신설, (3) 두 가지 진입 방식을 가진 랭킹 페이지 구현.

---

## 1. DB 스키마 변경

`game_results` 테이블에 `affiliation` 컬럼을 추가한다.

```sql
ALTER TABLE game_results ADD COLUMN affiliation TEXT NOT NULL DEFAULT '';
```

- 기존 레코드는 빈 문자열로 처리된다.
- `affiliation`은 자유 텍스트 입력이며 서버에서 그대로 저장된다.

---

## 2. 라우트 구조

| 경로 | 컴포넌트 | 변경 |
|------|----------|------|
| `/` | `LandingPage` | 신규 (기존 NameInput 대체) |
| `/join` | `NameInput` | 유지 |
| `/select` | `CharacterSelect` | 유지 |
| `/team` | `Home` | 유지 |
| `/lobby/:code` | `Lobby` | 유지 |
| `/lobby/:code/individual` | `IndividualPage` | 유지 |
| `/ranking` | `RankingPage` (V1) | 신규 |
| `/result/:sessionId` | `RankingPage` (V2) | 기존 ResultPage 대체 |

---

## 3. API 엔드포인트

### 기존 엔드포인트 (유지)
- `GET /api/results/:sessionId` — 단일 세션 결과 반환. Entry V2 "팀 내" 탭에서 사용. `affiliation` 필드 추가 반환.

### 신규 엔드포인트
- `GET /api/rankings` — 모든 세션의 전체 플레이어를 `total_assets` 내림차순 반환.
- `GET /api/rankings?affiliation=xxx` — 특정 소속만 필터링.

**응답 형식 (`/api/rankings`)**
```json
[
  {
    "rank": 1,
    "name": "홍길동",
    "affiliation": "경영학과",
    "character": "fox",
    "totalAssets": 150000,
    "sessionId": "uuid-...",
    "playerUuid": "uuid-..."
  }
]
```

`playerUuid`는 RankingPage V2에서 localStorage의 값과 비교해 "내 기록" 행을 식별하는 데 사용된다. `game_results.player_uuid` 컬럼은 이미 존재한다.

**서버 구현:**
- `server/db.js` — `getAllRankings(affiliation?: string)` 함수 추가
- `server/index.js` — `GET /api/rankings` 라우트 추가

---

## 4. 프론트엔드 컴포넌트

### 신규 파일

**`src/pages/LandingPage.jsx`**
- Money Village 타이틀 표시
- "🏆 랭킹" 버튼 → `/ranking` 이동
- "📋 참여" 버튼 → `/join` 이동

**`src/pages/RankingPage.jsx`**
- `useParams()`로 `sessionId` 유무 감지하여 V1/V2 분기
- **V1 (sessionId 없음):**
  - `GET /api/rankings` 호출
  - `RankingTable` 단독 표시, 탭 없음
- **V2 (sessionId 있음):**
  - 탭 3개: "글로벌" / "소속" / "팀 내"
  - 글로벌 탭: `GET /api/rankings`
  - 소속 탭: `GET /api/rankings?affiliation={내_소속}`
  - 팀 내 탭: `GET /api/results/:sessionId`
  - 내 기록: `localStorage`의 `playerUuid`로 식별, 테이블 하단에 고정 행 표시

**`src/components/RankingTable.jsx`**
- Props: `rows`, `highlightPlayerUuid?`
- 컬럼: 등수 / 캐릭터 이미지 / 이름 / 소속 / 총자산
- `highlightPlayerUuid`에 해당하는 행은 하단 고정 + 시각적 강조

### 수정 파일

**`src/pages/NameInput.jsx`**
- 소속 입력 필드를 이름 입력 필드 위에 추가
- 레이블: "소속을 입력하세요"
- URL 파라미터에 `affiliation` 추가하여 다음 화면으로 전달

**`src/pages/CharacterSelect.jsx`**
- `affiliation` 쿼리 파라미터를 수신하여 다음 단계로 전달

**`src/pages/Home.jsx`**
- `affiliation`을 `join-room` 소켓 이벤트 payload에 포함

**`src/App.jsx`**
- `LandingPage` import 및 `/` 라우트 연결
- `RankingPage` import 및 `/ranking`, `/result/:sessionId` 라우트 연결
- `ResultPage` 라우트 제거

**`server/rooms.js`**
- `addPlayer()` 함수에서 `affiliation` 필드 수신 및 player 객체에 저장

**`server/db.js`**
- `saveGameResult()` — `affiliation` 컬럼 저장 추가
- `getGameResult()` — `affiliation` 반환 추가
- `getAllRankings(affiliation?)` — 신규 함수

**`server/index.js`**
- `join-room` 핸들러에서 `affiliation` 수신
- `/api/rankings` 라우트 추가

---

## 5. 데이터 흐름

### 소속 입력 → 저장 흐름

```
NameInput (affiliation 입력)
  → ?affiliation=xxx&name=yyy 쿼리 파라미터
  → CharacterSelect → Home
  → join-room 소켓 이벤트 { affiliation, name, character, ... }
  → rooms.js player 객체에 affiliation 저장
  → /api/rooms/:code/submit → db.saveGameResult() → Supabase game_results.affiliation
```

### Entry V2 내 기록 식별 흐름

```
게임 참여 시 playerUuid → localStorage 저장 (기존 로직)
결과 등록 완료 → socket 'game-submitted' → navigate('/result/:sessionId')
RankingPage → localStorage에서 playerUuid 읽기
  → 랭킹 데이터 중 playerUuid 일치 행을 하단 고정 표시
  → 해당 행의 affiliation을 소속 탭 필터에 사용
```

---

## 6. 삭제 대상

- `src/pages/ResultPage.jsx` — 완전 삭제
- `src/pages/ResultPage.module.css` — 완전 삭제

---

## 7. 범위 외 (이번 스펙에 미포함)

- 소속 자동완성
- 랭킹 페이지 기간 필터 (전체 기간만 지원)
- Entry V1에서 탭 기능 (글로벌 테이블만 제공)
