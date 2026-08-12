# 랭킹 페이지 자산 상세 팝업 클리핑 버그 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 페이지에서 참여자를 클릭했을 때 뜨는 자산 상세 팝업이 모바일에서 화면 밖으로 잘리는 버그를 고친다.

**Architecture:** `RankingPage.module.css`의 `.popup`이 `vh` 대신 프로젝트 전반의 기존 컨벤션인 `dvh`(dynamic viewport height)를 쓰도록 바꾸고, `.overlay`에 스크롤 여유를 추가한다. 순수 CSS 변경이므로 자동 테스트 대상이 아니다(다른 팝업들도 동일 컨벤션 — `Team.module.css`, `AdminDashboard.module.css`의 `vh` 사용은 버그 리포트 대상이 아니므로 이번 범위에서 건드리지 않는다).

**Tech Stack:** CSS Modules

---

### Task 1: `.popup`을 `dvh`로 변경하고 오버레이에 스크롤 여유 추가

**Files:**
- Modify: `src/pages/RankingPage.module.css`

- [ ] **Step 1: `.popup`의 `max-height` 단위 변경**

`src/pages/RankingPage.module.css`에서:

```css
.popup {
  position: relative;
  background: var(--white);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  width: min(420px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
```

을 다음으로 교체:

```css
.popup {
  position: relative;
  background: var(--white);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  width: min(420px, 92vw);
  max-height: 90dvh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
```

- [ ] **Step 2: `.overlay`에 스크롤 여유 추가**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}
```

을 다음으로 교체:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 24px 0;
  z-index: 500;
}
```

- [ ] **Step 3: 수동으로 확인**

이 변경은 CSS 단위 조정이라 자동 테스트 대상이 아니다. 다음으로 수동 확인한다:

Run: `npm run dev`

1. 브라우저(또는 브라우저 개발자 도구의 모바일 에뮬레이션, 예: iPhone SE 375×667, 주소창 표시 상태 시뮬레이션)로 `/ranking` 접속.
2. 참여자가 여러 자산(현금+주식 3종+부동산 3종 이상)을 보유한 상태로 결과를 하나 등록해 둔다(또는 기존 테스트 데이터 사용).
3. 해당 참여자 행을 클릭해 자산 상세 팝업을 연다.
4. 팝업 상단(‹ 뒤로 버튼, 프로필)과 하단(총 자산 footer)이 모두 화면 안에 보이거나, 화면보다 크면 팝업 내부 스크롤로 전부 접근 가능한지 확인한다.
5. 데스크톱 폭(주소창 이슈 없음)에서도 레이아웃이 기존과 동일하게 보이는지 확인한다(회귀 없음).

- [ ] **Step 4: 커밋**

```bash
git add src/pages/RankingPage.module.css
git commit -m "fix: use dvh for asset detail popup to prevent mobile viewport clipping"
```
