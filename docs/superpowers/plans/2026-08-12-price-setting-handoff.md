# 가격 설정 권한 이전(방장 → 관리자) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생(방장 포함) 화면에서 주식/부동산 가격 설정 기능을 완전히 제거하고, 관리자가 관전 화면(`AdminSpectateModal`)에서 가격을 설정할 수 있게 한다. 등록 완료된 방은 가격을 바꿀 수 없다.

**Architecture:** `Team.jsx`에 내부 정의된 `PriceSettingModal`을 `src/components/admin/PriceSettingModal.jsx`로 옮겨 관리자 화면에서 재사용한다. 학생 경로의 소켓 이벤트(`update-room-prices`)와 `updateRoomPrices()`를 제거하고, 신규 REST 라우트 `PATCH /api/admin/rooms/:code/prices`로 대체한다.

**Tech Stack:** Express, Socket.IO, React, Vitest, Testing Library

---

### Task 1: `PriceSettingModal`을 공용 컴포넌트로 분리

**Files:**
- Create: `src/components/admin/PriceSettingModal.jsx`
- Create: `src/components/admin/PriceSettingModal.module.css`
- Create: `src/components/admin/PriceSettingModal.test.jsx`
- Modify: `src/pages/Team.jsx`
- Modify: `src/pages/Team.module.css`

이 태스크는 순수 이동(동작 변경 없음)이므로, 먼저 새 위치에서 테스트를 통과시킨 뒤 `Team.jsx`에서 걷어낸다.

- [ ] **Step 1: 새 컴포넌트 파일에 대한 테스트 작성**

`src/components/admin/PriceSettingModal.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PriceSettingModal from './PriceSettingModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

describe('PriceSettingModal', () => {
  it('기본으로 주식 목록이 보인다', () => {
    render(<PriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('반도체 IT')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    render(<PriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
  })

  it('가격 pill을 누르면 숫자 입력 팝업이 열리고, 확인하면 onConfirm에 갱신된 가격이 전달된다', async () => {
    const onConfirm = vi.fn()
    render(<PriceSettingModal prices={PRICES} onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체 IT' })).toBeInTheDocument()

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

  it('초기화 버튼을 누르면 현재 탭의 가격이 기본값으로 되돌아간다', async () => {
    const customPrices = { ...PRICES, stocks: { ...PRICES.stocks, semiconductor: 5000 } }
    render(<PriceSettingModal prices={customPrices} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /5,000 원/ })).toBeInTheDocument()
    await userEvent.click(screen.getByText('초기화'))
    expect(screen.getByRole('button', { name: /2,000 원/ })).toBeInTheDocument()
  })

  it('뒤로 버튼을 누르면 onClose가 호출된다', async () => {
    const onClose = vi.fn()
    render(<PriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/PriceSettingModal.test.jsx`
Expected: FAIL — 모듈을 찾을 수 없음(`./PriceSettingModal`)

- [ ] **Step 3: `PriceSettingModal.jsx` 생성**

`Team.jsx`의 `STOCK_LABELS`/`REAL_ESTATE_LABELS`/`DEFAULT_PRICES`/`STOCK_IMAGES`/`REAL_ESTATE_IMAGES`와 `PriceSettingModal` 함수를 그대로 옮긴다(문구/동작 변경 없음):

```jsx
import { useState } from 'react'
import NumberInputModal from '../NumberInputModal'
import { MAX_ASSET_PRICE } from '../../constants/gameData'
import styles from './PriceSettingModal.module.css'

const STOCK_LABELS = {
  semiconductor: '반도체 IT',
  finance: '금융',
  industrial: '산업재·기계',
  auto: '소재·화학',
  bio: '바이오·헬스케어',
  content: '콘텐츠·소비재',
}

const REAL_ESTATE_LABELS = {
  gaon: '공동 가온개미',
  nuri: '공동 누리고양이',
  dami: '다세대 다미원숭이',
  maru: '다세대 마루수리',
  chorong: '아파트 초롱부엉이',
  hani: '아파트 하니여우',
}

export const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

const REAL_ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}

export default function PriceSettingModal({ prices, onConfirm, onClose }) {
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
          maxValue={MAX_ASSET_PRICE}
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

- [ ] **Step 4: `PriceSettingModal.module.css` 생성**

`Team.module.css`에서 `.overlay`, `.priceModal`, `.priceModalHeader`, `.priceBackBtn`, `.priceModalTitle`, `.priceResetBtn`, `.priceTabs`, `.priceTab`, `.priceTabActive`, `.priceList`, `.priceRow`, `.priceIcon`, `.priceInfo`, `.priceLabel`, `.priceUnit`, `.pricePill`, `.priceConfirmBtn` 규칙을 그대로 복사한다:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

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

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/PriceSettingModal.test.jsx`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/PriceSettingModal.jsx src/components/admin/PriceSettingModal.module.css src/components/admin/PriceSettingModal.test.jsx
git commit -m "feat: extract PriceSettingModal into a shared admin component"
```

---

### Task 2: 학생 화면(`Team.jsx`)에서 가격 설정 제거

**Files:**
- Modify: `src/pages/Team.jsx`
- Modify: `src/pages/Team.module.css`
- Modify: `src/pages/Team.test.jsx`

- [ ] **Step 1: 제거 대상 테스트부터 갱신**

`Team.test.jsx`에서:
1. `Team readOnly mode` describe 블록의 `'shows price setting action in readOnly mode'` 테스트를 삭제한다.
2. `Team price setting modal` describe 블록 전체(3개 테스트)를 삭제한다.
3. `Team readOnly mode` describe 블록 끝에 아래 테스트를 추가한다:

```js
  it('가격 설정 진입점이 더 이상 없다', () => {
    renderReadOnlyTeam()
    expect(screen.queryByText('가격 설정')).not.toBeInTheDocument()
  })
```

4. 최상위 `describe('Team', ...)` 블록에도 추가한다(학생 화면 전체에서 진입점이 없는지 별도 확인):

```js
  it('방장이어도 가격 설정 진입점이 없다', () => {
    renderTeam()
    expect(screen.queryByText('가격 설정')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/pages/Team.test.jsx -t "가격 설정 진입점"`
Expected: FAIL — 현재는 `가격 설정` 버튼이 존재함

- [ ] **Step 3: `Team.jsx`에서 가격 관련 코드 제거**

다음을 모두 제거한다:
- `STOCK_LABELS`, `REAL_ESTATE_LABELS`, `DEFAULT_PRICES`, `STOCK_IMAGES`, `REAL_ESTATE_IMAGES` 상수 선언.
- `import NumberInputModal ...`, `import { MAX_ASSET_PRICE } ...` (다른 곳에서 안 쓰면 제거).
- `const [prices, setPrices] = useState(...)`, `const [showPriceModal, setShowPriceModal] = useState(false)` 상태.
- `room-prices-updated` 소켓 리스너 `useEffect`.
- `handlePriceConfirm` 함수.
- `canManageRoom`/`isHost`에서 가격 버튼 렌더링에 쓰이던 부분 — `isHost`는 강퇴 로직(`onKick`)에 계속 쓰이므로 유지하되, `canManageRoom` 변수 자체는 가격 버튼에만 쓰였으므로 제거한다.
- JSX의 가격 설정 버튼(`<button className={styles.priceSettingBtn}>...`)과 `{canManageRoom && showPriceModal && <PriceSettingModal .../>}` 블록.
- 파일 하단의 `function PriceSettingModal(...) {...}` 전체 정의.

수정 후 `Team.jsx` 상단 import와 관련 부분은 다음과 같아야 한다:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import QRCodeImage from '../components/QRCodeImage'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Team.module.css'

export default function Team({ readOnly = false, mockRoom = null }) {
  const { code: routeCode } = useParams()
  const code = readOnly ? mockRoom.code : routeCode
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const [players, setPlayers] = useState(readOnly ? mockRoom.players : [])
  const [roomFetched, setRoomFetched] = useState(readOnly)
  const [showQR, setShowQR] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  useEffect(() => {
    if (readOnly) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.players) setPlayers(data.players)
      })
      .catch(() => {})
      .finally(() => setRoomFetched(true))
  }, [code, readOnly])
```

(이후 `join-room`/`rejoin`/`room-updated`/`game-submitted`/`you-were-kicked`/`room-closed` 관련 `useEffect`들은 그대로 유지 — 가격 관련 `useEffect`만 삭제한다.)

`handleConfirmLeave` 다음에 있던 `handlePriceConfirm` 함수를 삭제하고, 렌더링부는 다음과 같아야 한다:

```jsx
  const slots = Array.from({ length: 4 }, (_, i) => players[i] ?? null)
  const isHost = !readOnly && (players.find(p => p.socketId === socket?.id)?.isHost ?? false)
  const myPlayer = readOnly ? null : players.find(p => p.socketId === socket?.id)

  return (
    <div className={styles.page}>
      {!readOnly && <BackButton onClick={() => setShowLeaveConfirm(true)} />}

      <div className={styles.header}>
```

JSX 하단부(`{showQR && ...}` 이후):

```jsx
      {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
      {!readOnly && showLeaveConfirm && (
        <LeaveConfirmModal
          onConfirm={handleConfirmLeave}
          onClose={() => setShowLeaveConfirm(false)}
        />
      )}
    </div>
  )
}

function LeaveConfirmModal({ onConfirm, onClose }) {
```

(`LeaveConfirmModal` 함수 정의는 그대로 두고, 그 아래 `PriceSettingModal` 함수 정의 전체를 삭제한다 — 파일이 `LeaveConfirmModal`로 끝나야 한다.)

- [ ] **Step 4: `Team.module.css`에서 가격 관련 규칙 제거**

`.priceSettingBtn`, `.priceModal`, `.priceModalHeader`, `.priceBackBtn`, `.priceModalTitle`, `.priceResetBtn`, `.priceTabs`, `.priceTab`, `.priceTabActive`, `.priceList`, `.priceRow`, `.priceIcon`, `.priceInfo`, `.priceLabel`, `.priceUnit`, `.pricePill`, `.priceConfirmBtn` 규칙을 삭제한다(Task 1에서 `PriceSettingModal.module.css`로 이미 옮겨졌다). `.overlay`, `.popup`, `.popupTitle`, `.popupActions`, `.cancelBtn`, `.confirmBtn`, `.confirmText`는 `LeaveConfirmModal`이 계속 쓰므로 유지한다.

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/pages/Team.test.jsx`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/Team.jsx src/pages/Team.module.css src/pages/Team.test.jsx
git commit -m "feat: remove host price-setting entry point from student room screen"
```

---

### Task 3: 서버 — 학생 경로 소켓 이벤트 제거, 관리자 REST 라우트 추가

**Files:**
- Modify: `server/index.js`
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: `updateRoomPrices`에 등록 여부 관계없이 동작 확인(변경 없음 — 재사용 대상)**

`server/rooms.js`의 `updateRoomPrices(socketId, prices)`는 지금처럼 `socketId` 기반으로 동작하므로, 관리자 라우트에서는 `code` 기반으로 직접 가격을 바꾸는 새 함수가 필요하다. 기존 `updateRoomPrices`(학생 소켓 경로 전용)는 이번 태스크에서 제거한다.

- [ ] **Step 2: `updateRoomPricesByCode` 실패 테스트 작성**

`server/rooms.test.js`에서 `updateRoomPrices` import를 `updateRoomPricesByCode`로 바꾸고, 기존 `describe('updateRoomPrices', ...)` 블록을 찾아 다음으로 교체한다(기존 블록이 없다면 `updateRoomTitle` describe 근처에 추가):

```js
describe('updateRoomPricesByCode', () => {
  it('code로 방을 찾아 가격을 갱신한다', () => {
    const { code } = createRoom()
    const newPrices = {
      stocks: { semiconductor: 5000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
      realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
    }
    const room = updateRoomPricesByCode(code, newPrices)
    expect(room.prices).toEqual(newPrices)
    expect(getRoom(code).prices).toEqual(newPrices)
  })

  it('없는 코드면 null을 반환한다', () => {
    expect(updateRoomPricesByCode('XXXXXX', {})).toBeNull()
  })
})
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run: `npx vitest run server/rooms.test.js -t updateRoomPricesByCode`
Expected: FAIL — `updateRoomPricesByCode is not a function`

- [ ] **Step 4: `rooms.js`에서 `updateRoomPrices`를 `updateRoomPricesByCode`로 교체**

기존:

```js
export function updateRoomPrices(socketId, prices) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  room.prices = prices
  return room
}
```

교체 후:

```js
export function updateRoomPricesByCode(code, prices) {
  const room = rooms.get(code)
  if (!room) return null
  room.prices = prices
  return room
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (전체)

- [ ] **Step 6: `server/index.js` — import, 소켓 이벤트, 신규 라우트 갱신**

import 목록에서 `updateRoomPrices`를 `updateRoomPricesByCode`로 교체:

```js
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPricesByCode, updateRoomTitle, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder, listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid } from './rooms.js'
```

`socket.on('update-room-prices', ...)` 핸들러를 삭제한다(학생 경로 완전 제거):

```js
  socket.on('kick-player', ({ targetSocketId: tid }) => {
```
바로 위에 있던
```js
  socket.on('update-room-prices', ({ code, prices }) => {
    const room = updateRoomPrices(socket.id, prices)
    if (room) io.to(room.code).emit('room-prices-updated', { prices: room.prices })
  })

```
블록을 삭제.

`app.patch('/api/admin/rooms/:code', ...)` (Task 4 of the room-title plan에서 추가된 라우트) 바로 아래에 신규 라우트 추가:

```js
app.patch('/api/admin/rooms/:code/prices', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const { stocks, realEstate } = req.body ?? {}
  if (!stocks || !realEstate) return res.status(400).json({ error: 'stocks와 realEstate가 필요합니다' })

  const room = getRoom(code)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasClassAccess(req.admin, room.classId || 'unassigned'))) {
    return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
  }

  const updated = updateRoomPricesByCode(code, { stocks, realEstate })
  io.to(code).emit('room-prices-updated', { prices: updated.prices })
  res.json({ prices: updated.prices })
})
```

(등록 완료된 방은 `getRoom(code)`가 애초에 `null`을 반환한다 — 등록되면 `deleteRoomByCode`로 메모리에서 제거되기 때문. 그래서 별도의 `registered` 체크 없이 자연히 403이 아닌 404로 막힌다.)

- [ ] **Step 7: 수동 확인**

다른 `/api/admin/rooms/*` 라우트들과 동일 컨벤션으로 HTTP 단위 테스트는 생략하고 수동 확인한다:

Run: `npm run dev` 후
```bash
curl -X PATCH http://localhost:3001/api/admin/rooms/<live-room-code>/prices \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"stocks":{"semiconductor":5000,"finance":2000,"industrial":2000,"auto":2000,"bio":2000,"content":2000},"realEstate":{"gaon":10000,"nuri":10000,"dami":10000,"maru":10000,"chorong":10000,"hani":10000}}'
```
Expected: `{"prices":{...semiconductor:5000...}}` 응답. 등록 완료된 방(코드 재사용 불가)으로 같은 요청을 보내면 404.

- [ ] **Step 8: 커밋**

```bash
git add server/index.js server/rooms.js server/rooms.test.js
git commit -m "feat: replace student price-setting socket path with admin-only REST route"
```

---

### Task 4: `AdminSpectateModal`에 가격 설정 버튼 추가

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`
- Modify: `src/components/admin/AdminSpectateModal.module.css`
- Modify: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

`AdminSpectateModal.test.jsx`에 추가:

```js
it('등록 완료되지 않은 방에는 가격 설정 버튼을 보여준다', () => {
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
  expect(screen.getByText('가격 설정')).toBeInTheDocument()
})

it('등록 완료된 방에는 가격 설정 버튼을 보여주지 않는다', () => {
  const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
  render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
  expect(screen.queryByText('가격 설정')).not.toBeInTheDocument()
})

it('가격 설정 버튼 클릭 시 모달이 열리고, 확인하면 PATCH 요청 후 방을 새로고침한다', async () => {
  const onRoomChanged = vi.fn()
  global.fetch = vi.fn((_url, options) => {
    if (options?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ prices: PRICES }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })

  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={onRoomChanged} />)
  await userEvent.click(screen.getByText('가격 설정'))
  expect(screen.getByText('반도체 IT')).toBeInTheDocument()
  await userEvent.click(screen.getByText('확인하기'))

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/rooms/AB1234/prices',
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify(PRICES),
    })
  )
  expect(onRoomChanged).toHaveBeenCalled()
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx -t "가격 설정"`
Expected: FAIL — `가격 설정` 텍스트 없음

- [ ] **Step 3: `AdminSpectateModal.jsx`에 가격 설정 버튼/핸들러 추가**

import에 `PriceSettingModal` 추가:

```jsx
import PriceSettingModal from './PriceSettingModal'
```

상태 선언부에 추가:

```jsx
  const [showPriceModal, setShowPriceModal] = useState(false)
```

`handleKick` 근처에 추가:

```jsx
  async function handlePriceConfirm(newPrices) {
    const res = await adminFetch(`/api/admin/rooms/${room.code}/prices`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrices),
    })
    setShowPriceModal(false)
    if (!res.ok) return
    onRoomChanged?.()
  }
```

`.actions` 블록에 버튼 추가(`등록` 버튼보다 앞, `registered`가 아닐 때만):

```jsx
      <div className={styles.actions}>
        {!room.registered && (
          <button type="button" className={styles.priceBtn} onClick={() => setShowPriceModal(true)}>가격 설정</button>
        )}
        {room.status === 'completed-but-unregistered' && (
          <button type="button" className={styles.registerBtn} onClick={handleRegister}>결과 등록</button>
        )}
        <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
      </div>
```

컴포넌트 반환문 맨 끝(`{kickTarget && (...)}` 다음)에 추가:

```jsx
      {showPriceModal && (
        <PriceSettingModal
          prices={room.prices}
          onConfirm={handlePriceConfirm}
          onClose={() => setShowPriceModal(false)}
        />
      )}
```

- [ ] **Step 4: CSS 추가**

`AdminSpectateModal.module.css`의 `.registerBtn, .deleteBtn { ... }` 규칙을 다음으로 교체(같은 스타일을 `priceBtn`도 공유):

```css
.registerBtn,
.deleteBtn,
.priceBtn {
  flex: 1;
  max-width: 220px;
  height: 46px;
  border-radius: var(--r-sm);
  font-size: 14px;
  font-weight: 800;
}

.registerBtn { background: var(--ink); color: var(--white); }

.deleteBtn { background: var(--slot-empty); color: var(--red); }

.priceBtn { background: var(--slot-empty); color: var(--ink); border: 1px solid var(--line); }
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx
git commit -m "feat: let admins set stock/real-estate prices from the spectate screen"
```
