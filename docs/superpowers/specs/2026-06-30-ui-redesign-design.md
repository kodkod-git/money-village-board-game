# 머니빌리지 UI 전면 리디자인 — 설계 스펙

**날짜:** 2026-06-30  
**범위:** 다크→라이트 테마 전환 + IndividualPage 대시보드 제거 + StepBar 기반 입력 UI

---

## 1. 핵심 변경 요약

| 항목 | AS-IS | TO-BE |
|---|---|---|
| 전체 테마 | 다크 (`#0a1628`, white) | 라이트 (`#ffffff`, `#111`) + Nunito |
| 인트로 배경 | 다크 그라데이션 | 블루→퍼플 그라데이션 (`--grad-page`) |
| 강조색 | 골드(`#ffd700`) | 퍼플(`#6c7de5`) |
| IndividualPage 구조 | 대시보드 + 팝업 | StepBar 전체화면 5단계 (대시보드 삭제) |
| IndividualPage 진입 | 자동/직접 접근 | Lobby "프로필 설정" 버튼으로만 |
| 수정 모드 | 대시보드 팝업 | 동일 StepBar UI, 기존값 미리채움, 탭 클릭 이동 |

**범위 외:** `RankingPage`, `ResultPage` — 현행 유지

---

## 2. 디자인 시스템

### 2.1 CSS 변수 (`index.css` `:root`)

```css
/* Brand */
--purple:        #6c7de5;
--purple-ink:    #5b7cf0;
--violet:        #9b5fd4;
--blue-accent:   #70a6fe;
--blob:          #a3b3ff;
--lavender-bg:   #e8ecff;

/* Gradients */
--grad-page: linear-gradient(160deg, #6ea6fd 0%, #949dfe 50%, #9191fb 100%);
--grad-btn:  linear-gradient(90deg, #5b7cf0 0%, #9b5fd4 100%);

/* Ink */
--ink:      #111111;
--ink-2:    #888888;
--muted:    #99a1af;
--disabled: #bbbbbb;
--ghost:    #cccccc;

/* Surface */
--white:       #ffffff;
--slot-empty:  #f9f9f9;
--line:        #e0e0e0;
--divider:     #ededed;

/* Shape */
--r-sm:   16px;
--r-md:   20px;
--r-lg:   24px;
--r-pill: 999px;

/* Shadow */
--shadow-card: 0 4px 6px -4px rgba(0,0,0,.10), 0 10px 15px -3px rgba(0,0,0,.10);
```

### 2.2 index.css 교체

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;700;800;900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Nunito', system-ui, sans-serif;
  background: #ffffff;
  color: #111111;
  min-height: 100vh;
}
input, button { font-family: inherit; }
button { cursor: pointer; border: none; }
```

### 2.3 타이포그래피 (Nunito)

| 역할 | size/weight | color |
|---|---|---|
| Display (홈 타이틀) | 72/900 | #fff |
| H1 | 36/900 | 화면별 |
| 팀 코드 | 36/900 letter-spacing 9px | #111 |
| H2 | 30/900 | #111 |
| 직업/성공카드 타일 라벨 | 20/700 | #111 |
| 인트로 버튼 | 26/800 | #6c7de5 or #fff |
| 그라데이션 버튼 | 20/800 | #fff |
| 입력 라벨 | 12/800 letter-spacing 1.2px | #6c7de5 |
| 섹션 라벨 | 10/700 letter-spacing 1.5px | #888 |
| StepBar 라벨 | 10/700 | #111(활성)/#bbb(비활성) |
| 팀원 이름 | 14/700 | #111 |
| 숫자 버튼 | 14/900 | #fff(선택)/#bbb |
| placeholder | 16/400 | #99a1af |

---

## 3. 공통 컴포넌트

### 3.1 BackButton (리스킨)
- 위치: 좌상단, 아이콘 `‹` + "뒤로" 텍스트(14/700), gap 4px
- 인트로(그라데이션 배경): 흰색 / 본문(흰 배경): `#888`
- 클릭: `navigate(-1)`

### 3.2 PrimaryButton (다크 알약)
- 배경 `#111`, 텍스트 흰색, radius `var(--r-md)` (CTA) 또는 `var(--r-sm)`
- 높이 56~70

### 3.3 GradientButton
- 배경 `var(--grad-btn)`, 텍스트 흰 20/800, radius `var(--r-sm)`, 높이 56, `var(--shadow-card)`
- 용도: 로그인 "다음 →"

### 3.4 IntroButton
- 배경 흰색, radius `var(--r-sm)`, 높이 76, `var(--shadow-card)`, 텍스트 26/800
- "참여하기": 텍스트 `var(--purple)`
- "랭킹 보기": 텍스트 흰 + `var(--grad-btn)` 배경

### 3.5 GlassCard
- 흰 반투명 배경, radius `var(--r-lg)`, 1px 흰(opacity .22) 보더, `var(--shadow-card)`
- 용도: 로그인 카드

### 3.6 GlassInput
- 라벨: 12/800 `var(--purple)` letter-spacing 1.2
- 입력박스: radius `var(--r-sm)`, 보더 `var(--blue-accent)`, placeholder `var(--muted)` 16/400, 높이 58, 좌패딩 22

### 3.7 StepBar
- 5스텝: **직업 · 성공카드 · 부동산 · 주식 · 현금**
- 각 스텝: 상단 라인(높이 3, radius `var(--r-pill)`) + 라벨(10/700)
- 활성/완료: 라인 `#111`, 라벨 `#111` / 비활성: 라인 `var(--line)`, 라벨 `var(--disabled)`
- **탭 클릭 시 해당 단계로 이동** (수정 모드에서 활성화)
- 위치: 페이지 상단 (StepBar → Divider 1px 순)

### 3.8 QuantitySelector
- 1~10 숫자 버튼 가로 배열
- 선택된 수량까지: 배경 `#111`, 텍스트 흰 / 미선택: 흰 배경, 텍스트 `var(--disabled)`, 1px `#eee` 보더
- 행 우측: "N개" 합계(14/900 #111)

### 3.9 AssetRow
- 좌: 이미지(32px) + 명칭(14/700) + 가격(12/400 #888)
- 중: QuantitySelector
- 우: "N개" 합계
- 카드: 흰 배경, radius `var(--r-sm)`, 높이 74

### 3.10 PlayerSlot (리스킨)
- 채워짐: 흰 카드(175×175, radius `var(--r-sm)`) + 캐릭터 이미지 + 이름(14/700 #111)
- 빈 슬롯: 배경 `var(--slot-empty)`, "?"(20/400 `var(--ghost)`) + "대기중"(12/700 `var(--ghost)`)
- 방장 전용 추방 버튼: 채워진 슬롯 우상단 빨강 "✕" (기존 로직 유지)

---

## 4. 화면별 스펙

### 4.1 홈 (`/` — `LandingPage.jsx`)
- 배경: `var(--grad-page)` 풀스크린
- 우하단 blob 장식 (`var(--blob)`, radius `var(--r-pill)`, blur)
- 중앙: 흰 아이콘박스(144×144, radius 45) + "머니빌리지"(72/900 흰) + "게임 결과를 기록해요!"(20/700 흰)
- 버튼: IntroButton "참여하기"(`var(--purple)` 텍스트) → `/join` / IntroButton "랭킹 보기"(그라데이션) → `/ranking`
- 하단 푸터: "© 2026 머니빌리지" 12/400 흰

### 4.2 로그인 (`/join` — `NameInput.jsx`)
- 배경: `var(--grad-page)`. BackBtn(흰)
- 헤더: "로그인" 36/900 흰 + "팀에 참가하신 것을 환영합니다!" 16/700 흰
- GlassCard: GlassInput(소속) + GlassInput(이름) + GradientButton "다음 →"
- 기존 입력 검증/라우팅 로직 보존

### 4.3 캐릭터 선택 (`/select` — `CharacterSelect.jsx`)
- 흰 배경. BackBtn(#888). 헤더: "캐릭터 선택" 30/900 + 부제 16/700 #888. Divider.
- 4×4 그리드(16종): 타일 175×175, 흰 배경 radius `var(--r-sm)`, 캐릭터 이미지. 선택 시 보더/그림자 강조.
- 하단 CTA: PrimaryButton "이 캐릭터로 시작하기"(radius `var(--r-md)`, 307×70)

### 4.4 팀 구성 (`/team` — `Home.jsx`)
- 흰 배경. BackBtn(#888). 중앙 헤더: "팀 구성" 36/900 + 부제 16/700 #888.
- 카드 2개: "팀 만들기"(⊞ 아이콘) + "팀 참여"(🔑 아이콘), 각 흰 카드 radius `var(--r-sm)`, › 셰브론

### 4.5 팀 만들기 로비 (`/lobby/:code` — `Lobby.jsx`)
- 흰 배경. 좌상단 BackBtn(#888) + 우상단 "🗑 팀 나가기"(#888)
- 헤더: "팀 만들기" 36/900 + 부제 16/700 #888. Divider.
- 초대코드 카드: 라벨(10/700 #888 ls1.5) + 코드(36/900 ls9 #111) + 복사 아이콘
- 팀원 현황: 섹션 라벨 + PlayerSlot 4개 가로 배치
- 하단 버튼: PrimaryButton "가격 설정" + PrimaryButton "프로필 설정" → `/lobby/:code/individual`
- 기존 소켓/추방/QR/가격설정 로직 보존

### 4.6 개인 자산 입력 (`/lobby/:code/individual` — `IndividualPage.jsx`)

**아키텍처 변경:**
- 대시보드+팝업 구조 → **StepBar 전체화면 5단계로 교체**
- 진입점: Lobby "프로필 설정" 버튼 (자동 진입 없음)
- 기존 데이터 있으면 각 단계 값 미리채움, StepBar 탭 클릭으로 단계 이동 가능
- 기존 데이터 없으면 단계 순차 진행 (완료된 단계만 탭 이동 허용)

**단계별:**

| 단계 | 타이틀 | 입력 UI |
|---|---|---|
| 1. 직업 | "직업 선택" | 3×2 그리드, 6종 단일 선택 |
| 2. 성공카드 | "성공카드" | 3×2 그리드, 6종 다중 선택 |
| 3. 부동산 | "부동산" | AssetRow 6줄 + QuantitySelector |
| 4. 주식 | "주식" | AssetRow 6줄 + QuantitySelector (부동산과 동일 패턴) |
| 5. 현금 | "현금" | Numpad 전체화면 + "완료" |

**공통 구조 (각 단계):**
- StepBar (상단) → Divider → 헤더(제목 36/900 + 부제 16/700 #888) → 콘텐츠 → 하단 PrimaryButton "다음" (마지막 단계는 "완료")

**보존:**
- 소켓 데이터 제출 로직 (`updateGameState`, `submitResult` 등)
- `localStorage` 프로필 복원
- 기존 상수(`STOCK_LABELS`, `REAL_ESTATE_LABELS`, `JOB_LABELS`, `BADGE_NAMES` 등)

---

## 5. 구현 순서

### 1단계 — 디자인 시스템
1. `index.css`: Nunito import + 라이트 테마 + `:root` CSS 변수
2. 신규 컴포넌트: `GradientButton`, `IntroButton`, `GlassCard`, `GlassInput`, `StepBar`, `QuantitySelector`, `AssetRow`
3. 리스킨: `BackButton`, `PlayerSlot`

### 2단계 — 인트로 화면
- `LandingPage.jsx` + `.module.css`
- `NameInput.jsx` + `.module.css`
- `CharacterSelect.jsx` + `.module.css`
- `Home.jsx` + `.module.css`

### 3단계 — Lobby
- `Lobby.jsx` + `.module.css`
- "프로필 설정" 버튼 → `/lobby/:code/individual` 라우팅 확인

### 4단계 — IndividualPage 재구성
- 대시보드/팝업 코드 제거
- StepBar 5단계 UI 구현
- 기존 소켓/데이터 로직 보존

---

## 6. 에셋 경로

- 캐릭터: `public/characters/<name>.png`
- 성공카드 배지: `public/badges/<name>.png` (communication, global, idea, money, thinking, trust)
- 부동산 이미지: `public/badges/estate/*.png`
- 주식 이미지: `public/badges/stock/*.png`
- 폰트: Google Fonts (Nunito)
