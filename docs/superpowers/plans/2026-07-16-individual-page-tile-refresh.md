# 직업/성공카드 선택 & 자산 카드 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `IndividualPage`의 직업/성공카드 선택 타일에 검정 배경+흰색 텍스트 선택 상태를 추가하고, 부동산/주식 수량 입력 UI를 `design/부동산.png`에 맞춰 카드+`−/+` 스테퍼 형태로 재구성한다.

**Architecture:** `QuantitySelector`(1~10 숫자 채우기 방식)를 `−/+` 스테퍼로 완전히 다시 작성하고, `AssetRow`를 `AssetCard`로 리네임하며 가로 행에서 세로 카드로 레이아웃을 바꾼다. `IndividualPage.jsx`는 새 컴포넌트를 그대로 가져다 쓰고, `.assetList`를 3열 그리드로 바꾼다. 두 컴포넌트 모두 `props` 인터페이스(`value`/`onChange` 등)는 그대로 유지해 `IndividualPage.jsx`의 상태 관리 로직은 건드리지 않는다.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, CSS Modules.

**참고 문서:**
- `docs/superpowers/specs/2026-07-16-individual-page-tile-refresh-design.md` (승인된 설계)
- `design/부동산.png` (참고 목업)

---

### Task 1: 직업/성공카드 선택 타일 색상

**Files:**
- Modify: `src/pages/IndividualPage.module.css:73-76`

`IndividualPage.jsx`는 자동 테스트가 없다(socket/fetch 모킹이 필요해 이 프로젝트에서 아직 커버되지 않음). 이 태스크는 CSS만 수정하고 Task 5의 수동 QA로 검증한다.

- [ ] **Step 1: `.tileSelected` 색상 변경**

`src/pages/IndividualPage.module.css`에서 아래 규칙을 찾아:

```css
.tileSelected {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(108, 125, 229, 0.2);
}
```

아래로 교체:

```css
.tileSelected {
  background: var(--ink);
  border-color: var(--ink);
}

.tileSelected .tileLabel {
  color: var(--white);
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/IndividualPage.module.css
git commit -m "feat: fill selected job/badge tiles with black background"
```

---

### Task 2: `QuantitySelector`를 `−/+` 스테퍼로 교체

**Files:**
- Modify: `src/components/QuantitySelector.jsx` (전체 교체)
- Modify: `src/components/QuantitySelector.module.css` (전체 교체)
- Modify: `src/components/QuantitySelector.test.jsx` (전체 교체)

- [ ] **Step 1: 실패하는 테스트로 교체**

`src/components/QuantitySelector.test.jsx` 전체를 아래로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import QuantitySelector from './QuantitySelector'

describe('QuantitySelector', () => {
  it('현재 값을 가운데에 표시한다', () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('값이 0이면 숫자 대신 대시(—)를 표시한다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('+ 버튼 클릭 시 onChange에 value+1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('− 버튼 클릭 시 onChange에 value-1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('수량 감소'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('값이 0이면 − 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} />)
    expect(screen.getByLabelText('수량 감소')).toBeDisabled()
  })

  it('값이 10이면 + 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={10} onChange={vi.fn()} />)
    expect(screen.getByLabelText('수량 증가')).toBeDisabled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/QuantitySelector.test.jsx`
Expected: FAIL — 기존 구현은 `−`/`+` 버튼이나 `aria-label`이 없어 여러 테스트가 실패함

- [ ] **Step 3: 컴포넌트 구현**

`src/components/QuantitySelector.jsx` 전체를 아래로 교체:

```jsx
import styles from './QuantitySelector.module.css'

const MAX = 10

export default function QuantitySelector({ value, onChange }) {
  return (
    <div className={styles.stepper}>
      <button
        className={styles.minusBtn}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label="수량 감소"
      >
        −
      </button>
      <span className={styles.count}>{value > 0 ? value : '—'}</span>
      <button
        className={styles.plusBtn}
        onClick={() => onChange(Math.min(MAX, value + 1))}
        disabled={value >= MAX}
        aria-label="수량 증가"
      >
        +
      </button>
    </div>
  )
}
```

`src/components/QuantitySelector.module.css` 전체를 아래로 교체:

```css
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  padding: 4px;
}

.minusBtn,
.plusBtn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.minusBtn {
  background: var(--white);
  border: 1px solid var(--line);
  color: var(--ink);
}

.plusBtn {
  background: var(--ink);
  border: none;
  color: var(--white);
}

.minusBtn:disabled,
.plusBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.count {
  font-size: 18px;
  font-weight: 900;
  color: var(--ink);
  flex: 1;
  text-align: center;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/QuantitySelector.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/QuantitySelector.jsx src/components/QuantitySelector.module.css src/components/QuantitySelector.test.jsx
git commit -m "feat: replace QuantitySelector with a plus/minus stepper"
```

---

### Task 3: `AssetRow` → `AssetCard` 리네임 + 카드 레이아웃

**Files:**
- Rename: `src/components/AssetRow.jsx` → `src/components/AssetCard.jsx`
- Rename: `src/components/AssetRow.module.css` → `src/components/AssetCard.module.css`
- Rename: `src/components/AssetRow.test.jsx` → `src/components/AssetCard.test.jsx`

이 태스크는 Task 2에서 완성된 `QuantitySelector`(스테퍼)를 그대로 가져다 쓴다.

- [ ] **Step 1: 파일 이름 변경**

```bash
git mv src/components/AssetRow.jsx src/components/AssetCard.jsx
git mv src/components/AssetRow.module.css src/components/AssetCard.module.css
git mv src/components/AssetRow.test.jsx src/components/AssetCard.test.jsx
```

- [ ] **Step 2: 실패하는 테스트로 교체**

`src/components/AssetCard.test.jsx` 전체를 아래로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AssetCard from './AssetCard'

describe('AssetCard', () => {
  it('명칭과 가격을 렌더링한다', () => {
    render(
      <AssetCard
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('단독 가온개미')).toBeInTheDocument()
    expect(screen.getByText('2만원')).toBeInTheDocument()
  })

  it('현재 수량을 스테퍼 안에 표시한다', () => {
    render(
      <AssetCard
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/components/AssetCard.test.jsx`
Expected: FAIL — `import AssetCard from './AssetCard'`는 되지만(파일은 이미 이름이 바뀜) 내부 구현이 아직 옛날 가로 행(`AssetRow`) 마크업이라 `getByText('3')`가 "3개" 텍스트 노드 안에 섞여 있어 검증 방식이 어긋남. 실제로는 `default export` 함수명이 `AssetRow`로 남아있어 확인이 필요하다면 우선 이 스텝에서 실패를 확인한다.

- [ ] **Step 4: 컴포넌트 구현**

`src/components/AssetCard.jsx` 전체를 아래로 교체:

```jsx
import QuantitySelector from './QuantitySelector'
import styles from './AssetCard.module.css'

export default function AssetCard({ image, label, price, value, onChange }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <img src={image} alt={label} className={styles.img} />
        <div className={styles.info}>
          <span className={styles.label}>{label}</span>
          <span className={styles.price}>{price}</span>
        </div>
      </div>
      <QuantitySelector value={value} onChange={onChange} />
    </div>
  )
}
```

`src/components/AssetCard.module.css` 전체를 아래로 교체:

```css
.card {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}

.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  word-break: keep-all;
}

.price {
  font-size: 11px;
  font-weight: 400;
  color: var(--ink-2);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/components/AssetCard.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/AssetCard.jsx src/components/AssetCard.module.css src/components/AssetCard.test.jsx
git commit -m "refactor: rename AssetRow to AssetCard with card layout"
```

---

### Task 4: `IndividualPage` 연결 + 그리드 레이아웃

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Modify: `src/pages/IndividualPage.module.css:110-115`

`IndividualPage.jsx`는 자동 테스트가 없으므로(Task 1과 동일한 이유) 이 태스크는 코드 수정 후 Task 5의 수동 QA로 검증한다.

- [ ] **Step 1: import 및 사용처 변경**

`src/pages/IndividualPage.jsx` 5번째 줄:

```jsx
import AssetRow from '../components/AssetRow'
```

를 아래로 교체:

```jsx
import AssetCard from '../components/AssetCard'
```

같은 파일에서 부동산 스텝(step 2)의 `<AssetRow` 를 찾아:

```jsx
              <AssetRow
                key={key}
                image={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                label={REAL_ESTATE_LABELS[key]}
                price={ESTATE_PRICES[key]}
                value={gameState.realEstate[key]}
                onChange={val => {
```

`AssetRow`를 `AssetCard`로 교체(나머지 props는 동일):

```jsx
              <AssetCard
                key={key}
                image={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                label={REAL_ESTATE_LABELS[key]}
                price={ESTATE_PRICES[key]}
                value={gameState.realEstate[key]}
                onChange={val => {
```

주식 스텝(step 3)의 `<AssetRow` 도 동일하게 찾아:

```jsx
              <AssetRow
                key={key}
                image={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                label={STOCK_LABELS[key]}
                price="가격 설정"
                value={gameState.stocks[key]}
                onChange={val => {
```

`AssetRow`를 `AssetCard`로 교체:

```jsx
              <AssetCard
                key={key}
                image={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                label={STOCK_LABELS[key]}
                price="가격 설정"
                value={gameState.stocks[key]}
                onChange={val => {
```

- [ ] **Step 2: `.assetList`를 그리드로 변경**

`src/pages/IndividualPage.module.css`에서 아래 규칙을 찾아:

```css
.assetList {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}
```

아래로 교체:

```css
.assetList {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-bottom: 24px;
}
```

- [ ] **Step 3: 전체 테스트로 회귀 확인**

Run: `npx vitest run`
Expected: 기존 테스트 모두 PASS(`IndividualPage` 자체 테스트는 없으므로 회귀는 다른 파일에서 `AssetRow`/`AssetCard`를 잘못 참조하지 않는지로 확인)

- [ ] **Step 4: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.module.css
git commit -m "feat: use AssetCard grid layout in IndividualPage real estate/stock steps"
```

---

### Task 5: 전체 테스트 실행 + 수동 QA

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run --exclude '**/.worktrees/**'`
Expected: 모든 테스트 PASS, 회귀 없음

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 개발 서버로 수동 확인**

Run: `npm run dev`

1. 팀 로비 → "프로필 설정"(개인 페이지) 진입 → 직업 선택 화면에서 타일 클릭 시 배경이 검정으로, 텍스트가 흰색으로 바뀌는지 확인.
2. 성공카드 화면에서도 동일하게 선택 시 검정 배경 + 흰 텍스트로 바뀌는지 확인(뱃지 이미지 자체는 그대로).
3. 부동산 화면: 6개 항목이 3열 카드 그리드로 배치되는지, 각 카드 하단에 `−`(흰 원)/숫자/`+`(검정 원) 스테퍼가 있는지 확인. `+`를 눌러 10까지 증가시키면 `+`가 비활성화되는지, `−`로 0까지 내리면 숫자가 `—`로 바뀌고 `−`가 비활성화되는지 확인.
4. 주식 화면에서도 동일한 카드 그리드/스테퍼 동작을 확인.

- [ ] **Step 4: 문제 발견 시 조치**

수동 검증 중 레이아웃 깨짐 등이 발견되면 해당 `*.module.css`만 수정하고 `npx vitest run`으로 회귀 여부를 재확인한 뒤 별도 커밋으로 기록한다:

```bash
git add <수정한 파일>
git commit -m "fix: adjust individual page card layout after manual QA"
```

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지**: §1 타일 색상 → Task 1, §2.2 컴포넌트 변경 → Task 2·3, §2.3 레이아웃 변경 → Task 4, §2.4 영향범위(다른 화면 없음) → 별도 태스크 불필요, §3 범위밖 항목은 태스크에 포함하지 않음. 모두 커버됨.
- **플레이스홀더 없음**: 모든 스텝에 실제 코드/명령어 포함.
- **타입/이름 일관성**: `AssetCard`, `QuantitySelector`의 `value`/`onChange` props, `styles.minusBtn`/`styles.plusBtn`/`styles.count` 클래스명이 전 태스크에서 동일하게 사용됨.
