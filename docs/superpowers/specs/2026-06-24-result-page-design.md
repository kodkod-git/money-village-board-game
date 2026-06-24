# Result Page Design Spec

**Date**: 2026-06-24  
**Feature**: 개인 기록(결과) 상세 페이지  
**Status**: Approved

---

## Overview

랭킹 테이블 행 클릭 시 해당 플레이어의 게임 결과를 상세히 보여주는 새 페이지.  
Brawl Stars 프로필 페이지(`example/result_page.jpg`) 스타일의 2열 레이아웃.

---

## Route

```
/result/:sessionId/player/:playerUuid
```

---

## Data Flow

1. RankingTable 행 클릭 → `navigate(/result/:sessionId/player/:playerUuid)`
2. ResultPage 마운트 → `GET /api/results/:sessionId`
3. 응답의 `players[]`에서 `playerUuid` 일치 항목 찾기
4. 같은 응답의 `stockPrices`, `realEstatePrices` → hover 툴팁에 사용

---

## Files Changed

| 파일 | 변경 내용 |
|---|---|
| `server/db.js` | `getAllRankings()` 쿼리에 `session_id` 컬럼 추가 |
| `src/components/RankingTable.jsx` | `onRowClick` prop 추가, 행 클릭 시 콜백 호출 |
| `src/pages/RankingPage.jsx` | `onRowClick` 핸들러 구현 → navigate 호출 |
| `src/App.jsx` | `/result/:sessionId/player/:playerUuid` 라우트 등록 |
| `src/pages/ResultPage.jsx` | 신규 페이지 컴포넌트 |
| `src/pages/ResultPage.module.css` | 신규 스타일 |

---

## Layout

전체 화면을 좌우 2열로 분할 (`40% / 60%`).  
배경: `#0f0f1a` (기존 다크 테마 유지).

### 왼쪽 열 (고정, 스크롤 없음)

세로 중앙 정렬:

```
[캐릭터 이미지]   /characters/{character}.png  (크게)
[이름]            큰 폰트, #eee
[소속]            작은 폰트, #aaa
```

### 오른쪽 열 (스크롤 가능)

아래 순서로 섹션 렌더링:

1. **총 자산** — `totalAssets.toLocaleString()원`, 금색(`#ffd700`) 큰 폰트
2. **직업** — job 이미지 + 텍스트 라벨 한 줄
3. **성공카드** — 획득한 뱃지만 그리드 표시 (없으면 섹션 숨김)
4. **부동산** — 헤더에 소계, 수량만큼 이미지 반복, hover 시 단가 툴팁 (없으면 숨김)
5. **주식** — 헤더에 소계, 수량만큼 이미지 반복, hover 시 단가 툴팁 (없으면 숨김)
6. **현금** — `cash.toLocaleString()원`

---

## Asset Mappings

### 직업 (`/badges/job/`)

| key | 파일명 |
|-----|--------|
| `a` | `경영금융.png` |
| `b` | `연구기술.png` |
| `c` | `보건교육.png` |
| `d` | `문화콘텐츠.png` |
| `e` | `서비스판매.png` |
| `f` | `생산운송.png` |

### 성공카드 (`/badges/success/`)

| index | 파일명 |
|-------|--------|
| 0 | `communication.png` |
| 1 | `global.png` |
| 2 | `idea.png` |
| 3 | `money.png` |
| 4 | `thinking.png` |
| 5 | `trust.png` |

`badges[i] === true`인 항목만 표시.

### 부동산 (`/badges/estate/`)

| key | 파일명 |
|-----|--------|
| `gaon` | `가온개미.png` |
| `nuri` | `누리고양이.png` |
| `dami` | `다미원숭이.png` |
| `maru` | `마루수리.png` |
| `chorong` | `초롱부엉이.png` |
| `hani` | `하니여우.png` |

### 주식 (`/badges/stock/`)

| key | 파일명 |
|-----|--------|
| `semiconductor` | `반도체IT.png` |
| `finance` | `금융산업.png` |
| `industrial` | `산업재기계.png` |
| `auto` | `소재화학.png` |
| `bio` | `바이오헬스케어.png` |
| `content` | `콘텐츠소비재.png` |

---

## Subtotal Calculation

부동산/주식 섹션 헤더 소계:

```js
Object.entries(holdings).reduce((sum, [key, qty]) => sum + (prices[key] ?? 0) * qty, 0)
```

---

## Hover Tooltip

- 부동산 이미지 hover → `realEstatePrices[key].toLocaleString()원`
- 주식 이미지 hover → `stockPrices[key].toLocaleString()원`
- CSS `:hover` + `title` attribute 또는 커스텀 툴팁 중 선택 가능 (단순 `title` 우선)

---

## Navigation

- 좌상단 `← 뒤로` 버튼 → `navigate(-1)`
- 뒤로가기는 랭킹 페이지로 복귀

---

## Backend Change Detail

`getAllRankings()` SQL 쿼리에 `gr.session_id` 컬럼 추가.  
응답 row에 `sessionId` 필드 포함하도록 매핑 수정.
