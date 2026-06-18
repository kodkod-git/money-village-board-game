# Price Setting Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-only "가격 설정" button in the Lobby that opens a two-step modal for setting stock (2,000–20,000원, step 2,000) and real estate (10,000–100,000원, step 10,000) prices per category, stored at room level on the server and broadcast via socket.

**Architecture:** Room object gains a `prices` field initialized with minimum values. A new `update-room-prices` socket event updates and broadcasts it as `room-prices-updated`. Lobby.jsx adds a `PriceSettingModal` component following the same overlay/popup pattern as IndividualPage.jsx — step 1 selects category (주식/부동산), step 2 adjusts 6 prices with −/+ buttons.

**Tech Stack:** Node.js/Express, Socket.IO, React, CSS Modules, Vitest

---

### Task 1: Add `prices` to `server/rooms.js`

**Files:**
- Modify: `server/rooms.js`
- Modify: `server/rooms.test.js`

- [ ] **Step 1: Add failing tests**

Update the import in `server/rooms.test.js` to include `updateRoomPrices`:

```js
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices
} from './rooms.js'
```

Add these two describe blocks at the bottom of `server/rooms.test.js`:

```js
describe('createRoom prices', () => {
  it('주식/부동산 기본 가격을 초기화한다', () => {
    const room = createRoom()
    expect(room.prices.stocks).toEqual({
      semiconductor: 2000, finance: 2000, industrial: 2000,
      auto: 2000, bio: 2000, content: 2000,
    })
    expect(room.prices.realEstate).toEqual({
      gaon: 10000, nuri: 10000, dami: 10000,
      maru: 10000, chorong: 10000, hani: 10000,
    })
  })
})

describe('updateRoomPrices', () => {
  it('방의 가격을 업데이트하고 방 객체를 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const newPrices = {
      stocks: { semiconductor: 4000, finance: 6000, industrial: 2000, auto: 8000, bio: 10000, content: 12000 },
      realEstate: { gaon: 20000, nuri: 30000, dami: 10000, maru: 40000, chorong: 50000, hani: 60000 },
    }
    const room = updateRoomPrices('s1', newPrices)
    expect(room).not.toBeNull()
    expect(room.prices).toEqual(newPrices)
  })

  it('존재하지 않는 socketId는 null을 반환한다', () => {
    expect(updateRoomPrices('unknown', {})).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --run
```
Expected: FAIL — `updateRoomPrices is not a function`, prices tests failing

- [ ] **Step 3: Implement in rooms.js**

Add `defaultPrices()` after `defaultGameState()` in `server/rooms.js`:

```js
function defaultPrices() {
  return {
    stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
    realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
  }
}
```

Update `createRoom()`:

```js
export function createRoom() {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const room = { code, createdAt: new Date(), players: [], prices: defaultPrices() }
  rooms.set(code, room)
  return room
}
```

Add `updateRoomPrices` before `clearRooms` in `server/rooms.js`:

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

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --run
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: add room-level prices and updateRoomPrices"
```

---

### Task 2: Update `server/index.js`

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Import updateRoomPrices**

Update the import line at the top of `server/index.js`:

```js
import { createRoom, getRoom, addPlayer, removePlayer, updatePlayerState, updateRoomPrices } from './rooms.js'
```

- [ ] **Step 2: Include prices in GET /api/rooms/:code response**

Find:
```js
res.json({ code: room.code, playerCount: room.players.length, players: room.players })
```
Replace with:
```js
res.json({ code: room.code, playerCount: room.players.length, players: room.players, prices: room.prices })
```

- [ ] **Step 3: Add update-room-prices socket event**

In the `io.on('connection', ...)` block, after the `update-player-state` handler, add:

```js
socket.on('update-room-prices', ({ code, prices }) => {
  const room = updateRoomPrices(socket.id, prices)
  if (room) io.to(room.code).emit('room-prices-updated', { prices: room.prices })
})
```

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: add update-room-prices socket event and prices in API response"
```

---

### Task 3: Update `src/pages/Lobby.jsx` and `src/pages/Lobby.module.css`

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Modify: `src/pages/Lobby.module.css`

- [ ] **Step 1: Add constants at the top of Lobby.jsx**

After the imports in `src/pages/Lobby.jsx`, add:

```js
const STOCK_LABELS = {
  semiconductor: '반도체·IT',
  finance: '금융',
  industrial: '산업재·기계',
  auto: '자동차·쇼핑',
  bio: '바이오·헬스케어',
  content: '콘텐츠·플랫폼',
}

const REAL_ESTATE_LABELS = {
  gaon: '단독 가온개미',
  nuri: '단독 누리고양이',
  dami: '다세대 다미원숭이',
  maru: '다세대 마루수리',
  chorong: '아파트 초롱부엉이',
  hani: '아파트 하늬여우',
}

const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}
```

- [ ] **Step 2: Add state and socket listener in Lobby component**

Inside `Lobby()`, after existing useState calls, add:

```js
const [prices, setPrices] = useState(DEFAULT_PRICES)
const [showPriceModal, setShowPriceModal] = useState(false)
```

Update the fetch `useEffect` to also load prices:

```js
useEffect(() => {
  fetch(`/api/rooms/${code}`)
    .then(r => r.json())
    .then(data => {
      if (data.players) setPlayers(data.players)
      if (data.prices) setPrices(data.prices)
    })
    .catch(() => {})
}, [code])
```

After the existing `room-updated` socket listener `useEffect`, add:

```js
useEffect(() => {
  if (!socket) return
  const handler = ({ prices }) => setPrices(prices)
  socket.on('room-prices-updated', handler)
  return () => socket.off('room-prices-updated', handler)
}, [socket])
```

- [ ] **Step 3: Add handlePriceConfirm and update bottomBar JSX**

Inside `Lobby()`, after `handleLeave`, add:

```js
function handlePriceConfirm(newPrices) {
  socket?.emit('update-room-prices', { code, prices: newPrices })
  setPrices(newPrices)
  setShowPriceModal(false)
}
```

Replace the existing `<div className={styles.bottomBar}>` block with:

```jsx
<div className={styles.bottomBar}>
  {isHost && (
    <button className={styles.priceBtn} onClick={() => setShowPriceModal(true)}>
      가격 설정
    </button>
  )}
  <button
    className={`${styles.registerBtn} ${allCompleted ? styles.registerBtnActive : ''}`}
    disabled={!allCompleted}
  >
    결과 등록하기
  </button>
</div>
```

Add the modal just before the closing `</div>` of the page (after `{showQR && ...}`):

```jsx
{showPriceModal && (
  <PriceSettingModal
    prices={prices}
    onConfirm={handlePriceConfirm}
    onClose={() => setShowPriceModal(false)}
  />
)}
```

- [ ] **Step 4: Add PriceSettingModal component at the bottom of Lobby.jsx**

```jsx
function PriceSettingModal({ prices, onConfirm, onClose }) {
  const [step, setStep] = useState('select')
  const [tempPrices, setTempPrices] = useState(prices)

  function adjust(category, key, delta) {
    const stepAmt = category === 'stocks' ? 2000 : 10000
    const min = category === 'stocks' ? 2000 : 10000
    const max = category === 'stocks' ? 20000 : 100000
    setTempPrices(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: Math.min(max, Math.max(min, prev[category][key] + delta * stepAmt)),
      },
    }))
  }

  if (step === 'select') {
    return (
      <div className={styles.overlay}>
        <div className={styles.popup}>
          <div className={styles.popupTitle}>💰 가격 설정</div>
          <div className={styles.categoryGrid}>
            <button className={styles.categoryCard} onClick={() => setStep('stocks')}>
              <span className={styles.categoryIcon}>📈</span>
              <span className={styles.categoryLabel}>주식</span>
            </button>
            <button className={styles.categoryCard} onClick={() => setStep('realEstate')}>
              <span className={styles.categoryIcon}>🏠</span>
              <span className={styles.categoryLabel}>부동산</span>
            </button>
          </div>
          <button className={styles.cancelBtn} onClick={onClose}>닫기</button>
        </div>
      </div>
    )
  }

  const isStocks = step === 'stocks'
  const category = isStocks ? 'stocks' : 'realEstate'
  const labels = isStocks ? STOCK_LABELS : REAL_ESTATE_LABELS

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>
          {isStocks ? '📈 주식 가격' : '🏠 부동산 가격'}
        </div>
        <div className={styles.quantityList}>
          {Object.keys(labels).map(key => (
            <div key={key} className={styles.quantityItem}>
              <span className={styles.quantityLabel}>{labels[key]}</span>
              <div className={styles.quantityControls}>
                <button className={styles.qtyBtn} onClick={() => adjust(category, key, -1)}>−</button>
                <span className={styles.priceDisplay}>
                  {tempPrices[category][key].toLocaleString()}원
                </span>
                <button className={styles.qtyBtn} onClick={() => adjust(category, key, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={() => setStep('select')}>← 뒤로</button>
          <button className={styles.confirmBtn} onClick={() => onConfirm(tempPrices)}>확인</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update Lobby.module.css**

Replace `.bottomBar`:

```css
.bottomBar {
  padding: 8px 20px 14px;
  flex-shrink: 0;
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
  display: flex;
  gap: 8px;
}
```

Replace `.registerBtn` (add `flex: 1`):

```css
.registerBtn {
  flex: 1;
  padding: clamp(7px, 1.2vw, 10px) clamp(16px, 2.5vw, 24px);
  border-radius: 8px;
  font-size: clamp(13px, 2vw, 16px);
  font-weight: bold;
  background: rgba(255,255,255,0.08);
  color: #444;
  cursor: not-allowed;
  transition: background 0.15s, color 0.15s;
}
```

Append new classes at the bottom of `src/pages/Lobby.module.css`:

```css
.priceBtn {
  padding: clamp(7px, 1.2vw, 10px) clamp(12px, 2vw, 18px);
  border-radius: 8px;
  font-size: clamp(13px, 2vw, 16px);
  font-weight: bold;
  background: #4caf50;
  color: white;
  cursor: pointer;
  box-shadow: 0 3px 0 #388e3c;
  white-space: nowrap;
  flex-shrink: 0;
}
.priceBtn:active {
  transform: translateY(2px);
  box-shadow: none;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.popup {
  background: #162236;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 16px;
  padding: 24px 20px;
  width: 100%;
  max-width: 340px;
  color: white;
}
.popupTitle {
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 20px;
  color: #90caf9;
}
.categoryGrid {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.categoryCard {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: background 0.15s;
}
.categoryCard:active {
  background: rgba(255,255,255,0.15);
}
.categoryIcon {
  font-size: 32px;
  line-height: 1;
}
.categoryLabel {
  font-size: 14px;
  font-weight: bold;
}
.quantityList {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
}
.quantityItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.quantityLabel {
  font-size: 13px;
  color: #bbb;
}
.quantityControls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.qtyBtn {
  width: 28px;
  height: 28px;
  border-radius: 14px;
  background: #1e88e5;
  color: white;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}
.priceDisplay {
  font-size: 14px;
  font-weight: bold;
  color: white;
  min-width: 80px;
  text-align: center;
}
.popupActions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.cancelBtn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255,255,255,0.08);
  color: #aaa;
  font-size: 14px;
}
.confirmBtn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  background: #1565c0;
  color: white;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 2px 0 #0d47a1;
}
```

- [ ] **Step 6: Run tests**

```
npm test -- --run
```
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.module.css
git commit -m "feat: add host-only price setting modal to Lobby"
```
