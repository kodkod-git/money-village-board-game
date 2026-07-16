# 현금/수량 입력 팝업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재사용 가능한 바텀시트 숫자 입력 팝업(`NumberInputModal`)을 만들어, 현금 스텝의 인라인 숫자패드를 "입력란 클릭 → 팝업" 방식으로 바꾸고, 부동산/주식 카드의 수량 숫자를 클릭해도 같은 팝업으로 직접 입력할 수 있게 한다.

**Architecture:** `NumberInputModal`은 자체 숫자 버퍼 상태를 가지며 `title`/`initialValue`/`unit`/`maxValue`/`onConfirm`/`onClose` props만으로 동작하는 독립 컴포넌트다. `QuantitySelector`는 가운데 숫자를 버튼으로 바꿔 클릭 시 이 모달을 열고, 확인 시 기존 `onChange`를 재사용한다. `IndividualPage`의 현금 스텝은 인라인 숫자패드를 제거하고 클릭 가능한 입력란 버튼 + 같은 모달로 교체한다.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, CSS Modules.

**참고 문서:**
- `docs/superpowers/specs/2026-07-16-cash-quantity-input-popup-design.md` (승인된 설계)
- `design/현금-메인.png`, `design/현금-팝업.png` (참고 목업)

---

### Task 1: `NumberInputModal` 컴포넌트 (신규)

**Files:**
- Create: `src/components/NumberInputModal.jsx`
- Create: `src/components/NumberInputModal.module.css`
- Create: `src/components/NumberInputModal.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/NumberInputModal.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import NumberInputModal from './NumberInputModal'

describe('NumberInputModal', () => {
  it('제목과 초기값, 단위를 표시한다', () => {
    render(<NumberInputModal title="현금 입력" initialValue={5000} unit="원" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('현금 입력')).toBeInTheDocument()
    expect(screen.getByTestId('display-value')).toHaveTextContent('5,000')
    expect(screen.getByText('원')).toBeInTheDocument()
  })

  it('숫자 키를 누르면 값 뒤에 이어붙인다', async () => {
    render(<NumberInputModal title="현금 입력" initialValue={0} unit="원" onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    expect(screen.getByTestId('display-value')).toHaveTextContent('5,000')
  })

  it('← 클릭 시 마지막 자리를 지운다', async () => {
    render(<NumberInputModal title="현금 입력" initialValue={50} unit="원" onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByTestId('display-value')).toHaveTextContent('5')
  })

  it('확인 클릭 시 onConfirm에 현재 값을 전달한다', async () => {
    const onConfirm = vi.fn()
    render(<NumberInputModal title="현금 입력" initialValue={1200} unit="원" onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledWith(1200)
  })

  it('maxValue가 있으면 확인 시 그 값으로 클램프한다', async () => {
    const onConfirm = vi.fn()
    render(<NumberInputModal title="수량" initialValue={5} unit="개" maxValue={10} onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledWith(10)
  })

  it('배경(오버레이) 클릭 시 onClose를 호출하고 onConfirm은 호출하지 않는다', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { container } = render(<NumberInputModal title="현금 입력" initialValue={0} unit="원" onConfirm={onConfirm} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('시트 영역 클릭 시 onClose를 호출하지 않는다', async () => {
    const onClose = vi.fn()
    render(<NumberInputModal title="현금 입력" initialValue={0} unit="원" onConfirm={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('현금 입력'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/NumberInputModal.test.jsx`
Expected: FAIL — `Failed to resolve import "./NumberInputModal"`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/NumberInputModal.jsx`:

```jsx
import { useState } from 'react'
import styles from './NumberInputModal.module.css'

const MAX_LENGTH = 10
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '←']

export default function NumberInputModal({ title, initialValue, unit, maxValue, onConfirm, onClose }) {
  const [display, setDisplay] = useState(String(initialValue ?? 0))

  function handleKey(key) {
    if (key === '←') {
      setDisplay(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)))
      return
    }
    setDisplay(prev => {
      const next = prev === '0' ? key : prev + key
      return next.length > MAX_LENGTH ? prev : next
    })
  }

  function handleConfirm() {
    const parsed = parseInt(display, 10) || 0
    const clamped = maxValue != null ? Math.min(parsed, maxValue) : parsed
    onConfirm(clamped)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.display}>
          <span className={styles.value} data-testid="display-value">
            {Number(display).toLocaleString()}
          </span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        <div className={styles.keypad}>
          {KEYS.map(key => (
            <button key={key} type="button" className={styles.key} onClick={() => handleKey(key)}>
              {key}
            </button>
          ))}
        </div>
        <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>
          확인
        </button>
      </div>
    </div>
  )
}
```

`src/components/NumberInputModal.module.css`:

```css
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 300;
}

.sheet {
  width: 100%;
  background: var(--white);
  border-radius: 24px 24px 0 0;
  padding: 12px 24px 24px;
  box-shadow: var(--shadow-card);
}

.handle {
  width: 40px;
  height: 4px;
  background: var(--line);
  border-radius: var(--r-pill);
  margin: 0 auto 16px;
}

.title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  margin-bottom: 8px;
}

.display {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--divider);
}

.value {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
}

.unit {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-2);
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.key {
  background: var(--white);
  border-radius: var(--r-sm);
  border: 1px solid var(--divider);
  height: 64px;
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  box-shadow: var(--shadow-card);
}

.key:active {
  background: var(--slot-empty);
}

.confirmBtn {
  width: 100%;
  height: 56px;
  border-radius: var(--r-sm);
  background: var(--ink);
  color: var(--white);
  font-size: 16px;
  font-weight: 800;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/NumberInputModal.test.jsx`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/NumberInputModal.jsx src/components/NumberInputModal.module.css src/components/NumberInputModal.test.jsx
git commit -m "feat: add NumberInputModal bottom-sheet component"
```

---

### Task 2: `QuantitySelector`에 라벨 + 클릭 가능한 숫자 + 팝업 연동

**Files:**
- Modify: `src/components/QuantitySelector.jsx` (전체 교체)
- Modify: `src/components/QuantitySelector.module.css` (`.count` 규칙 교체)
- Modify: `src/components/QuantitySelector.test.jsx` (전체 교체)

이 태스크는 Task 1에서 완성된 `NumberInputModal`을 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트로 교체**

`src/components/QuantitySelector.test.jsx` 전체를 아래로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import QuantitySelector from './QuantitySelector'

describe('QuantitySelector', () => {
  it('현재 값을 가운데에 표시한다', () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('값이 0이면 0을 표시한다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('+ 버튼 클릭 시 onChange에 value+1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('− 버튼 클릭 시 onChange에 value-1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 감소'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('값이 0이면 − 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 감소')).toBeDisabled()
  })

  it('값이 10이면 + 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={10} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 증가')).toBeDisabled()
  })

  it('가운데 숫자를 클릭하면 라벨을 포함한 수량 입력 팝업이 열린다', async () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} label="단독 가온개미" />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByText('단독 가온개미 수량')).toBeInTheDocument()
  })

  it('팝업에서 확인하면 onChange가 호출되고 팝업이 닫힌다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith(3)
    expect(screen.queryByText('단독 가온개미 수량')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/QuantitySelector.test.jsx`
Expected: FAIL — 가운데 숫자가 아직 `<span>`이라 `getByRole('button', { name: '3' })`를 찾지 못하고, 클릭해도 팝업이 뜨지 않음

- [ ] **Step 3: 컴포넌트 구현**

`src/components/QuantitySelector.jsx` 전체를 아래로 교체:

```jsx
import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import styles from './QuantitySelector.module.css'

const MAX = 10

export default function QuantitySelector({ value, onChange, label }) {
  const [showModal, setShowModal] = useState(false)

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
      <button type="button" className={styles.count} onClick={() => setShowModal(true)}>
        {value}
      </button>
      <button
        className={styles.plusBtn}
        onClick={() => onChange(Math.min(MAX, value + 1))}
        disabled={value >= MAX}
        aria-label="수량 증가"
      >
        +
      </button>

      {showModal && (
        <NumberInputModal
          title={`${label} 수량`}
          initialValue={value}
          unit="개"
          maxValue={MAX}
          onConfirm={next => {
            onChange(next)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: `.count` 스타일을 버튼에 맞게 수정**

`src/components/QuantitySelector.module.css`에서 아래 규칙을 찾아:

```css
.count {
  font-size: 18px;
  font-weight: 900;
  color: var(--ink);
  flex: 1;
  text-align: center;
}
```

아래로 교체:

```css
.count {
  flex: 1;
  background: none;
  border: none;
  font-size: 18px;
  font-weight: 900;
  color: var(--ink);
  text-align: center;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/components/QuantitySelector.test.jsx`
Expected: PASS (8 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/QuantitySelector.jsx src/components/QuantitySelector.module.css src/components/QuantitySelector.test.jsx
git commit -m "feat: open NumberInputModal from QuantitySelector's count button"
```

---

### Task 3: `AssetCard`에서 `label`을 `QuantitySelector`로 전달

**Files:**
- Modify: `src/components/AssetCard.jsx`
- Modify: `src/components/AssetCard.test.jsx` (테스트 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/AssetCard.test.jsx` 맨 아래(마지막 `it` 다음, `describe` 블록 안)에 추가:

```jsx

  it('QuantitySelector에 label을 전달해 수량 팝업 제목에 사용된다', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(
      <AssetCard
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByText('단독 가온개미 수량')).toBeInTheDocument()
  })
```

파일 맨 위 import 목록에 `userEvent`가 없다면(현재 `AssetCard.test.jsx`는 `render`/`screen`/`vi`만 import한다) 아래처럼 상단 import를 정리해도 된다 — 둘 중 편한 방식으로:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssetCard from './AssetCard'
```

(위 방식으로 상단에 `import userEvent from '@testing-library/user-event'`를 추가했다면, 새 테스트 안의 동적 `await import(...)` 줄은 지우고 바로 `userEvent.click(...)`을 쓴다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/AssetCard.test.jsx`
Expected: FAIL — `AssetCard`가 아직 `label`을 `QuantitySelector`에 넘기지 않아 팝업 제목에 "단독 가온개미 수량"이 없음

- [ ] **Step 3: `label` 전달**

`src/components/AssetCard.jsx`에서:

```jsx
      <QuantitySelector value={value} onChange={onChange} />
```

를 아래로 교체:

```jsx
      <QuantitySelector value={value} onChange={onChange} label={label} />
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/AssetCard.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/AssetCard.jsx src/components/AssetCard.test.jsx
git commit -m "feat: pass label from AssetCard to QuantitySelector"
```

---

### Task 4: `IndividualPage` 현금 스텝을 입력란+팝업으로 교체

**Files:**
- Modify: `src/pages/IndividualPage.jsx`
- Modify: `src/pages/IndividualPage.module.css`

`IndividualPage.jsx`는 자동 테스트가 없으므로(다른 태스크와 동일한 이유) 이 태스크는 코드 수정 후 Task 5의 수동 QA로 검증한다.

- [ ] **Step 1: import 및 state 추가**

`src/pages/IndividualPage.jsx` 5번째 줄:

```jsx
import AssetCard from '../components/AssetCard'
```

바로 다음 줄에 추가:

```jsx
import NumberInputModal from '../components/NumberInputModal'
```

같은 파일에서 `const [cashDisplay, setCashDisplay] = useState('0')` 줄 다음에 추가:

```jsx
  const [showCashModal, setShowCashModal] = useState(false)
```

- [ ] **Step 2: 현금 스텝 JSX 교체**

`src/pages/IndividualPage.jsx`에서 `{step === 4 && (` 블록 전체를 찾아:

```jsx
      {step === 4 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>현금</h1>
          <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
          <div className={styles.numpadDisplay}>
            {Number(cashDisplay || 0).toLocaleString()}원
          </div>
          <div className={styles.numpad}>
            {['1','2','3','4','5','6','7','8','9','00','0','←'].map(key => (
              <button
                key={key}
                className={styles.numpadKey}
                onClick={() => {
                  if (key === '←') {
                    setCashDisplay(prev => prev.length <= 1 ? '0' : prev.slice(0, -1))
                  } else {
                    setCashDisplay(prev => {
                      const next = prev === '0' ? key : prev + key
                      return next.length > 10 ? prev : next
                    })
                  }
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}
```

아래로 통째로 교체:

```jsx
      {step === 4 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>현금</h1>
          <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
          <div className={styles.cashCard}>
            <span className={styles.cashLabel}>현금 (원)</span>
            <button
              type="button"
              className={styles.cashInputBtn}
              onClick={() => setShowCashModal(true)}
            >
              {cashDisplay === '0' ? (
                <span className={styles.cashPlaceholder}>예: 5000</span>
              ) : (
                <span className={styles.cashValue}>{Number(cashDisplay).toLocaleString()}원</span>
              )}
            </button>
          </div>

          {showCashModal && (
            <NumberInputModal
              title="현금 입력"
              initialValue={Number(cashDisplay)}
              unit="원"
              onConfirm={val => {
                setCashDisplay(String(val))
                setShowCashModal(false)
              }}
              onClose={() => setShowCashModal(false)}
            />
          )}
        </div>
      )}
```

- [ ] **Step 3: 오래된 현금/숫자패드 CSS 제거**

`src/pages/IndividualPage.module.css`에서 아래 블록(현재 어디에서도 쓰이지 않는 죽은 CSS, `.cashSection`/`.cashInputWrapper`/`.cashInput`/`.cashUnit`)을 찾아:

```css
.cashSection {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cashInputWrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cashInput {
  flex: 1;
  height: 58px;
  border-radius: var(--r-sm);
  border: 1.5px solid var(--line);
  padding: 0 22px;
  font-size: 24px;
  font-weight: 900;
  color: var(--ink);
  outline: none;
}

.cashInput:focus { border-color: var(--purple); }

.cashUnit {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink-2);
}

.numpadDisplay {
  font-size: 36px;
  font-weight: 900;
  color: var(--ink);
  text-align: center;
  padding: 24px 0;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 24px;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 100%;
  margin: 0 auto;
}

.numpadKey {
  background: var(--white);
  border-radius: var(--r-sm);
  border: 1px solid var(--divider);
  height: 72px;
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
  box-shadow: var(--shadow-card);
}

.numpadKey:active { background: var(--slot-empty); }
```

통째로 아래로 교체:

```css
.cashCard {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cashLabel {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}

.cashInputBtn {
  height: 58px;
  border-radius: var(--r-sm);
  border: 1.5px solid var(--line);
  padding: 0 22px;
  text-align: left;
  background: var(--white);
}

.cashPlaceholder {
  font-size: 16px;
  font-weight: 700;
  color: var(--disabled);
}

.cashValue {
  font-size: 20px;
  font-weight: 900;
  color: var(--ink);
}
```

- [ ] **Step 4: 전체 테스트로 회귀 확인**

Run: `npx vitest run --exclude '**/.worktrees/**'`
Expected: 기존 테스트 모두 PASS(`IndividualPage` 자체 테스트는 없으므로 회귀는 다른 파일이 깨지지 않았는지로 확인)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/IndividualPage.jsx src/pages/IndividualPage.module.css
git commit -m "feat: replace inline cash numpad with input button + NumberInputModal"
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

1. 개인 페이지 → 현금 스텝 진입: "현금 (원)" 라벨과 "예: 5000" placeholder가 있는 입력란 버튼이 보이는지 확인.
2. 입력란 클릭 → 하단에서 팝업이 올라오는지, 제목 "현금 입력", 큰 숫자 표시, `1~9/00/0/←` 숫자패드, "확인" 버튼이 보이는지 확인.
3. 숫자 입력 후 "확인" 클릭 → 팝업이 닫히고 입력란에 "5,000원"처럼 값이 표시되는지 확인. 다시 열었을 때 이전 값에서 이어서 수정 가능한지 확인.
4. 팝업 바깥(어두운 배경) 클릭 시 입력값 저장 없이 닫히는지 확인.
5. 부동산/주식 스텝: 카드 안 `−`/`+` 버튼은 그대로 동작하는지, 가운데 숫자를 클릭하면 "{품목명} 수량" 제목의 같은 팝업이 뜨는지, 10을 초과해 입력해도 확인 시 10으로 클램프되는지 확인.

- [ ] **Step 4: 문제 발견 시 조치**

수동 검증 중 레이아웃 깨짐 등이 발견되면 해당 `*.module.css`만 수정하고 `npx vitest run`으로 회귀 여부를 재확인한 뒤 별도 커밋으로 기록한다:

```bash
git add <수정한 파일>
git commit -m "fix: adjust number input modal layout after manual QA"
```

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지**: §2 `NumberInputModal` → Task 1, §3 현금 스텝 → Task 4, §4 부동산/주식 카드 → Task 2, §5 인터페이스 변경 → Task 2·3, §6 범위밖 항목은 태스크에 포함하지 않음. 모두 커버됨.
- **플레이스홀더 없음**: 모든 스텝에 실제 코드/명령어 포함.
- **타입/이름 일관성**: `NumberInputModal`의 props(`title`/`initialValue`/`unit`/`maxValue`/`onConfirm`/`onClose`), `QuantitySelector`의 `label` prop, `data-testid="display-value"`가 전 태스크에서 동일하게 사용됨.
