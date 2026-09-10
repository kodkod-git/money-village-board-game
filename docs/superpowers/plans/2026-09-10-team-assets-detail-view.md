# 팀원 자산 "자세히 보기" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 팀 현황 모달에 "자세히 보기" 버튼을 추가해, 팀원 전원의 자산 상세(직업/성공카드/현금/부동산/주식/총자산)를 영수증형 카드로 가로로 나란히 보여준다.

**Architecture:** `AdminEditModal` 내부의 `AssetSummaryList`를 공유 컴포넌트 `AdminAssetSummary`로 추출한다. 새 프레젠테이션 컴포넌트 `PlayerAssetReceipt`(1-column 카드)를 만들고, 이를 가로로 배치하는 전체 화면 오버레이 `AdminTeamAssetsModal`을 만든다. `AdminSpectateModal`에 `showDetail` 상태와 버튼을 추가해 이 오버레이를 연다. 서버/API 변경 없음.

**Tech Stack:** React 18 (함수형 컴포넌트, CSS Modules), Vitest + @testing-library/react + @testing-library/user-event. 테스트 실행: `npx vitest run <경로>`.

---

## File Structure

**신규**

| 파일 | 책임 |
| --- | --- |
| `src/components/admin/AdminAssetSummary.jsx` | 부동산/주식 보유 목록(아이콘·이름·수량 행, 없으면 "미보유") 렌더. `AdminEditModal`·`PlayerAssetReceipt` 공용. |
| `src/components/admin/AdminAssetSummary.module.css` | 위 컴포넌트 스타일 (`AdminEditModal.module.css`에서 이동). |
| `src/components/admin/AdminAssetSummary.test.jsx` | 보유/미보유 렌더 테스트. |
| `src/components/admin/PlayerAssetReceipt.jsx` | 참가자 1명의 자산 상세를 1-column 영수증 카드로 렌더. |
| `src/components/admin/PlayerAssetReceipt.module.css` | 영수증 카드 스타일. |
| `src/components/admin/PlayerAssetReceipt.test.jsx` | 값·빈 상태·총자산 테스트. |
| `src/components/admin/AdminTeamAssetsModal.jsx` | 전체 화면 오버레이. 팀원 카드를 가로 스트립으로 배치, 닫기(✕/오버레이/버튼/ESC). |
| `src/components/admin/AdminTeamAssetsModal.module.css` | 오버레이·패널·스트립 스타일. |
| `src/components/admin/AdminTeamAssetsModal.test.jsx` | 카드 개수·null 슬롯 제외·닫기·빈 상태 테스트. |

**수정**

| 파일 | 변경 |
| --- | --- |
| `src/components/admin/AdminEditModal.jsx` | 로컬 `AssetSummaryList` 제거 → `AdminAssetSummary` import. |
| `src/components/admin/AdminEditModal.module.css` | `.assetList/.assetRow/.assetIcon/.assetName/.assetAmount/.emptyAsset` 제거. |
| `src/components/admin/AdminSpectateModal.jsx` | `showDetail` 상태 + "자세히 보기" 버튼 + `AdminTeamAssetsModal` 렌더. |
| `src/components/admin/AdminSpectateModal.module.css` | `.detailBtn` 추가. |
| `src/components/admin/AdminSpectateModal.test.jsx` | "자세히 보기" 버튼/오픈 테스트 추가. |

---

## Task 1: `AdminAssetSummary` 공유 컴포넌트 추출

**Files:**
- Create: `src/components/admin/AdminAssetSummary.jsx`
- Create: `src/components/admin/AdminAssetSummary.module.css`
- Create: `src/components/admin/AdminAssetSummary.test.jsx`
- Modify: `src/components/admin/AdminEditModal.jsx` (line 1-40 영역, 15-40의 `AssetSummaryList` 제거 및 import 추가)
- Modify: `src/components/admin/AdminEditModal.module.css` (line 130-159의 6개 클래스 제거)

- [ ] **Step 1: `AdminAssetSummary.jsx` 생성 (현재 `AdminEditModal`의 `AssetSummaryList`를 그대로 옮김)**

```jsx
import styles from './AdminAssetSummary.module.css'

export default function AdminAssetSummary({ labels, images, values, folder, unit, testIdPrefix }) {
  const holdings = Object.keys(labels).filter(key => Number(values?.[key] ?? 0) > 0)

  if (holdings.length === 0) {
    return <span className={styles.emptyAsset}>미보유</span>
  }

  return (
    <div className={styles.assetList}>
      {holdings.map(key => {
        const amount = Number(values[key] ?? 0)
        return (
          <div key={key} className={styles.assetRow} data-testid={`${testIdPrefix}-${key}`}>
            <img
              src={`/badges/${folder}/${images[key]}.png`}
              alt={labels[key]}
              className={styles.assetIcon}
            />
            <span className={styles.assetName}>{labels[key]}</span>
            <span className={styles.assetAmount}>{amount}{unit}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: `AdminAssetSummary.module.css` 생성 (현재 `AdminEditModal.module.css` line 130-159를 그대로 옮김)**

```css
.assetList { display: flex; flex-direction: column; }

.assetRow {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--admin-border);
}

.assetRow:last-child { border-bottom: none; }

.assetIcon { width: 20px; height: 20px; object-fit: contain; }

.assetName {
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--admin-text);
}

.assetAmount {
  font-size: 14px;
  font-weight: 800;
  color: #374151;
  white-space: nowrap;
}

.emptyAsset { font-size: 14px; font-weight: 700; color: var(--admin-disabled); }
```

- [ ] **Step 3: `AdminAssetSummary.test.jsx` 생성 (실패하는 테스트 먼저)**

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminAssetSummary from './AdminAssetSummary'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES } from '../../constants/gameData'

const ZERO = { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('AdminAssetSummary', () => {
  it('보유한 항목만 아이콘·이름·수량으로 렌더한다', () => {
    render(
      <AdminAssetSummary
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        values={{ ...ZERO, gaon: 2 }}
        folder="estate"
        unit="개"
        testIdPrefix="t-estate"
      />
    )
    expect(screen.getByTestId('t-estate-gaon')).toHaveTextContent('단독 가온개미2개')
    expect(screen.queryByTestId('t-estate-nuri')).not.toBeInTheDocument()
  })

  it('보유 항목이 없으면 "미보유"를 렌더한다', () => {
    render(
      <AdminAssetSummary
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        values={ZERO}
        folder="estate"
        unit="개"
        testIdPrefix="t-estate"
      />
    )
    expect(screen.getByText('미보유')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/AdminAssetSummary.test.jsx`
Expected: FAIL — `Failed to resolve import "./AdminAssetSummary"` (Step 1-2 파일이 아직 저장 안 됐다면) 또는 PASS. 만약 Step 1-2를 먼저 저장했다면 이 테스트는 바로 PASS한다 — 그 경우 Step 4는 "PASS 확인"으로 간주하고 진행.

- [ ] **Step 5: `AdminEditModal.jsx` 수정 — 로컬 함수 제거 후 import로 교체**

`src/components/admin/AdminEditModal.jsx` 상단 import 블록에 추가 (line 13 `import styles from './AdminEditModal.module.css'` 아래):

```jsx
import AdminAssetSummary from './AdminAssetSummary'
```

line 15-40의 `function AssetSummaryList({ ... }) { ... }` 정의 **전체를 삭제**한다.

line 126-133, 145-152의 `<AssetSummaryList ... />` 2곳을 `<AdminAssetSummary ... />`로 이름만 바꾼다 (props 동일):

```jsx
              <AdminAssetSummary
                labels={REAL_ESTATE_LABELS}
                images={ESTATE_IMAGES}
                values={gameState.realEstate}
                folder="estate"
                unit="개"
                testIdPrefix="admin-real-estate-holding"
              />
```

```jsx
              <AdminAssetSummary
                labels={STOCK_LABELS}
                images={STOCK_IMAGES}
                values={gameState.stocks}
                folder="stock"
                unit="주"
                testIdPrefix="admin-stock-holding"
              />
```

- [ ] **Step 6: `AdminEditModal.module.css` 수정 — 이동한 6개 클래스 제거**

`src/components/admin/AdminEditModal.module.css`에서 다음 블록들을 삭제한다 (line 130-159 영역):
`.assetList`, `.assetRow`, `.assetRow:last-child`, `.assetIcon`, `.assetName`, `.assetAmount`, `.emptyAsset`.
`.footer` 이후 블록은 그대로 둔다.

- [ ] **Step 7: 회귀 테스트 — `AdminEditModal` 기존 테스트가 전부 통과하는지 확인**

Run: `npx vitest run src/components/admin/AdminEditModal.test.jsx src/components/admin/AdminAssetSummary.test.jsx`
Expected: PASS (AdminEditModal 10개 + AdminAssetSummary 2개 모두).
특히 `admin-real-estate-holding-gaon`(`1개`), `admin-stock-holding-semiconductor`(`2주`) 검증이 그대로 통과해야 한다.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/AdminAssetSummary.jsx src/components/admin/AdminAssetSummary.module.css src/components/admin/AdminAssetSummary.test.jsx src/components/admin/AdminEditModal.jsx src/components/admin/AdminEditModal.module.css
git commit -m "refactor: extract AssetSummaryList into shared AdminAssetSummary component"
```

---

## Task 2: `PlayerAssetReceipt` 카드 컴포넌트

**Files:**
- Create: `src/components/admin/PlayerAssetReceipt.jsx`
- Create: `src/components/admin/PlayerAssetReceipt.module.css`
- Create: `src/components/admin/PlayerAssetReceipt.test.jsx`

- [ ] **Step 1: `PlayerAssetReceipt.test.jsx` 생성 (실패하는 테스트 먼저)**

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerAssetReceipt from './PlayerAssetReceipt'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makePlayer(overrides = {}) {
  return {
    playerUuid: 'p1', name: '김민준', character: 'Innovator-사자',
    gameState: {
      cash: 125000, job: 'a', jobVisited: true,
      stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, false, false, false, false],
      ...overrides,
    },
  }
}

describe('PlayerAssetReceipt', () => {
  it('이름·직업·현금·보유 자산·총자산을 보여준다', () => {
    render(<PlayerAssetReceipt player={makePlayer()} prices={PRICES} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    // 직업은 헤더 부제와 직업 필드 두 곳
    expect(screen.getAllByText('경영·금융').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('125,000원')).toBeInTheDocument()
    expect(screen.getByTestId('receipt-p1-real-estate-gaon')).toHaveTextContent('1개')
    expect(screen.getByTestId('receipt-p1-stock-semiconductor')).toHaveTextContent('2주')
    // cash 125000 + stock 4000 + realEstate 10000 = 139000; badgeCount 1 → ×0.5 = 69,500원
    expect(screen.getByText('69,500원')).toBeInTheDocument()
  })

  it('보유·입력이 없으면 미보유/미입력/무직으로 표시한다', () => {
    const player = makePlayer({
      job: null, jobVisited: true,
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
    })
    render(<PlayerAssetReceipt player={player} prices={PRICES} />)
    expect(screen.getAllByText('미보유')).toHaveLength(2) // 부동산 + 주식
    expect(screen.getByText('미입력')).toBeInTheDocument() // 성공카드
    expect(screen.getAllByText('무직').length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/PlayerAssetReceipt.test.jsx`
Expected: FAIL — `Failed to resolve import "./PlayerAssetReceipt"`.

- [ ] **Step 3: `PlayerAssetReceipt.jsx` 구현**

```jsx
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import {
  JOB_LABELS, JOB_IMAGES, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../../constants/gameData'
import AdminAssetSummary from './AdminAssetSummary'
import styles from './PlayerAssetReceipt.module.css'

export default function PlayerAssetReceipt({ player, prices }) {
  const { gameState } = player
  const { totalAssets } = calculateAssetBreakdown(gameState, prices)
  const earnedBadges = BADGE_NAMES.filter((_, i) => gameState.badges[i])
  const jobText = gameState.job ? JOB_LABELS[gameState.job] : gameState.jobVisited ? '무직' : '직업 미입력'

  return (
    <div className={styles.receipt} data-testid={`asset-receipt-${player.playerUuid}`}>
      <div className={styles.header}>
        <img src={`/characters/${player.character}.png`} alt={player.character} className={styles.avatar} />
        <div className={styles.identity}>
          <span className={styles.name}>{player.name}</span>
          <span className={styles.jobSub}>{jobText}</span>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>직업</span>
        <span className={styles.fieldValue}>
          {gameState.job ? (
            <span className={styles.jobValueRow}>
              <img src={`/badges/job/${JOB_IMAGES[gameState.job]}.png`} alt="" className={styles.jobIcon} />
              <span>{JOB_LABELS[gameState.job]}</span>
            </span>
          ) : gameState.jobVisited ? '무직' : '미입력'}
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>성공카드</span>
        <div className={styles.chipRow}>
          {earnedBadges.length === 0 && <span className={styles.fieldValue}>미입력</span>}
          {earnedBadges.map(name => <span key={name} className={styles.chip}>{BADGE_LABELS[name]}</span>)}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>현금</span>
        <span className={styles.cashValue}>{(gameState.cash ?? 0).toLocaleString()}원</span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>부동산</span>
        <AdminAssetSummary
          labels={REAL_ESTATE_LABELS}
          images={ESTATE_IMAGES}
          values={gameState.realEstate}
          folder="estate"
          unit="개"
          testIdPrefix={`receipt-${player.playerUuid}-real-estate`}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>주식</span>
        <AdminAssetSummary
          labels={STOCK_LABELS}
          images={STOCK_IMAGES}
          values={gameState.stocks}
          folder="stock"
          unit="주"
          testIdPrefix={`receipt-${player.playerUuid}-stock`}
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLabel}>총 자산</span>
        <span className={styles.footerValue}>{totalAssets.toLocaleString()}원</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `PlayerAssetReceipt.module.css` 구현**

```css
.receipt {
  flex: 0 0 clamp(240px, 24vw, 300px);
  align-self: flex-start;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-r-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header { display: flex; align-items: center; gap: 10px; }

.avatar { width: 40px; height: 40px; object-fit: contain; flex-shrink: 0; }

.identity { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

.name { font-size: 15px; font-weight: 700; color: var(--admin-text); }

.jobSub { font-size: 12px; font-weight: 400; color: var(--admin-text-2); }

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--admin-icon-bg);
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-r-md);
  padding: 10px 12px;
}

.fieldLabel { font-size: 11px; font-weight: 400; color: var(--admin-disabled); }

.fieldValue { font-size: 15px; font-weight: 700; color: var(--admin-text); }

.cashValue { font-size: 18px; font-weight: 800; color: var(--admin-text); }

.jobValueRow { display: inline-flex; align-items: center; gap: 8px; }

.jobIcon { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; }

.chipRow { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  background: var(--admin-blue-tint);
  border: 1px solid var(--admin-blue-faint);
  border-radius: 20px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #2d7bef;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  border-top: 2px solid var(--admin-blue-faint);
  padding-top: 10px;
}

.footerLabel { font-size: 12px; font-weight: 700; color: var(--admin-disabled); }

.footerValue { font-size: 18px; font-weight: 900; color: var(--admin-text); }
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/PlayerAssetReceipt.test.jsx`
Expected: PASS (2개).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/PlayerAssetReceipt.jsx src/components/admin/PlayerAssetReceipt.module.css src/components/admin/PlayerAssetReceipt.test.jsx
git commit -m "feat: add PlayerAssetReceipt 1-column asset detail card"
```

---

## Task 3: `AdminTeamAssetsModal` 전체 화면 오버레이

**Files:**
- Create: `src/components/admin/AdminTeamAssetsModal.jsx`
- Create: `src/components/admin/AdminTeamAssetsModal.module.css`
- Create: `src/components/admin/AdminTeamAssetsModal.test.jsx`

- [ ] **Step 1: `AdminTeamAssetsModal.test.jsx` 생성 (실패하는 테스트 먼저)**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminTeamAssetsModal from './AdminTeamAssetsModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makePlayer(uuid, name) {
  return {
    playerUuid: uuid, name, character: 'Innovator-사자',
    gameState: {
      cash: 10000, job: 'a', jobVisited: true,
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, false, false, false, false],
    },
  }
}

function makeRoom(players) {
  return { code: 'AB1234', prices: PRICES, players }
}

describe('AdminTeamAssetsModal', () => {
  it('null이 아닌 팀원 수만큼 영수증 카드를 렌더한다', () => {
    const room = makeRoom([makePlayer('p1', '김민준'), null, makePlayer('p3', '이서연')])
    render(<AdminTeamAssetsModal room={room} prices={PRICES} teamLabel="1팀" onClose={vi.fn()} />)
    expect(screen.getByTestId('asset-receipt-p1')).toBeInTheDocument()
    expect(screen.getByTestId('asset-receipt-p3')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^asset-receipt-/)).toHaveLength(2)
  })

  it('팀 라벨을 제목에 보여준다', () => {
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="3팀" onClose={vi.fn()} />)
    expect(screen.getByText('3팀 · 팀원 자산 상세')).toBeInTheDocument()
  })

  it('팀원이 한 명도 없으면 빈 상태 문구를 보여준다', () => {
    render(<AdminTeamAssetsModal room={makeRoom([null, null])} prices={PRICES} teamLabel="1팀" onClose={vi.fn()} />)
    expect(screen.getByText('표시할 팀원이 없습니다')).toBeInTheDocument()
  })

  it('✕ 버튼으로 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '자세히 보기 닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('하단 닫기 버튼으로 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('오버레이 클릭·ESC로 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />
    )
    // 오버레이 노드에 직접 디스패치 (패널 stopPropagation과 무관하게 핸들러가 오버레이에 걸려 있음)
    fireEvent.click(container.firstChild)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('패널 내부 클릭은 onClose를 호출하지 않는다', async () => {
    const onClose = vi.fn()
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />)
    await userEvent.click(screen.getByText('1팀 · 팀원 자산 상세'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/AdminTeamAssetsModal.test.jsx`
Expected: FAIL — `Failed to resolve import "./AdminTeamAssetsModal"`.

- [ ] **Step 3: `AdminTeamAssetsModal.jsx` 구현**

```jsx
import { useEffect } from 'react'
import PlayerAssetReceipt from './PlayerAssetReceipt'
import styles from './AdminTeamAssetsModal.module.css'

export default function AdminTeamAssetsModal({ room, prices, teamLabel, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const players = (room.players ?? []).filter(Boolean)

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${teamLabel} 팀원 자산 상세`}
    >
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{teamLabel} · 팀원 자산 상세</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="자세히 보기 닫기">✕</button>
        </div>

        {players.length === 0 ? (
          <div className={styles.empty}>표시할 팀원이 없습니다</div>
        ) : (
          <div className={styles.strip}>
            {players.map(player => (
              <PlayerAssetReceipt key={player.playerUuid} player={player} prices={prices} />
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.footerCloseBtn} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `AdminTeamAssetsModal.module.css` 구현**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
  padding: 20px;
}

.panel {
  display: flex;
  flex-direction: column;
  width: min(1200px, 96vw);
  max-height: 92vh;
  background: var(--admin-bg);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(17, 24, 39, 0.28);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 22px;
  background: var(--admin-surface);
  border-bottom: 1px solid var(--admin-border);
  flex-shrink: 0;
}

.title { font-size: 16px; font-weight: 700; color: var(--admin-text); }

.closeBtn {
  width: 30px;
  height: 30px;
  border-radius: 15px;
  background: var(--admin-border);
  color: var(--admin-text-2);
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}

.strip {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: safe center;
  padding: 20px 22px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 22px;
  font-size: 14px;
  font-weight: 700;
  color: var(--admin-disabled);
}

.actions {
  display: flex;
  justify-content: center;
  padding: 14px;
  background: var(--admin-surface);
  border-top: 1px solid var(--admin-border);
  flex-shrink: 0;
}

.footerCloseBtn {
  height: 44px;
  padding: 0 28px;
  border-radius: 14px;
  background: var(--admin-surface);
  color: var(--admin-text);
  border: 1px solid var(--admin-border);
  font-size: 14px;
  font-weight: 700;
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/AdminTeamAssetsModal.test.jsx`
Expected: PASS (4개).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminTeamAssetsModal.jsx src/components/admin/AdminTeamAssetsModal.module.css src/components/admin/AdminTeamAssetsModal.test.jsx
git commit -m "feat: add AdminTeamAssetsModal full-screen team asset overview"
```

---

## Task 4: `AdminSpectateModal`에 "자세히 보기" 버튼 연결

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`
- Modify: `src/components/admin/AdminSpectateModal.module.css`
- Modify: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: `AdminSpectateModal.test.jsx`에 실패하는 테스트 추가**

파일 맨 아래(line 367 `})` 다음)에 추가:

```jsx
describe('자세히 보기', () => {
  it('라이브 룸(미등록)에 자세히 보기 버튼을 보여준다', () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
    expect(screen.getByText('자세히 보기')).toBeInTheDocument()
  })

  it('등록 완료된 팀에도 자세히 보기 버튼을 보여준다', () => {
    const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
    render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
    expect(screen.getByText('자세히 보기')).toBeInTheDocument()
  })

  it('자세히 보기 클릭 시 팀원 자산 상세 모달을 열고, 닫으면 팀 현황으로 돌아온다', async () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
    await userEvent.click(screen.getByText('자세히 보기'))
    expect(screen.getByText('1팀 · 팀원 자산 상세')).toBeInTheDocument()
    expect(screen.getByTestId('asset-receipt-AB1234-p1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '자세히 보기 닫기' }))
    expect(screen.queryByText('1팀 · 팀원 자산 상세')).not.toBeInTheDocument()
    expect(screen.getByText('1팀')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx -t "자세히 보기"`
Expected: FAIL — `Unable to find an element with the text: 자세히 보기`.

- [ ] **Step 3: `AdminSpectateModal.jsx` 구현 — import 추가**

line 5 `import ConfirmDialog from './ConfirmDialog'` 아래에 추가:

```jsx
import AdminTeamAssetsModal from './AdminTeamAssetsModal'
```

- [ ] **Step 4: `AdminSpectateModal.jsx` — `showDetail` 상태 추가**

line 20 `const [showPriceModal, setShowPriceModal] = useState(false)` 아래에 추가:

```jsx
  const [showDetail, setShowDetail] = useState(false)
```

- [ ] **Step 5: `AdminSpectateModal.jsx` — `.actions`에 버튼 추가**

현재 `.actions` 블록 (line 176-196). `삭제` 버튼(line 195) 바로 앞에 추가:

```jsx
        <button type="button" className={styles.detailBtn} onClick={() => setShowDetail(true)}>자세히 보기</button>
        <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
```

- [ ] **Step 6: `AdminSpectateModal.jsx` — 오버레이 렌더 추가**

`{showPriceModal && ( ... )}` 블록 (line 229-235) 다음, 컴포넌트 최상위 `</div>` (line 236) 앞에 추가:

```jsx
      {showDetail && (
        <AdminTeamAssetsModal
          room={room}
          prices={room.prices}
          teamLabel={room.title ?? `${index + 1}팀`}
          onClose={() => setShowDetail(false)}
        />
      )}
```

- [ ] **Step 7: `AdminSpectateModal.module.css` — `.detailBtn` 추가**

`.priceBtn` 규칙 (line 116) 다음에 추가. `.registerBtn, .deleteBtn, .priceBtn` 셀렉터 목록(line 95-97)에 `.detailBtn`도 넣어 공통 크기를 공유한다:

```css
.registerBtn,
.deleteBtn,
.priceBtn,
.detailBtn {
  height: 45px;
  padding: 0 24px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}
```

그리고 파일 끝에 추가:

```css
.detailBtn { background: var(--admin-blue-soft); color: var(--admin-blue); border: 1px solid var(--admin-blue-faint); }
```

- [ ] **Step 8: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (기존 + 신규 3개 모두). 기존 `'닫기 버튼을 렌더링하지 않는다'` 테스트는 `showDetail` 기본값이 `false`라 그대로 통과한다.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "feat: add 자세히 보기 button to open team asset overview"
```

---

## Task 5: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run`
Expected: PASS (전체 스위트). 실패가 있으면 해당 파일로 돌아가 수정.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 완료 (`vite build` 성공, dist 생성).

- [ ] **Step 3: 수동 확인 안내 (실행 환경이 있으면)**

`npm run dev` → 관리자 로그인 → 학급 대시보드 → 팀 카드 클릭 → 팀 현황 모달에서 "자세히 보기" 클릭.
확인 항목:
- 팀원 카드가 가로로 나란히, 4명이 가로 스크롤 없이 한 화면에 (넓은 창 기준).
- 각 카드가 1-column, 보유 자산 많은 사람이 더 큼.
- ✕ / 하단 닫기 / 바깥 클릭 / ESC로 닫히고 팀 현황으로 복귀.
- 빈 슬롯(대기중)은 카드로 안 나옴.

- [ ] **Step 4: (변경 있었으면) Commit**

```bash
git add -A
git commit -m "test: verify team asset detail view end-to-end"
```

---

## Self-Review 결과

- **Spec coverage:**
  - "자세히 보기" 버튼(삭제/결과 등록 옆, 항상 표시) → Task 4 Step 5, 7 + 테스트 Step 1.
  - 팀원 전원 자산 상세를 가로 배치 → Task 3 (`.strip` flex + `PlayerAssetReceipt`).
  - "수정" 모달과 동일 정보를 1-column 영수증으로 → Task 2 (`PlayerAssetReceipt`, `AdminAssetSummary` 재사용).
  - 최대 4명 가로 스크롤 없이 → Task 2 `.receipt` `flex: 0 0 clamp(240px, 24vw, 300px)` + Task 3 `.panel` `min(1200px, 96vw)`, 넘치면 `.strip { overflow: auto }`.
  - 자세히 보기일 때 화면 전체 확장, 닫으면 820px 팀 현황 복귀 → Task 3 `position: fixed` 오버레이 + Task 4 `showDetail` 토글.
  - 빈 슬롯 제외 → Task 3 `(room.players ?? []).filter(Boolean)` + 테스트.
  - 실시간 반영 → `room` prop을 그대로 넘기므로 `AdminSpectateModal`의 폴링 갱신이 카드에 전파됨(구조상 보장, 별도 코드 불필요).
  - `AdminEditModal` 리팩터링 회귀 방지 → Task 1 Step 7 기존 테스트 재실행.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "적절한 에러 처리" 류 문구 없음.
- **Type consistency:** `AdminAssetSummary` props(`labels/images/values/folder/unit/testIdPrefix`)가 Task 1·2에서 동일. `PlayerAssetReceipt` props(`player/prices`), `AdminTeamAssetsModal` props(`room/prices/teamLabel/onClose`)가 정의처와 호출처(Task 4 Step 6)에서 일치. `data-testid` 규칙 `asset-receipt-<uuid>`가 Task 2 정의와 Task 3·4 테스트에서 일치.
