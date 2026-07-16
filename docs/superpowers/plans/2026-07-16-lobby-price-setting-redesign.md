# 로비 버튼 재배치 & 가격 설정 팝업 재구현 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Lobby.jsx`의 "팀 나가기"/"가격 설정"/"결과 등록" 버튼 배치를 목업대로 바꾸고, `PriceSettingModal`을 탭+리스트+`NumberInputModal` 재사용 방식으로 완전히 다시 만든다.

**Architecture:** "팀 나가기"는 아이콘 전용 버튼으로 하단 액션바 왼쪽에, "가격 설정"은 우측 상단 pill 버튼으로 이동한다. "결과 등록"은 보라색 오버라이드를 제거해 기본 검정색을 그대로 쓴다. `PriceSettingModal`은 탭(주식/부동산)으로 카테고리를 전환하는 하나의 리스트 화면이 되고, 각 가격 항목을 누르면 이미 존재하는 `NumberInputModal`을 그대로 열어 직접 입력받는다.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, CSS Modules.

**참고 문서:**
- `docs/superpowers/specs/2026-07-16-lobby-price-setting-redesign-design.md` (승인된 설계)
- `design/exit_to_app.png`, `design/팀 만들기.png`, `design/가격 설정-팝업.png`, `design/가격 설정-입력.png` (참고 목업)

---

### Task 1: 아이콘 에셋 복사

**Files:**
- Create: `public/icons/exit_to_app.png` (`design/exit_to_app.png` 복사본)

- [ ] **Step 1: 파일 복사**

```bash
cp "design/exit_to_app.png" "public/icons/exit_to_app.png"
```

- [ ] **Step 2: 커밋**

```bash
git add public/icons/exit_to_app.png
git commit -m "chore: add exit_to_app icon asset"
```

---

### Task 2: 로비 버튼 재배치

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Modify: `src/pages/Lobby.module.css`

`Lobby.jsx`의 메인 컴포넌트 렌더링 부분만 바꾼다(모달 함수들은 Task 3에서 다룬다). 이 태스크는 Task 1에서 추가한 `exit_to_app.png` 아이콘을 사용한다.

- [ ] **Step 1: 상단 "팀 나가기" 버튼을 "가격 설정" pill 버튼으로 교체**

`src/pages/Lobby.jsx`에서:

```jsx
      {!readOnly && <BackButton />}
      {!readOnly && (
        <button className={styles.leaveBtn} onClick={handleLeave} aria-label="팀 나가기">
          <img src="/icons/팀 나가기.png" alt="" className={styles.leaveIcon} />
          <span>팀 나가기</span>
        </button>
      )}
```

를 아래로 교체:

```jsx
      {!readOnly && <BackButton />}
      {canManageRoom && (
        <button
          className={styles.priceSettingBtn}
          onClick={() => setShowPriceModal(true)}
          type="button"
        >
          <span aria-hidden="true">⚙️</span> 가격 설정
        </button>
      )}
```

- [ ] **Step 2: 하단 액션바를 나가기 아이콘 + 결과 등록으로 교체**

같은 파일에서:

```jsx
      {canManageRoom && (
        <div className={styles.bottomBar}>
          <button className={styles.actionBtn} onClick={() => setShowPriceModal(true)}>
            가격 설정
          </button>
          <button
            className={`${styles.actionBtn} ${styles.submitBtn}`}
            onClick={() => setShowConfirmModal(true)}
            disabled={!canSubmitResult || isSubmitting}
          >
            {isSubmitting ? '제출 중...' : '결과 등록'}
          </button>
        </div>
      )}
```

를 아래로 교체:

```jsx
      <div className={styles.bottomBar}>
        {!readOnly && (
          <button
            className={styles.exitBtn}
            onClick={handleLeave}
            aria-label="팀 나가기"
            type="button"
          >
            <img src="/icons/exit_to_app.png" alt="" className={styles.exitIcon} />
          </button>
        )}
        {canManageRoom && (
          <button
            className={styles.actionBtn}
            onClick={() => setShowConfirmModal(true)}
            disabled={!canSubmitResult || isSubmitting}
          >
            {isSubmitting ? '제출 중...' : '결과 등록'}
          </button>
        )}
      </div>
```

`canManageRoom = readOnly || isHost`이므로 `readOnly`일 때는 항상 `canManageRoom`도 참이 되고, `readOnly`가 아닐 때는 `!readOnly`가 항상 참이다 — 즉 이 `<div className={styles.bottomBar}>`는 항상 최소 한 개 이상의 버튼을 담게 되어 별도의 바깥 조건 없이 항상 렌더링해도 된다(빈 바가 나오는 경우는 없다).

- [ ] **Step 3: CSS 교체 — `.leaveBtn`/`.leaveIcon` → `.priceSettingBtn`**

`src/pages/Lobby.module.css`에서:

```css
.leaveBtn {
  position: absolute;
  top: 32px;
  right: 24px;
  background: none;
  border: none;
  height: 28px;
  padding: 3px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.leaveIcon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
}
```

를 아래로 교체:

```css
.priceSettingBtn {
  position: absolute;
  top: 32px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  height: 40px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 4: CSS 교체 — `.submitBtn` 제거, `.exitBtn`/`.exitIcon` 추가**

같은 파일에서:

```css
.actionBtn {
  flex: 1;
  background: var(--ink);
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  border-radius: var(--r-sm);
  height: 46px;
  padding: 0 12px;
  box-shadow: var(--shadow-card);
}

.submitBtn { background: var(--purple); }
.actionBtn:disabled {
  background: var(--slot-empty);
  color: var(--disabled);
  border: 1px solid var(--line);
  box-shadow: none;
  cursor: not-allowed;
}
```

를 아래로 교체:

```css
.actionBtn {
  flex: 1;
  background: var(--ink);
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  border-radius: var(--r-sm);
  height: 46px;
  padding: 0 12px;
  box-shadow: var(--shadow-card);
}

.actionBtn:disabled {
  background: var(--slot-empty);
  color: var(--disabled);
  border: 1px solid var(--line);
  box-shadow: none;
  cursor: not-allowed;
}

.exitBtn {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  background: var(--white);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
}

.exitIcon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
```

- [ ] **Step 5: 기존 테스트로 회귀 확인**

Run: `npx vitest run src/pages/Lobby.test.jsx`
Expected: PASS (기존 7개 테스트 모두 — readOnly 모드에서 "팀 나가기" `aria-label` 부재, "가격 설정"/"결과 등록" 텍스트 존재 확인 포함)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.module.css
git commit -m "feat: move leave/price-setting buttons to match design"
```

---

### Task 3: `PriceSettingModal` 재구현

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Modify: `src/pages/Lobby.module.css`
- Modify: `src/pages/Lobby.test.jsx` (테스트 추가)

이 태스크는 이미 존재하는 `NumberInputModal`(`src/components/NumberInputModal.jsx`)을 그대로 가져다 쓴다. Task 2에서 바뀐 메인 컴포넌트 렌더링 부분은 건드리지 않는다.

- [ ] **Step 1: import 및 이미지 매핑 상수 추가**

`src/pages/Lobby.jsx` 상단 import 목록:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import QRCodeImage from '../components/QRCodeImage'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Lobby.module.css'
```

를 아래로 교체:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import QRCodeImage from '../components/QRCodeImage'
import NumberInputModal from '../components/NumberInputModal'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Lobby.module.css'
```

같은 파일에서 `const DEFAULT_PRICES = { ... }` 블록 다음(빈 줄 다음, `export default function Lobby` 이전)에 추가:

```jsx
const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

const REAL_ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/pages/Lobby.test.jsx` 상단 import에 `userEvent`가 없다면 추가:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
```

파일 맨 아래(마지막 `describe('Lobby readOnly mode', ...)` 블록 다음)에 추가:

```jsx

describe('Lobby price setting modal', () => {
  it('가격 설정 버튼을 누르면 팝업이 열리고 기본으로 주식 목록이 보인다', async () => {
    renderLobby()
    await userEvent.click(screen.getByText('가격 설정'))
    expect(screen.getByText('반도체 IT')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    renderLobby()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
  })

  it('가격 pill을 누르면 숫자 입력 팝업이 열리고, 확인하면 가격이 갱신된다', async () => {
    renderLobby()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getByRole('button', { name: /2,000 원/ }))
    expect(screen.getByText('반도체 IT')).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByRole('button', { name: /9,000 원/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/pages/Lobby.test.jsx`
Expected: FAIL — 아직 옛 2단계(카테고리 카드 선택 → 수량 조절) 플로우라 "반도체 IT" 같은 텍스트나 탭이 없음

- [ ] **Step 4: `PriceSettingModal` 전체 교체**

`src/pages/Lobby.jsx`에서 `function PriceSettingModal({ prices, onConfirm, onClose }) {` 부터 파일 끝까지(이 함수가 파일의 마지막 함수다) 전체를 찾아 아래로 교체:

```jsx
function PriceSettingModal({ prices, onConfirm, onClose }) {
  const [category, setCategory] = useState('stocks')
  const [tempPrices, setTempPrices] = useState(prices)
  const [editingKey, setEditingKey] = useState(null)

  function handleReset() {
    setTempPrices(prev => ({ ...prev, [category]: DEFAULT_PRICES[category] }))
  }

  const labels = category === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const images = category === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const folder = category === 'stocks' ? 'stock' : 'estate'
  const editingLabel = editingKey ? labels[editingKey] : null

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.priceModal} onClick={e => e.stopPropagation()}>
          <div className={styles.priceModalHeader}>
            <button className={styles.priceBackBtn} onClick={onClose} type="button">‹ 뒤로</button>
            <span className={styles.priceModalTitle}>가격 설정</span>
            <button className={styles.priceResetBtn} onClick={handleReset} type="button">초기화</button>
          </div>

          <div className={styles.priceTabs}>
            <button
              className={`${styles.priceTab} ${category === 'stocks' ? styles.priceTabActive : ''}`}
              onClick={() => setCategory('stocks')}
              type="button"
            >
              주식
            </button>
            <button
              className={`${styles.priceTab} ${category === 'realEstate' ? styles.priceTabActive : ''}`}
              onClick={() => setCategory('realEstate')}
              type="button"
            >
              부동산
            </button>
          </div>

          <div className={styles.priceList}>
            {Object.keys(labels).map(key => (
              <div key={key} className={styles.priceRow}>
                <img src={`/badges/${folder}/${images[key]}.png`} alt="" className={styles.priceIcon} />
                <div className={styles.priceInfo}>
                  <span className={styles.priceLabel}>{labels[key]}</span>
                  <span className={styles.priceUnit}>단위: 원</span>
                </div>
                <button
                  className={styles.pricePill}
                  onClick={() => setEditingKey(key)}
                  type="button"
                >
                  {tempPrices[category][key].toLocaleString()} 원 ›
                </button>
              </div>
            ))}
          </div>

          <button className={styles.priceConfirmBtn} onClick={() => onConfirm(tempPrices)} type="button">
            확인하기
          </button>
        </div>
      </div>

      {editingKey && (
        <NumberInputModal
          title={editingLabel}
          initialValue={tempPrices[category][editingKey]}
          unit="원"
          onConfirm={val => {
            setTempPrices(prev => ({ ...prev, [category]: { ...prev[category], [editingKey]: val } }))
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 5: 죽은 CSS 제거 + 가격 설정 팝업 전용 스타일 추가**

`src/pages/Lobby.module.css`에서 파일 끝의 아래 블록(옛 2단계 플로우 전용, `ConfirmModal`은 쓰지 않는 클래스들)을 찾아:

```css
.categoryGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.categoryCard {
  background: var(--slot-empty);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.categoryIcon { font-size: 32px; }

.categoryLabel {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}

.quantityList {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.quantityItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.quantityLabel {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  flex: 1;
}

.quantityControls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qtyBtn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--slot-empty);
  border: 1px solid var(--line);
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.priceDisplay {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  min-width: 80px;
  text-align: center;
}
```

통째로 아래로 교체:

```css
.priceModal {
  background: var(--white);
  border-radius: var(--r-lg);
  width: min(360px, calc(100% - 32px));
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.priceModalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
  flex-shrink: 0;
}

.priceBackBtn {
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
}

.priceModalTitle {
  font-size: 17px;
  font-weight: 900;
  color: var(--ink);
}

.priceResetBtn {
  background: var(--slot-empty);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
}

.priceTabs {
  display: flex;
  border-bottom: 1px solid var(--divider);
  padding: 0 20px;
  flex-shrink: 0;
}

.priceTab {
  flex: 1;
  background: none;
  border: none;
  height: 40px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  border-bottom: 2px solid transparent;
}

.priceTabActive {
  color: var(--ink);
  border-bottom-color: var(--ink);
}

.priceList {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.priceRow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.priceIcon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}

.priceInfo {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.priceLabel {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.priceUnit {
  font-size: 11px;
  color: var(--ink-2);
}

.pricePill {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  height: 40px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 900;
  color: var(--ink);
  white-space: nowrap;
}

.priceConfirmBtn {
  margin: 12px 20px 20px;
  height: 52px;
  border-radius: var(--r-sm);
  background: var(--ink);
  color: var(--white);
  font-size: 16px;
  font-weight: 800;
  flex-shrink: 0;
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/pages/Lobby.test.jsx`
Expected: PASS (10개 테스트: 기존 7개 + 신규 3개)

- [ ] **Step 7: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.module.css src/pages/Lobby.test.jsx
git commit -m "feat: rebuild PriceSettingModal with tabs and NumberInputModal"
```

---

### Task 4: 전체 테스트 실행 + 수동 QA

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run --exclude '**/.worktrees/**'`
Expected: 모든 테스트 PASS, 회귀 없음

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 개발 서버로 수동 확인**

Run: `npm run dev`

1. 로비 화면(호스트로 접속): 우측 상단에 "⚙️ 가격 설정" 버튼, 하단에 나가기 아이콘 버튼 + 검정색 "결과 등록" 버튼이 나란히 보이는지 확인.
2. 비호스트 팀원으로 접속(또는 시뮬레이션): 하단에 나가기 아이콘 버튼만 보이고 "결과 등록"은 없는지, "가격 설정"도 안 보이는지 확인.
3. "가격 설정" 클릭 → 팝업이 뜨고 "주식" 탭이 기본으로 선택되어 6개 항목이 아이콘과 함께 보이는지 확인. "부동산" 탭 클릭 시 목록이 바뀌는지 확인.
4. 가격 pill 클릭 → `NumberInputModal`이 뜨고 현재 가격이 미리 채워져 있는지, 확인 시 pill의 표시 가격이 바뀌는지 확인.
5. "초기화" 클릭 → 현재 보고 있는 탭의 가격만 기본값으로 돌아가는지, 다른 탭 값은 유지되는지 확인.
6. "확인하기" 클릭 → 팝업이 닫히고 실제로 가격이 반영되는지(다시 열었을 때 값이 유지되는지) 확인.

- [ ] **Step 4: 문제 발견 시 조치**

수동 검증 중 레이아웃 깨짐 등이 발견되면 해당 `*.module.css`만 수정하고 `npx vitest run`으로 회귀 여부를 재확인한 뒤 별도 커밋으로 기록한다:

```bash
git add <수정한 파일>
git commit -m "fix: adjust lobby/price modal layout after manual QA"
```

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지**: §1.1 팀 나가기 → Task 2, §1.2 가격 설정 위치 → Task 2, §1.3 결과 등록 검정색 → Task 2, §2 가격 설정 팝업 재구현 → Task 3, §2.3 죽은 CSS 정리 → Task 3. 모두 커버됨.
- **플레이스홀더 없음**: 모든 스텝에 실제 코드/명령어 포함.
- **타입/이름 일관성**: `STOCK_IMAGES`/`REAL_ESTATE_IMAGES`, `.exitBtn`/`.priceSettingBtn`/`.priceModal` 계열 클래스명이 Task 2·3에서 동일하게 사용됨.
