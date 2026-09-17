# 성공열쇠/주식/부동산 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성공열쇠 문구·배수, 주식/부동산 종목(6→3), 입력 레이아웃, 기존 데이터, 관리자 수업목록 UX를 설계 문서(`docs/superpowers/specs/2026-09-17-asset-rebalance-design.md`) 대로 구현한다.

**Architecture:** `src/constants/gameData.js`를 라벨/종목의 단일 출처로 삼고, 클라이언트 컴포넌트와 `server/db.js`가 모두 여기서 import한다. 배수·활성 종목 계산은 `server/db.js`의 `calculateAssetBreakdown` 한 곳에만 있고, 기존 데이터는 1회성 스크립트로 재계산한다.

**Tech Stack:** React 18 + Vite, Express, Supabase, Vitest + Testing Library.

---

## 파일 구조 개요

**수정**
- `src/constants/gameData.js` — 성공열쇠/주식/부동산 라벨·이미지·가격 상수
- `src/constants/gameData.test.js`
- `src/components/BadgePicker.test.jsx`
- `src/components/admin/BadgeEditModal.test.jsx`
- `src/components/AssetListEditor.test.jsx`
- `src/components/admin/RealEstateEditModal.test.jsx`
- `src/components/admin/AdminAssetSummary.test.jsx`
- `src/components/PriceSettingModal.jsx` — 중복 라벨 제거, gameData import로 통합
- `src/components/PriceSettingModal.test.jsx`
- `src/components/admin/AdminPriceSettingModal.test.jsx`
- `src/components/admin/AdminGridCard.test.jsx`
- `src/components/admin/AdminSpectateModal.test.jsx`
- `src/pages/Team.test.jsx`
- `server/db.js` — 배수 공식 + 활성 종목 필터링
- `server/db.test.js`
- `src/pages/IndividualPage.module.css` — 입력 카드 그리드
- `server/classes.js` — 수업 목록 정렬
- `server/classes.test.js`
- `src/components/admin/ConfirmDialog.jsx` — `hideCancel` 옵션 추가
- `src/components/admin/ConfirmDialog.test.jsx`
- `src/pages/AdminClassList.jsx` — 빈 이름 경고 팝업
- `src/pages/AdminClassList.test.jsx`

**신규**
- `scripts/backfill-asset-rebalance.js` — 1회성 데이터 백필 스크립트

각 태스크는 완료 후 전체 테스트 스위트가 그린 상태를 유지한다. 태스크 2(종목 축소)는 태스크 3(중복 통합)과 태스크 4(배수/활성종목 계산)의 선행 조건이다.

---

### Task 1: 성공열쇠 라벨 변경

**Files:**
- Modify: `src/constants/gameData.js:15-19`
- Modify: `src/components/BadgePicker.test.jsx`
- Modify: `src/components/admin/BadgeEditModal.test.jsx`

- [ ] **Step 1: 테스트를 새 라벨 기준으로 먼저 수정한다**

`src/components/BadgePicker.test.jsx` 전체를 다음으로 교체:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgePicker from './BadgePicker'

const NONE = [false, false, false, false, false, false]

describe('BadgePicker', () => {
  it('6개의 성공카드 타일을 렌더링한다', () => {
    render(<BadgePicker badges={NONE} onToggle={vi.fn()} />)
    expect(screen.getByText('행운')).toBeInTheDocument()
    expect(screen.getByText('은행')).toBeInTheDocument()
  })

  it('선택된 카드에 선택 스타일을 적용한다', () => {
    const badges = [true, false, false, false, false, false]
    render(<BadgePicker badges={badges} onToggle={vi.fn()} />)
    const tile = screen.getByText('행운').closest('button')
    expect(tile.className).toMatch(/tileSelected/)
  })

  it('타일 클릭 시 onToggle을 해당 인덱스로 호출한다', async () => {
    const onToggle = vi.fn()
    render(<BadgePicker badges={NONE} onToggle={onToggle} />)
    await userEvent.click(screen.getByText('직업'))
    expect(onToggle).toHaveBeenCalledWith(2)
  })
})
```

`src/components/admin/BadgeEditModal.test.jsx:13`의 `'문제해결능력'`을 `'직업'`으로 바꾼다:

```jsx
    await userEvent.click(screen.getByText('직업'))
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/components/BadgePicker.test.jsx src/components/admin/BadgeEditModal.test.jsx`
Expected: FAIL (아직 `gameData.js`가 옛 라벨을 갖고 있어 `'행운'`/`'은행'`/`'직업'` 텍스트를 찾지 못함)

- [ ] **Step 3: gameData.js의 BADGE_LABELS를 새 문구로 교체한다**

`src/constants/gameData.js:15-19`를 다음으로 교체:

```js
export const BADGE_LABELS = {
  communication: '행운', global: '부동산',
  idea: '직업', money: '노동',
  thinking: '주식', trust: '은행',
}
```

(키 이름과 `BADGE_NAMES` 배열 순서는 저장된 게임 결과와의 인덱스 호환을 위해 그대로 둔다 — 문구만 바뀐다.)

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/components/BadgePicker.test.jsx src/components/admin/BadgeEditModal.test.jsx src/constants/gameData.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/constants/gameData.js src/components/BadgePicker.test.jsx src/components/admin/BadgeEditModal.test.jsx
git commit -m "$(cat <<'EOF'
feat: rename badge labels to 노동/직업/은행/주식/부동산/행운

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 2: 주식/부동산 라벨·이미지·가격 축소 (6종 → 3종)

**Files:**
- Modify: `src/constants/gameData.js:23-43`
- Modify: `src/constants/gameData.test.js:22-33`
- Modify: `src/components/AssetListEditor.test.jsx`
- Modify: `src/components/admin/RealEstateEditModal.test.jsx`
- Modify: `src/components/admin/AdminAssetSummary.test.jsx`

- [ ] **Step 1: gameData.test.js를 3개 기준으로 먼저 수정한다**

`src/constants/gameData.test.js:22-33`를 다음으로 교체:

```js
  it('부동산은 3개이며 라벨/이미지/가격 키가 일치한다', () => {
    const keys = Object.keys(REAL_ESTATE_LABELS)
    expect(keys).toHaveLength(3)
    expect(Object.keys(ESTATE_IMAGES)).toEqual(keys)
    expect(Object.keys(ESTATE_PRICES)).toEqual(keys)
  })

  it('주식은 3개이며 라벨/이미지 키가 일치한다', () => {
    const keys = Object.keys(STOCK_LABELS)
    expect(keys).toHaveLength(3)
    expect(Object.keys(STOCK_IMAGES)).toEqual(keys)
  })
```

- [ ] **Step 2: 나머지 소비 테스트도 새 라벨/키 기준으로 수정한다**

`src/components/AssetListEditor.test.jsx:21`의 `'단독 가온개미'`를 `'단독주택'`으로 바꾼다:

```jsx
    expect(screen.getByText('단독주택')).toBeInTheDocument()
```

`src/components/admin/RealEstateEditModal.test.jsx` 전체를 `nuri`(삭제 예정) 대신 유지되는 `dami`를 쓰도록 교체:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RealEstateEditModal from './RealEstateEditModal'

const VALUES = { gaon: 1, dami: 0, chorong: 0 }

describe('RealEstateEditModal', () => {
  it('수량 입력 후 확인 클릭 시 onChange를 병합된 부동산 객체로 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={onChange} onClose={onClose} />)
    const input = screen.getByLabelText('빌라 수량')
    await userEvent.clear(input)
    await userEvent.type(input, '3')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('확인'))
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, dami: 3 })
    expect(onClose).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<RealEstateEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
```

`src/components/admin/AdminAssetSummary.test.jsx:20`의 `'단독 가온개미2개'`를 `'단독주택2개'`로 바꾼다:

```jsx
    expect(screen.getByTestId('t-estate-gaon')).toHaveTextContent('단독주택2개')
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/constants/gameData.test.js src/components/AssetListEditor.test.jsx src/components/admin/RealEstateEditModal.test.jsx src/components/admin/AdminAssetSummary.test.jsx`
Expected: FAIL (gameData.js가 아직 6개 종목을 가짐, `RealEstateEditModal`도 `nuri`가 여전히 렌더됨)

- [ ] **Step 4: gameData.js에서 주식/부동산을 3종으로 축소한다**

`src/constants/gameData.js:23-43`를 다음으로 교체:

```js
export const REAL_ESTATE_LABELS = {
  gaon: '단독주택', dami: '빌라', chorong: '아파트',
}
export const ESTATE_IMAGES = {
  gaon: '가온개미', dami: '다미원숭이', chorong: '초롱부엉이',
}
export const ESTATE_PRICES = {
  gaon: '2만원', dami: '7만원', chorong: '10만원',
}

export const STOCK_LABELS = {
  semiconductor: '반도체', finance: '금융', bio: '바이오',
}
export const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', bio: '바이오헬스케어',
}
```

(`nuri`/`maru`/`hani`, `industrial`/`auto`/`content` 키는 상수에서 제거된다. `game_results.stock_holdings`/`real_estate_holdings` DB 컬럼은 그대로 6종 키를 유지하므로 과거 데이터는 손실되지 않는다 — 화면에 쓰이는 이 상수 파일에서만 3종으로 줄인다.)

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/constants/gameData.test.js src/components/AssetListEditor.test.jsx src/components/admin/RealEstateEditModal.test.jsx src/components/admin/AdminAssetSummary.test.jsx src/components/admin/StockEditModal.test.jsx src/components/admin/AdminEditModal.test.jsx src/components/admin/AdminPlayerCard.test.jsx src/components/admin/PlayerAssetReceipt.test.jsx`
Expected: PASS (뒤의 네 파일은 이미 유지되는 키만 사용해서 수정 없이도 통과해야 한다 — 회귀 확인용)

- [ ] **Step 6: 커밋**

```bash
git add src/constants/gameData.js src/constants/gameData.test.js src/components/AssetListEditor.test.jsx src/components/admin/RealEstateEditModal.test.jsx src/components/admin/AdminAssetSummary.test.jsx
git commit -m "$(cat <<'EOF'
feat: reduce stocks/real estate to 3 active types with new labels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 3: PriceSettingModal 라벨 중복 통합

**Files:**
- Modify: `src/components/PriceSettingModal.jsx`
- Modify: `src/components/PriceSettingModal.test.jsx:14,20,27,53`
- Modify: `src/components/admin/AdminPriceSettingModal.test.jsx:14,20,27,53`
- Modify: `src/components/admin/AdminGridCard.test.jsx:120,127,135,143,145,146,155`
- Modify: `src/components/admin/AdminSpectateModal.test.jsx:311`
- Modify: `src/pages/Team.test.jsx:240,247,258`

가격설정 화면(`PriceSettingModal.jsx`)은 지금까지 `gameData.js`와 다른 자체 라벨 상수를 갖고 있었다(`'반도체 IT'`, `'공동 가온개미'` 등, Task 2가 손대지 않은 영역). 이번 태스크에서 gameData를 유일한 출처로 통합한다.

- [ ] **Step 1: 가격설정 화면을 사용하는 모든 테스트를 새 라벨 기준으로 먼저 수정한다**

`src/components/PriceSettingModal.test.jsx`와 `src/components/admin/AdminPriceSettingModal.test.jsx`는 동일한 4곳을 고친다 (두 파일 모두):
- `'반도체 IT'` → `'반도체'` (일반 텍스트 검사 2곳, heading 검사 1곳 — 총 3곳)
- `'공동 가온개미'` → `'단독주택'` (2곳)

예: `PriceSettingModal.test.jsx`
```jsx
  it('기본으로 주식 목록이 보인다', () => {
    render(<PriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('반도체')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    render(<PriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('단독주택')).toBeInTheDocument()
  })

  it('가격 pill을 누르면 숫자 입력 팝업이 열리고, 확인하면 onConfirm에 갱신된 가격이 전달된다', async () => {
    const onConfirm = vi.fn()
    render(<PriceSettingModal prices={PRICES} onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체' })).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    await userEvent.click(screen.getByText('확인하기'))

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      stocks: expect.objectContaining({ semiconductor: 9000 }),
    }))
  })
```
```jsx
  it('initialCategory가 realEstate이면 부동산 목록을 먼저 보여준다', () => {
    render(<PriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} initialCategory="realEstate" />)
    expect(screen.getByText('단독주택')).toBeInTheDocument()
  })
```

이 파일의 나머지 두 테스트(`'초기화 버튼을 누르면...'`, `'뒤로 버튼을 누르면...'`)는 라벨 텍스트를 참조하지 않으므로 수정하지 않는다.

`AdminPriceSettingModal.test.jsx`도 위와 정확히 같은 구조로, `'반도체 IT'`→`'반도체'`, `'공동 가온개미'`→`'단독주택'` 4곳(첫 두 `it`의 `getByText`, 세 번째 `it`의 `getByRole('heading', ...)`, 다섯 번째 `it`의 `getByText`)을 고친다. 컴포넌트 이름만 `AdminPriceSettingModal`로 다르고 나머지 구조는 동일하다.

`src/components/admin/AdminGridCard.test.jsx:116-147`의 `'가격 탭'` describe 블록을 다음으로 교체:

```jsx
  describe('가격 탭', () => {
    it('주식 탭을 누르면 주식 가격 목록으로 바뀐다', async () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      await userEvent.click(screen.getByText('주식'))
      expect(screen.getByText('반도체')).toBeInTheDocument()
      expect(screen.getAllByText('2,000원').length).toBeGreaterThan(0)
    })

    it('부동산 탭을 누르면 부동산 가격 목록으로 바뀐다', async () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      await userEvent.click(screen.getByText('부동산'))
      expect(screen.getByText('단독주택')).toBeInTheDocument()
      expect(screen.getAllByText('10,000원').length).toBeGreaterThan(0)
    })

    it('주식 탭에서 카드를 클릭하면 onSpectate 대신 가격 설정 팝업이 열린다', async () => {
      const onSpectate = vi.fn()
      render(<AdminGridCard room={makeRoom()} onSpectate={onSpectate} />)
      await userEvent.click(screen.getByText('주식'))
      await userEvent.click(screen.getByText('반도체'))
      expect(onSpectate).not.toHaveBeenCalled()
      expect(screen.getByText('가격 설정')).toBeInTheDocument()
    })

    it('부동산 탭에서 카드를 클릭하면 부동산 카테고리가 선택된 가격 설정 팝업이 열린다', async () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      await userEvent.click(screen.getByText('부동산'))
      await userEvent.click(screen.getAllByText('단독주택')[0])
      expect(screen.getByText('가격 설정')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /10,000 원/ }).length).toBe(3)
      expect(screen.queryByText('반도체')).not.toBeInTheDocument()
    })
```

(뒤이은 `'가격 설정 팝업에서 확인하면...'` 테스트도 `'반도체 IT'`를 `'반도체'`로 바꾼다.)

`src/components/admin/AdminSpectateModal.test.jsx:311`의 `'반도체 IT'`를 `'반도체'`로 바꾼다.

`src/pages/Team.test.jsx:240,247,258`을 다음으로 바꾼다:

```jsx
  it('가격 설정 버튼을 누르면 팝업이 열리고 기본으로 주식 목록이 보인다', async () => {
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    expect(screen.getByText('반도체')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('단독주택')).toBeInTheDocument()
  })

  it('방장이 아닌 팀원이 가격을 바꿔도 update-room-prices를 emit한다', async () => {
    mockRoomUpdatePlayers = [
      { name: '영희', character: 'Guardian-판다', isHost: true, socketId: 's2' },
      { name: '철수', character: 'Adventurer-강아지', isHost: false, socketId: 's1' },
    ]
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체' })).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    await userEvent.click(screen.getByText('확인하기'))

    const socket = io()
    expect(socket.emit).toHaveBeenCalledWith('update-room-prices', {
      code: 'ABC123',
      prices: expect.objectContaining({
        stocks: expect.objectContaining({ semiconductor: 9000 }),
      }),
    })
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/components/PriceSettingModal.test.jsx src/components/admin/AdminPriceSettingModal.test.jsx src/components/admin/AdminGridCard.test.jsx src/components/admin/AdminSpectateModal.test.jsx src/pages/Team.test.jsx`
Expected: FAIL (`PriceSettingModal.jsx`가 아직 옛 자체 라벨을 사용 중)

- [ ] **Step 3: PriceSettingModal.jsx가 gameData를 import하도록 바꾼다**

`src/components/PriceSettingModal.jsx:1-37`(라벨/이미지/DEFAULT_PRICES 정의부 전체)을 다음으로 교체:

```jsx
import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import {
  MAX_ASSET_PRICE,
  STOCK_LABELS, STOCK_IMAGES,
  REAL_ESTATE_LABELS, ESTATE_IMAGES as REAL_ESTATE_IMAGES,
} from '../constants/gameData'
import styles from './PriceSettingModal.module.css'

export { STOCK_LABELS, STOCK_IMAGES, REAL_ESTATE_LABELS, REAL_ESTATE_IMAGES }

export const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
  realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
}
```

파일의 나머지(`export default function PriceSettingModal(...) { ... }`)는 그대로 둔다 — 이미 `STOCK_LABELS`/`REAL_ESTATE_LABELS`/`STOCK_IMAGES`/`REAL_ESTATE_IMAGES`/`DEFAULT_PRICES`라는 이름을 참조하므로 import 대상만 바뀌면 동작이 이어진다. `AdminGridCard.jsx`/`AdminPriceSettingModal.jsx`는 여전히 `'../PriceSettingModal'`에서 같은 이름을 import하므로 수정할 필요가 없다(재-export를 그대로 통과).

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/components/PriceSettingModal.test.jsx src/components/admin/AdminPriceSettingModal.test.jsx src/components/admin/AdminGridCard.test.jsx src/components/admin/AdminSpectateModal.test.jsx src/pages/Team.test.jsx`
Expected: PASS

- [ ] **Step 5: 전체 프런트엔드 테스트 스위트로 회귀를 확인한다**

Run: `npx vitest run`
Expected: PASS (서버 쪽 `db.test.js`는 아직 Task 4 이전이라 기존 그대로 PASS해야 한다)

- [ ] **Step 6: 커밋**

```bash
git add src/components/PriceSettingModal.jsx src/components/PriceSettingModal.test.jsx src/components/admin/AdminPriceSettingModal.test.jsx src/components/admin/AdminGridCard.test.jsx src/components/admin/AdminSpectateModal.test.jsx src/pages/Team.test.jsx
git commit -m "$(cat <<'EOF'
refactor: consolidate stock/real estate labels into gameData constants

PriceSettingModal previously kept its own duplicate label set that had
drifted from constants/gameData.js. Both now share one source so price
screens always reflect the current labels.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 4: 성공열쇠 배수 변경 + 활성 종목만 자산가치에 합산

**Files:**
- Modify: `server/db.js:1-18`
- Modify: `server/db.test.js:39-103`

- [ ] **Step 1: calculateAssetBreakdown 테스트를 새 배수표·활성종목 기준으로 먼저 수정한다**

`server/db.test.js:39-103`(`describe('calculateAssetBreakdown', ...)` 블록 전체)를 다음으로 교체:

```js
describe('calculateAssetBreakdown', () => {
  it('뱃지 0~2개면 base × 1.0을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000 })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(100000)
  })

  it('뱃지 3개면 base × 1.1을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, false, false, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(110000)
  })

  it('뱃지 4개면 base × 1.2를 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, false, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(120000)
  })

  it('뱃지 5개면 base × 1.5를 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, true, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(150000)
  })

  it('뱃지 6개면 base × 2.0을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, true, true] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(200000)
  })

  it('주식 보유량 × 가격을 stockValue로 반환하고 총자산에도 포함한다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(20000)
    expect(result.totalAssets).toBe(20000)
  })

  it('부동산 보유량 × 가격을 realEstateValue로 반환하고 총자산에도 포함한다', () => {
    const state = makeState({
      realEstate: { gaon: 3, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.realEstateValue).toBe(30000)
    expect(result.totalAssets).toBe(30000)
  })

  it('현금+주식+부동산을 합산해 총자산을 계산한다', () => {
    const state = makeState({
      cash: 50000,
      stocks: { semiconductor: 5, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.cash).toBe(50000)
    expect(result.stockValue).toBe(10000)
    expect(result.realEstateValue).toBe(10000)
    expect(result.totalAssets).toBe(70000)
  })

  it('삭제된 주식 종목(industrial/auto/content) 보유량은 stockValue/총자산에서 제외한다', () => {
    const state = makeState({
      stocks: { semiconductor: 0, finance: 0, industrial: 10, auto: 10, bio: 0, content: 10 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(0)
    expect(result.totalAssets).toBe(0)
  })

  it('삭제된 부동산 종목(nuri/maru/hani) 보유량은 realEstateValue/총자산에서 제외한다', () => {
    const state = makeState({
      realEstate: { gaon: 0, nuri: 5, dami: 0, maru: 5, chorong: 0, hani: 5 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.realEstateValue).toBe(0)
    expect(result.totalAssets).toBe(0)
  })

  it('stockValue와 realEstateValue에는 뱃지 배수가 적용되지 않는다(배수는 base 전체에 적용)', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [false, false, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(20000)
    expect(result.totalAssets).toBe(20000)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run server/db.test.js`
Expected: FAIL (기존 `badgeCount * 0.5` 공식과 `Object.keys(stocks)` 전체 합산 로직이 새 기대값과 다름)

- [ ] **Step 3: server/db.js의 calculateAssetBreakdown을 새 공식으로 교체한다**

`server/db.js:1-18`을 다음으로 교체:

```js
import { supabase } from './supabase.js'
import { UNASSIGNED_CLASS } from './classes.js'
import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../src/constants/gameData.js'

function badgeMultiplier(badgeCount) {
  if (badgeCount >= 6) return 2
  if (badgeCount === 5) return 1.5
  if (badgeCount === 4) return 1.2
  if (badgeCount === 3) return 1.1
  return 1
}

export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(STOCK_LABELS).reduce(
    (sum, key) => sum + (stocks[key] ?? 0) * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(REAL_ESTATE_LABELS).reduce(
    (sum, key) => sum + (realEstate[key] ?? 0) * (prices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  const totalAssets = baseAssets * badgeMultiplier(badgeCount)

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
```

(`STOCK_LABELS`/`REAL_ESTATE_LABELS`는 Task 2에서 이미 3개 키로 줄었으므로, 여기서 그 키만 합산하는 것으로 "활성 종목만 반영"이 된다. `gameData.js`는 React/브라우저 의존이 없는 순수 상수 파일이라 Node로 실행되는 서버 코드에서도 그대로 import할 수 있다.)

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run server/db.test.js`
Expected: PASS (`saveGameResult`/`updateGameResult`/`getRankings` 등 다른 describe 블록도 함께 통과해야 한다 — 회귀 확인)

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "$(cat <<'EOF'
feat: replace badge multiplier formula and exclude retired asset types

Multiplier changes from badgeCount*0.5 to a 0~2:x1 / 3:x1.1 / 4:x1.2 /
5:x1.5 / 6:x2 curve, and stock/real-estate value now sums only the
active 3 types per constants/gameData.js instead of every stored key.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 5: 기존 게임 결과 백필 스크립트

**Files:**
- Create: `scripts/backfill-asset-rebalance.js`

Task 4가 끝난 시점의 `calculateAssetBreakdown`(새 배수표 + 활성 종목만 합산)을 이용해 모든 `game_results` 행의 `stock_value`/`real_estate_value`/`total_assets`를 재계산한다. 이 저장소의 기존 관행(`scripts/backfill-holdings-cap.js`)과 동일하게 자동 테스트 없이 1회성으로 운영한다.

- [ ] **Step 1: 백필 스크립트를 작성한다**

`scripts/backfill-asset-rebalance.js` 신규 생성:

```js
import 'dotenv/config'
import { supabase } from '../server/supabase.js'
import { calculateAssetBreakdown } from '../server/db.js'

async function main() {
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('id, stock_prices, real_estate_prices')

  if (sessionsError) throw sessionsError

  const pricesBySessionId = new Map(
    sessions.map(s => [s.id, { stocks: s.stock_prices, realEstate: s.real_estate_prices }])
  )

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('id, session_id, cash, stock_holdings, real_estate_holdings, badges')

  if (resultsError) throw resultsError

  let updatedCount = 0

  for (const row of results) {
    const prices = pricesBySessionId.get(row.session_id)
    if (!prices) {
      console.warn(`session ${row.session_id}의 가격 정보를 찾을 수 없어 건너뜁니다 (result id: ${row.id})`)
      continue
    }

    const breakdown = calculateAssetBreakdown(
      { cash: row.cash, stocks: row.stock_holdings, realEstate: row.real_estate_holdings, badges: row.badges },
      prices
    )

    const { error: updateError } = await supabase
      .from('game_results')
      .update({
        stock_value: breakdown.stockValue,
        real_estate_value: breakdown.realEstateValue,
        total_assets: breakdown.totalAssets,
      })
      .eq('id', row.id)

    if (updateError) {
      console.error(`result id ${row.id} 업데이트 실패:`, updateError.message)
      continue
    }

    updatedCount += 1
    console.log(`result id ${row.id} 재계산 완료 (total_assets=${breakdown.totalAssets})`)
  }

  console.log(`백필 완료: ${updatedCount}개 결과 수정 (전체 ${results.length}개 중)`)
}

main().catch(err => {
  console.error('백필 스크립트 실패:', err)
  process.exit(1)
})
```

- [ ] **Step 2: 문법 오류가 없는지 확인한다 (DB 접속 없이 정적 로드만 검증)**

Run: `node --check scripts/backfill-asset-rebalance.js`
Expected: 출력 없이 종료(exit code 0)

- [ ] **Step 3: 커밋**

```bash
git add scripts/backfill-asset-rebalance.js
git commit -m "$(cat <<'EOF'
feat: add one-off backfill script for rebalanced asset totals

Recomputes stock_value/real_estate_value/total_assets for every
game_results row using the updated calculateAssetBreakdown, so past
games reflect the new multiplier curve and the 3 active asset types.
Run manually after deploy: node scripts/backfill-asset-rebalance.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

> **배포 시 수동 실행 필요**: 이 스크립트는 자동으로 실행되지 않는다. Task 1~4가 배포된 뒤 운영 DB에 대해 `node scripts/backfill-asset-rebalance.js`를 한 번 실행해야 기존 게임 결과의 `total_assets`가 새 공식으로 반영된다.

---

### Task 6: 입력 컴포넌트 레이아웃 (넓을 때 1행3열 / 좁을 때 3행1열)

**Files:**
- Modify: `src/pages/IndividualPage.module.css:140-141`

- [ ] **Step 1: 좁은 화면 기준 컬럼 수를 3→1로 바꾼다**

`src/pages/IndividualPage.module.css:140-141`을 다음으로 교체:

```css
.assetListFill {
  grid-template-columns: repeat(1, minmax(0, 1fr));
```

(넓은 화면 규칙인 `@container (min-width: 540px) { .assetListFill { grid-template-columns: repeat(3, ...) } }`은 이미 3열이고 Task 2에서 종목이 3개로 줄었으므로 자동으로 1행 3열이 된다 — 수정 불필요.)

- [ ] **Step 2: 프런트엔드 테스트 스위트로 회귀를 확인한다**

Run: `npx vitest run src/pages/IndividualPage.test.jsx`
Expected: PASS (그리드 열 수를 검증하는 테스트는 없으므로 통과해야 한다 — CSS 전용 변경의 회귀 확인)

- [ ] **Step 3: 커밋**

```bash
git add src/pages/IndividualPage.module.css
git commit -m "$(cat <<'EOF'
fix: stack asset input cards in 1 column on narrow screens

Now that stock/real estate selection has 3 items instead of 6, the
narrow-viewport grid switches from 2 columns (3 rows) to 1 column
(3 rows), matching the wide-viewport 3-column row unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 7: 관리자 수업목록 최신순 정렬

**Files:**
- Modify: `server/classes.js:22-38`
- Modify: `server/classes.test.js:37-67`

- [ ] **Step 1: listClassesForAdmin 테스트를 최신순 기준으로 먼저 수정한다**

`server/classes.test.js:37-67`(`describe('listClassesForAdmin', ...)` 블록)을 다음으로 교체:

```js
describe('listClassesForAdmin', () => {
  it('is_super면 전체 수업 + 미배정 수업 가상 항목을 생성일 최신순으로 반환한다', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'class-1', name: '3학년 2반', created_at: '2026-07-27T00:00:00.000Z' }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(classes).toEqual([
      { id: 'class-1', name: '3학년 2반', createdAt: '2026-07-27T00:00:00.000Z' },
      { id: 'unassigned', name: UNASSIGNED_CLASS },
    ])
  })

  it('일반 관리자는 admin_class_access로 연결된 수업을 생성일 최신순으로 반환한다', async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        { classes: { id: 'class-1', name: '오래된 수업', created_at: '2026-07-01T00:00:00.000Z' } },
        { classes: { id: 'class-2', name: '최근 수업', created_at: '2026-08-01T00:00:00.000Z' } },
      ],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: false })

    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(classes).toEqual([
      { id: 'class-2', name: '최근 수업', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'class-1', name: '오래된 수업', createdAt: '2026-07-01T00:00:00.000Z' },
    ])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run server/classes.test.js`
Expected: FAIL (슈퍼관리자 쿼리는 여전히 `.order('name')`, 일반관리자는 정렬 없음이라 두 번째 테스트에서 반환 순서가 입력 순서 그대로임)

- [ ] **Step 3: server/classes.js의 listClassesForAdmin을 최신순으로 바꾼다**

`server/classes.js:22-38`을 다음으로 교체:

```js
export async function listClassesForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return [
      ...data.map(cls => ({ id: cls.id, name: cls.name, createdAt: cls.created_at })),
      { id: 'unassigned', name: UNASSIGNED_CLASS },
    ]
  }

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('classes(id, name, created_at)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data
    .map(row => ({ id: row.classes.id, name: row.classes.name, createdAt: row.classes.created_at }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
```

(`'unassigned'` 가상 항목은 실제 DB 레코드가 아니므로 정렬 대상에서 제외하고 배열 맨 끝에 그대로 고정한다.)

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run server/classes.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/classes.js server/classes.test.js
git commit -m "$(cat <<'EOF'
feat: sort admin class list by creation date, newest first

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 8: ConfirmDialog에 hideCancel 옵션 추가

**Files:**
- Modify: `src/components/admin/ConfirmDialog.jsx`
- Modify: `src/components/admin/ConfirmDialog.test.jsx`

빈 이름 경고는 "취소/확인" 선택이 아니라 단순 알림이므로, 기존 `ConfirmDialog`에 취소 버튼을 숨기는 옵션을 추가해 재사용한다 (배경 클릭은 계속 `onCancel`을 호출해 닫히게 둔다).

- [ ] **Step 1: hideCancel 동작 테스트를 먼저 추가한다**

`src/components/admin/ConfirmDialog.test.jsx`의 `describe` 블록 안, 마지막 `it` 뒤에 추가:

```jsx
  it('hideCancel이 true이면 취소 버튼을 숨긴다', () => {
    render(
      <ConfirmDialog
        title="알림"
        description="수업 이름을 입력해주세요"
        confirmLabel="확인"
        hideCancel
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.queryByText('아니요')).not.toBeInTheDocument()
    expect(screen.getByText('확인')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/components/admin/ConfirmDialog.test.jsx`
Expected: FAIL (`hideCancel` prop이 아직 없어 취소 버튼 `'아니요'`가 항상 렌더됨)

- [ ] **Step 3: ConfirmDialog.jsx에 hideCancel prop을 추가한다**

`src/components/admin/ConfirmDialog.jsx:16-46`을 다음으로 교체:

```jsx
export default function ConfirmDialog({
  tone = 'danger',
  title,
  description,
  cancelLabel = '아니요',
  confirmLabel = '예',
  hideCancel = false,
  onCancel,
  onConfirm,
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={`${styles.iconBadge} ${tone === 'danger' ? styles.iconBadgeDanger : styles.iconBadgePrimary}`}>
          {ICONS[tone]}
        </div>
        <div className={styles.textGroup}>
          <span className={styles.title}>{title}</span>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.actions}>
          {!hideCancel && (
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          )}
          <button
            type="button"
            className={`${styles.confirmBtn} ${tone === 'danger' ? styles.confirmBtnDanger : styles.confirmBtnPrimary}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/components/admin/ConfirmDialog.test.jsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/ConfirmDialog.jsx src/components/admin/ConfirmDialog.test.jsx
git commit -m "$(cat <<'EOF'
feat: add hideCancel option to ConfirmDialog for alert-style popups

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

### Task 9: 수업 생성 시 빈 이름 경고 팝업

**Files:**
- Modify: `src/pages/AdminClassList.jsx`
- Modify: `src/pages/AdminClassList.test.jsx`

**Files 확인**: `src/pages/AdminClassList.jsx:29-45`의 현재 `handleCreateClass`는 `if (!newClassName.trim()) return`로 조용히 아무 반응도 하지 않는다.

- [ ] **Step 1: 빈 이름 경고 테스트를 먼저 추가한다**

`src/pages/AdminClassList.test.jsx`의 `describe('AdminClassList', ...)` 블록 안, 마지막 `it` 뒤에 추가:

```jsx
  it('빈 이름으로 수업 생성하기를 누르면 경고 팝업을 보여주고 API를 호출하지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    global.fetch.mockClear()

    await userEvent.click(screen.getByText('수업 생성하기'))

    expect(screen.getByText('수업 이름을 입력해주세요')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('확인'))
    expect(screen.queryByText('수업 이름을 입력해주세요')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/pages/AdminClassList.test.jsx`
Expected: FAIL (`'수업 이름을 입력해주세요'` 텍스트가 렌더되지 않음)

- [ ] **Step 3: AdminClassList.jsx에 경고 팝업을 추가한다**

`src/pages/AdminClassList.jsx:1-5`의 import에 `ConfirmDialog`는 이미 있으므로 상태와 핸들러만 추가한다. `src/pages/AdminClassList.jsx:11-16`을 다음으로 교체:

```jsx
export default function AdminClassList({ profile, onSelectClass, onLogout }) {
  const [classes, setClasses] = useState([])
  const [newClassName, setNewClassName] = useState('')
  const [error, setError] = useState('')
  const [qrClass, setQrClass] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showEmptyNameWarning, setShowEmptyNameWarning] = useState(false)
```

`src/pages/AdminClassList.jsx:29-32`(`handleCreateClass` 앞부분)을 다음으로 교체:

```jsx
  async function handleCreateClass(e) {
    e.preventDefault()
    if (!newClassName.trim()) {
      setShowEmptyNameWarning(true)
      return
    }
```

`src/pages/AdminClassList.jsx`의 `{deleteTarget && (...)}` 블록(파일 끝부분) 뒤에 추가:

```jsx
      {showEmptyNameWarning && (
        <ConfirmDialog
          tone="primary"
          title="알림"
          description="수업 이름을 입력해주세요"
          confirmLabel="확인"
          hideCancel
          onCancel={() => setShowEmptyNameWarning(false)}
          onConfirm={() => setShowEmptyNameWarning(false)}
        />
      )}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/pages/AdminClassList.test.jsx`
Expected: PASS

- [ ] **Step 5: 전체 테스트 스위트로 최종 회귀를 확인한다**

Run: `npx vitest run`
Expected: PASS (모든 태스크 완료 후 전체 스위트 그린)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/AdminClassList.jsx src/pages/AdminClassList.test.jsx
git commit -m "$(cat <<'EOF'
feat: warn when creating a class with an empty name

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019EMwRy1CDPUwoDpXyACXtM
EOF
)"
```

---

## 최종 체크리스트

- [ ] `npx vitest run` 전체 그린
- [ ] `docs/superpowers/specs/2026-09-17-asset-rebalance-design.md`의 목표 1~6 모두 코드에 반영됨
- [ ] 배포 후 `node scripts/backfill-asset-rebalance.js` 수동 실행 (Task 5 참고)
