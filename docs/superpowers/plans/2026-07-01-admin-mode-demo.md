# 관리자 모드 데모 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 소켓/DB 연동 없이, 목업 데이터로 관리자 모드(그리드 뷰 + 테이블 뷰)를 확인할 수 있는 프론트엔드 전용 데모를 만든다.

**Architecture:** `LandingPage`에 톱니바퀴 버튼을 추가해 `/admin` 라우트로 진입한다. `AdminDashboard` 페이지가 탭으로 `AdminGridView`/`AdminTableView`를 전환하며, 두 뷰 모두 `src/data/adminMockData.js`의 하드코딩된 방 목록을 사용한다. 자산 총액은 `server/db.js`의 계산식을 미러링한 `src/utils/calculateAssets.js`로 그때그때 계산한다. 그리드 뷰에서 진행중 방 카드를 클릭하면 기존 `Lobby.jsx`를 `readOnly`/`mockRoom` prop으로 재사용해 관전 팝업을 띄운다. 데스크탑 1280px 레이아웃을 위해 `AdminDashboard` 마운트 시 `document.body`에 `admin-mode` 클래스를 붙여, 앱 전역을 감싸는 휴대폰 프레임(`#root`의 `aspect-ratio`/`max-width:430px`)을 일시적으로 해제한다.

**Tech Stack:** React 18, react-router-dom 7, Vite, Vitest + Testing Library, CSS Modules.

---

### Spec 참고

- `docs/superpowers/specs/2026-07-01-admin-mode-design.md` (승인된 설계 문서)
- `proposal/20260701_admin_mode.md` (원본 제안서)

---

### Task 1: 자산 계산 유틸 (`calculateAssets.js`)

**Files:**
- Create: `src/utils/calculateAssets.js`
- Test: `src/utils/calculateAssets.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/utils/calculateAssets.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { calculateAssetBreakdown } from './calculateAssets'

const prices = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

describe('calculateAssetBreakdown', () => {
  it('현금, 주식, 부동산 평가액과 총자산을 계산한다', () => {
    const gameState = {
      cash: 10000,
      stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    }
    const result = calculateAssetBreakdown(gameState, prices)
    expect(result.cash).toBe(10000)
    expect(result.stockValue).toBe(4000)
    expect(result.realEstateValue).toBe(10000)
    expect(result.totalAssets).toBe(24000)
  })

  it('뱃지가 하나도 없으면 총자산은 0이다', () => {
    const gameState = {
      cash: 5000,
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
    }
    expect(calculateAssetBreakdown(gameState, prices).totalAssets).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/utils/calculateAssets.test.js`
Expected: FAIL — `Failed to resolve import "./calculateAssets"`

- [ ] **Step 3: 최소 구현 작성**

`src/utils/calculateAssets.js`:
```js
export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(stocks).reduce(
    (sum, key) => sum + stocks[key] * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(realEstate).reduce(
    (sum, key) => sum + realEstate[key] * (prices.realEstate[key] ?? 0), 0
  )
  const totalAssets = ((cash ?? 0) + stockValue + realEstateValue) * (badgeCount * 0.5)

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
```

이 공식은 `server/db.js`의 `calculateTotalAssets(gameState, prices)`와 동일하다. 서버 파일을 직접 import하지 않는 이유는 `server/db.js`가 `./supabase.js`를 최상단에서 import하고 있어, 그대로 가져오면 프론트 번들에 Supabase 클라이언트가 끼어들기 때문이다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/utils/calculateAssets.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/utils/calculateAssets.js src/utils/calculateAssets.test.js
git commit -m "feat: add calculateAssetBreakdown util for admin demo"
```

---

### Task 2: 목업 데이터 (`adminMockData.js`)

**Files:**
- Create: `src/data/adminMockData.js`
- Test: `src/data/adminMockData.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/data/adminMockData.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { ADMIN_MOCK_ROOMS } from './adminMockData'

describe('ADMIN_MOCK_ROOMS', () => {
  it('4개의 목업 방을 제공한다', () => {
    expect(ADMIN_MOCK_ROOMS).toHaveLength(4)
  })

  it('등록완료 방이 최소 1개 존재한다', () => {
    expect(ADMIN_MOCK_ROOMS.some(r => r.registered)).toBe(true)
  })

  it('진행중(미등록) 방이 최소 1개 존재한다', () => {
    expect(ADMIN_MOCK_ROOMS.some(r => !r.registered)).toBe(true)
  })

  it('등록완료 방의 모든 플레이어는 isCompleted가 true다', () => {
    const registeredRoom = ADMIN_MOCK_ROOMS.find(r => r.registered)
    expect(registeredRoom.players.every(p => p.gameState.isCompleted)).toBe(true)
  })

  it('각 방은 고유한 코드를 가진다', () => {
    const codes = ADMIN_MOCK_ROOMS.map(r => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/data/adminMockData.test.js`
Expected: FAIL — `Failed to resolve import "./adminMockData"`

- [ ] **Step 3: 목업 데이터 작성**

`src/data/adminMockData.js`:
```js
export const ADMIN_MOCK_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function emptyGameState() {
  return {
    cash: null,
    job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    isCompleted: false,
  }
}

export const ADMIN_MOCK_ROOMS = [
  {
    code: 'AB1234',
    registered: false,
    prices: ADMIN_MOCK_PRICES,
    players: [],
  },
  {
    code: 'CD5678',
    registered: false,
    prices: ADMIN_MOCK_PRICES,
    players: [
      {
        playerUuid: 'mock-1', name: '홍길동', affiliation: '서울중', character: 'Adventurer-강아지', isHost: true,
        gameState: { ...emptyGameState(), job: 'a', cash: 15000 },
      },
      {
        playerUuid: 'mock-2', name: '김철수', affiliation: '서울중', character: 'Guardian-고양이', isHost: false,
        gameState: emptyGameState(),
      },
    ],
  },
  {
    code: 'EF9012',
    registered: false,
    prices: ADMIN_MOCK_PRICES,
    players: [
      {
        playerUuid: 'mock-3', name: '이영희', affiliation: '한빛중', character: 'Innovator-사자', isHost: true,
        gameState: { ...emptyGameState(), job: 'b', cash: 8000 },
      },
      {
        playerUuid: 'mock-4', name: '박민수', affiliation: '한빛중', character: 'Planner-수달', isHost: false,
        gameState: { ...emptyGameState(), job: 'c', cash: 12000 },
      },
      {
        playerUuid: 'mock-5', name: '정다은', affiliation: '한빛중', character: 'Guardian-펭귄', isHost: false,
        gameState: {
          ...emptyGameState(), job: 'd',
          stocks: { semiconductor: 1, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
        },
      },
      {
        playerUuid: 'mock-6', name: '최유진', affiliation: '한빛중', character: 'Adventurer-호랑이', isHost: false,
        gameState: emptyGameState(),
      },
    ],
  },
  {
    code: 'GH3456',
    registered: true,
    prices: ADMIN_MOCK_PRICES,
    players: [
      {
        playerUuid: 'mock-7', name: '오세훈', affiliation: '미래고', character: 'Innovator-돌고래', isHost: true,
        gameState: {
          job: 'a', cash: 32000,
          stocks: { semiconductor: 2, finance: 1, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, true, false, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'mock-8', name: '한소희', affiliation: '미래고', character: 'Planner-개미', isHost: false,
        gameState: {
          job: 'e', cash: 18000,
          stocks: { semiconductor: 0, finance: 0, industrial: 3, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 1, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [false, true, false, true, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'mock-9', name: '장하늘', affiliation: '미래고', character: 'Guardian-캥거루', isHost: false,
        gameState: {
          job: 'f', cash: 25000,
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 2, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 1, maru: 0, chorong: 0, hani: 0 },
          badges: [true, false, false, false, true, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'mock-10', name: '윤서준', affiliation: '미래고', character: 'Adventurer-원숭이', isHost: false,
        gameState: {
          job: 'b', cash: 9000,
          stocks: { semiconductor: 1, finance: 0, industrial: 0, auto: 0, bio: 1, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 1, hani: 0 },
          badges: [false, false, true, false, false, true],
          isCompleted: true,
        },
      },
    ],
  },
]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/data/adminMockData.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/data/adminMockData.js src/data/adminMockData.test.js
git commit -m "feat: add mock room data for admin demo"
```

---

### Task 3: `Lobby.jsx`에 관전(readOnly) 모드 추가

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Test: `src/pages/Lobby.test.jsx`

기존 `Lobby`는 `/lobby/:code` 라우트로만 쓰였다. `readOnly`/`mockRoom` prop을 추가해 소켓·fetch를 모두 건너뛰고, 전달받은 mock 데이터만으로 렌더링하며 액션 버튼을 숨기는 모드를 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/Lobby.test.jsx` 맨 아래에 추가 (기존 `describe('Lobby', ...)` 블록은 그대로 둔다):
```jsx
describe('Lobby readOnly mode', () => {
  const mockRoom = {
    code: 'ZZ9999',
    prices: {
      stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
      realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
    },
    players: [
      { playerUuid: 'p1', name: '민지', character: 'Guardian-판다', isHost: true, gameState: { isCompleted: true } },
    ],
  }

  function renderReadOnlyLobby() {
    return render(
      <SocketProvider>
        <MemoryRouter>
          <Lobby readOnly mockRoom={mockRoom} />
        </MemoryRouter>
      </SocketProvider>
    )
  }

  it('mockRoom의 팀 코드를 표시한다', () => {
    renderReadOnlyLobby()
    expect(screen.getByText('ZZ9999')).toBeInTheDocument()
  })

  it('mockRoom의 플레이어 이름을 표시한다', () => {
    renderReadOnlyLobby()
    expect(screen.getByText('민지')).toBeInTheDocument()
  })

  it('나가기 버튼을 렌더링하지 않는다', () => {
    renderReadOnlyLobby()
    expect(screen.queryByLabelText('팀 나가기')).toBeNull()
  })

  it('가격 설정, 결과 등록 버튼을 렌더링하지 않는다', () => {
    renderReadOnlyLobby()
    expect(screen.queryByText('가격 설정')).toBeNull()
    expect(screen.queryByText('결과 등록')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/pages/Lobby.test.jsx`
Expected: FAIL — `mockRoom.code` 관련 TypeError 또는 "ZZ9999" 텍스트를 찾지 못함 (컴포넌트가 아직 `readOnly`/`mockRoom` prop을 모름)

- [ ] **Step 3: `Lobby.jsx` 상단부(state·effect) 수정**

`src/pages/Lobby.jsx`의 `export default function Lobby() {` 부터 `handleLeave` 이전까지(원본 32~109줄)를 아래 내용으로 교체:
```jsx
export default function Lobby({ readOnly = false, mockRoom = null }) {
  const { code: routeCode } = useParams()
  const code = readOnly ? mockRoom.code : routeCode
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const [players, setPlayers] = useState(readOnly ? mockRoom.players : [])
  const [roomFetched, setRoomFetched] = useState(readOnly)
  const rejoinAttempted = useRef(false)
  const [showQR, setShowQR] = useState(false)
  const [prices, setPrices] = useState(readOnly ? mockRoom.prices : DEFAULT_PRICES)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    if (readOnly) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.players) setPlayers(data.players)
        if (data.prices) setPrices(data.prices)
      })
      .catch(() => {})
      .finally(() => setRoomFetched(true))
  }, [code, readOnly])

  useEffect(() => {
    if (readOnly) return
    if (!socket || !roomFetched || rejoinAttempted.current) return
    if (players.find(p => p.socketId === socket.id)) return

    const stored = JSON.parse(localStorage.getItem('player_profile') || 'null')
    const playerUuid = localStorage.getItem('player_uuid')
    if (!stored || stored.code !== code) return

    rejoinAttempted.current = true
    socket.emit('join-room', {
      code,
      name: stored.name,
      affiliation: stored.affiliation,
      character: stored.character,
      isHost: stored.isHost ?? false,
      playerUuid,
    }, ({ ok }) => {
      if (!ok) rejoinAttempted.current = false
    })
  }, [socket, roomFetched, players, code, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = ({ players }) => setPlayers(players)
    socket.on('room-updated', handler)
    return () => socket.off('room-updated', handler)
  }, [socket, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = ({ prices }) => setPrices(prices)
    socket.on('room-prices-updated', handler)
    return () => socket.off('room-prices-updated', handler)
  }, [socket, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = ({ sessionId }) => navigate(`/result/${sessionId}`)
    socket.on('game-submitted', handler)
    return () => socket.off('game-submitted', handler)
  }, [socket, navigate, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate, readOnly])
```

- [ ] **Step 4: 렌더링 계산부·JSX 수정**

같은 파일에서 `function handleLeave() {` 부터 파일 끝의 `Lobby` 함수 닫는 `}` 직전까지(원본 105~223줄, `ConfirmModal`/`PriceSettingModal` 함수 선언 이전까지)를 아래 내용으로 교체:
```jsx
  function handleLeave() {
    socket?.emit('leave-room')
    navigate('/')
  }

  function handlePriceConfirm(newPrices) {
    socket?.emit('update-room-prices', { code, prices: newPrices })
    setPrices(newPrices)
    setShowPriceModal(false)
  }

  async function handleSubmit() {
    setShowConfirmModal(false)
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/rooms/${code}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
    } catch (err) {
      alert(err.message)
      setIsSubmitting(false)
    }
  }

  const slots = Array.from({ length: 4 }, (_, i) => players[i] ?? null)
  const isHost = !readOnly && (players.find(p => p.socketId === socket?.id)?.isHost ?? false)
  const allCompleted = isHost && players.length > 0 && players.every(p => p.gameState?.isCompleted)
  const myPlayer = readOnly ? null : players.find(p => p.socketId === socket?.id)

  return (
    <div className={styles.page}>
      {!readOnly && <BackButton />}
      {!readOnly && (
        <button className={styles.leaveBtn} onClick={handleLeave} aria-label="팀 나가기">
          <img src="/icons/팀 나가기.png" alt="" className={styles.leaveIcon} />
          <span>팀 나가기</span>
        </button>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>팀 만들기</h1>
        <p className={styles.subtitle}>
          {readOnly ? '관전 모드입니다' : '코드를 팀원에게 공유하세요'}
        </p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.inviteGrid}>
        <div className={styles.codeCard}>
          <span className={styles.codeLabel}>팀 초대 코드</span>
          <div className={styles.codeRow}>
            <span className={styles.code}>{code}</span>
            {!readOnly && (
              <button
                className={styles.copyBtn}
                onClick={() => navigator.clipboard.writeText(code)}
                aria-label="코드 복사"
              >
                <img src="/icons/복사하기.png" alt="" className={styles.copyIcon} />
              </button>
            )}
          </div>
        </div>
        {!readOnly && (
          <button
            className={styles.qrCard}
            onClick={() => setShowQR(true)}
            type="button"
          >
            <span className={styles.codeLabel}>QR 코드</span>
            <img src={`/api/rooms/${code}/qr`} alt="QR 코드" className={styles.qrImg} />
          </button>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>팀원 현황</span>
        <div className={styles.slots}>
          {slots.map((player, i) => (
            <PlayerSlot
              key={i}
              player={player}
              onEdit={!readOnly && player && myPlayer ? () => navigate(`/lobby/${code}/individual`) : undefined}
              onKick={
                !readOnly && isHost && player && player.socketId !== socket?.id
                  ? () => socket?.emit('kick-player', { targetSocketId: player.socketId })
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className={styles.bottomBar}>
          {isHost && (
            <button className={styles.actionBtn} onClick={() => setShowPriceModal(true)}>
              가격 설정
            </button>
          )}
          {isHost && (
            <button
              className={`${styles.actionBtn} ${styles.submitBtn}`}
              onClick={() => setShowConfirmModal(true)}
              disabled={!allCompleted || isSubmitting}
            >
              {isSubmitting ? '제출 중...' : '결과 등록'}
            </button>
          )}
        </div>
      )}

      {!readOnly && showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
      {!readOnly && showConfirmModal && (
        <ConfirmModal
          onConfirm={handleSubmit}
          onClose={() => setShowConfirmModal(false)}
        />
      )}
      {!readOnly && showPriceModal && (
        <PriceSettingModal
          prices={prices}
          onConfirm={handlePriceConfirm}
          onClose={() => setShowPriceModal(false)}
        />
      )}
    </div>
  )
}
```

(파일 뒷부분의 `ConfirmModal`, `PriceSettingModal` 함수 선언부는 그대로 둔다.)

관전 모드에서는 QR 카드도 숨긴다 — `/api/rooms/:code/qr`는 실제 백엔드 엔드포인트라 mock 코드로는 유효한 이미지를 만들 수 없기 때문이다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/pages/Lobby.test.jsx`
Expected: PASS (기존 3개 + 신규 4개, 총 7 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.test.jsx
git commit -m "feat: add readOnly spectate mode to Lobby for admin demo"
```

---

### Task 4: 그리드 뷰 컴포넌트 (`AdminGridView`)

**Files:**
- Create: `src/components/admin/AdminGridView.jsx`
- Create: `src/components/admin/AdminGridView.module.css`
- Test: `src/components/admin/AdminGridView.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/admin/AdminGridView.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminGridView from './AdminGridView'

const rooms = [
  {
    code: 'AB1234', registered: false,
    players: [{ character: 'Adventurer-강아지', name: '홍길동' }],
  },
  {
    code: 'GH3456', registered: true,
    players: [
      { character: 'Innovator-돌고래', name: '오세훈' },
      { character: 'Planner-개미', name: '한소희' },
      { character: 'Guardian-캥거루', name: '장하늘' },
      { character: 'Adventurer-원숭이', name: '윤서준' },
    ],
  },
]

describe('AdminGridView', () => {
  it('각 방의 팀 코드를 표시한다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('AB1234')).toBeInTheDocument()
    expect(screen.getByText('GH3456')).toBeInTheDocument()
  })

  it('등록완료 방에는 "등록 완료" 배지를 표시한다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('등록 완료')).toBeInTheDocument()
  })

  it('진행중 방 카드를 클릭하면 onSpectate가 해당 방 데이터로 호출된다', async () => {
    const handleSpectate = vi.fn()
    render(<AdminGridView rooms={rooms} onSpectate={handleSpectate} />)
    await userEvent.click(screen.getByText('AB1234'))
    expect(handleSpectate).toHaveBeenCalledWith(rooms[0])
  })

  it('등록완료 방 카드는 클릭해도 onSpectate가 호출되지 않는다', async () => {
    const handleSpectate = vi.fn()
    render(<AdminGridView rooms={rooms} onSpectate={handleSpectate} />)
    await userEvent.click(screen.getByText('GH3456'))
    expect(handleSpectate).not.toHaveBeenCalled()
  })

  it('빈 슬롯은 물음표를 표시한다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.getAllByText('?')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/admin/AdminGridView.test.jsx`
Expected: FAIL — `Failed to resolve import "./AdminGridView"`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/admin/AdminGridView.jsx`:
```jsx
import styles from './AdminGridView.module.css'

export default function AdminGridView({ rooms, onSpectate }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => {
        const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)
        return (
          <button
            key={room.code}
            className={`${styles.card} ${room.registered ? styles.registered : ''}`}
            onClick={() => onSpectate(room)}
            disabled={room.registered}
            type="button"
          >
            <div className={styles.cardHeader}>
              <span className={styles.code}>{room.code}</span>
              {room.registered && <span className={styles.badge}>등록 완료</span>}
            </div>
            <div className={styles.slots}>
              {slots.map((player, i) => (
                <div key={i} className={styles.slot}>
                  {player ? (
                    <img
                      src={`/characters/${player.character}.png`}
                      alt={player.name}
                      className={styles.slotImg}
                    />
                  ) : (
                    <span className={styles.slotEmpty}>?</span>
                  )}
                </div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

`src/components/admin/AdminGridView.module.css`:
```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.card {
  background: var(--white);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--divider);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.card:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.cardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code {
  font-size: 16px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: 2px;
}

.badge {
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: var(--purple);
  border-radius: var(--r-pill);
  padding: 4px 10px;
}

.slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.slot {
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  background: var(--slot-empty);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slotImg {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.slotEmpty {
  font-size: 18px;
  font-weight: 400;
  color: var(--ghost);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/admin/AdminGridView.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/AdminGridView.jsx src/components/admin/AdminGridView.module.css src/components/admin/AdminGridView.test.jsx
git commit -m "feat: add AdminGridView component"
```

---

### Task 5: 테이블 뷰 컴포넌트 (`AdminTableView`)

**Files:**
- Create: `src/components/admin/AdminTableView.jsx`
- Create: `src/components/admin/AdminTableView.module.css`
- Test: `src/components/admin/AdminTableView.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/admin/AdminTableView.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminTableView from './AdminTableView'

const prices = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const rooms = [
  {
    code: 'GH3456',
    prices,
    players: [
      {
        playerUuid: 'p1', name: '오세훈', affiliation: '미래고',
        gameState: {
          job: 'a', cash: 32000,
          stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'p2', name: '한소희', affiliation: '미래고',
        gameState: {
          job: null, cash: null,
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [false, false, false, false, false, false],
          isCompleted: false,
        },
      },
    ],
  },
]

describe('AdminTableView', () => {
  it('완료된 플레이어의 자산을 계산해서 표시한다', () => {
    render(<AdminTableView rooms={rooms} />)
    expect(screen.getByText('오세훈')).toBeInTheDocument()
    expect(screen.getByText('32,000원')).toBeInTheDocument()
    expect(screen.getByText('10,000원')).toBeInTheDocument()
    expect(screen.getByText('4,000원')).toBeInTheDocument()
    expect(screen.getByText('46,000원')).toBeInTheDocument()
    expect(screen.getByText('입력완료')).toBeInTheDocument()
  })

  it('미입력 플레이어는 자산 컬럼에 -를 표시한다', () => {
    render(<AdminTableView rooms={rooms} />)
    expect(screen.getByText('한소희')).toBeInTheDocument()
    expect(screen.getByText('미입력')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/components/admin/AdminTableView.test.jsx`
Expected: FAIL — `Failed to resolve import "./AdminTableView"`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/admin/AdminTableView.jsx`:
```jsx
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import styles from './AdminTableView.module.css'

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}

function flattenRows(rooms) {
  return rooms.flatMap(room =>
    room.players.map(player => {
      const isCompleted = Boolean(player.gameState?.isCompleted)
      const breakdown = isCompleted
        ? calculateAssetBreakdown(player.gameState, room.prices)
        : null
      return {
        key: `${room.code}-${player.playerUuid}`,
        teamCode: room.code,
        name: player.name,
        affiliation: player.affiliation,
        job: isCompleted ? JOB_LABELS[player.gameState.job] : null,
        cash: breakdown?.cash ?? null,
        realEstateValue: breakdown?.realEstateValue ?? null,
        stockValue: breakdown?.stockValue ?? null,
        totalAssets: breakdown?.totalAssets ?? null,
        isCompleted,
      }
    })
  )
}

export default function AdminTableView({ rooms }) {
  const rows = flattenRows(rooms)
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>팀코드</th>
            <th className={styles.th}>이름</th>
            <th className={styles.th}>소속</th>
            <th className={styles.th}>직업</th>
            <th className={styles.th}>현금</th>
            <th className={styles.th}>부동산총액</th>
            <th className={styles.th}>주식총액</th>
            <th className={styles.th}>총자산</th>
            <th className={styles.th}>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className={styles.tr}>
              <td className={styles.td}>{row.teamCode}</td>
              <td className={styles.td}>{row.name}</td>
              <td className={styles.td}>{row.affiliation}</td>
              <td className={styles.td}>{row.job ?? '-'}</td>
              <td className={styles.td}>{row.cash != null ? `${row.cash.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.realEstateValue != null ? `${row.realEstateValue.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.stockValue != null ? `${row.stockValue.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.totalAssets != null ? `${row.totalAssets.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.isCompleted ? '입력완료' : '미입력'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`src/components/admin/AdminTableView.module.css`:
```css
.tableWrapper {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.th {
  padding: 10px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
  border-bottom: 1px solid var(--divider);
  white-space: nowrap;
}

.tr:hover {
  background: var(--slot-empty);
}

.td {
  padding: 10px 12px;
  font-size: 14px;
  color: var(--ink);
  border-bottom: 1px solid var(--divider);
  white-space: nowrap;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/components/admin/AdminTableView.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/admin/AdminTableView.jsx src/components/admin/AdminTableView.module.css src/components/admin/AdminTableView.test.jsx
git commit -m "feat: add AdminTableView component"
```

---

### Task 6: `AdminDashboard` 페이지 + 데스크탑 레이아웃 breakout

**Files:**
- Create: `src/pages/AdminDashboard.jsx`
- Create: `src/pages/AdminDashboard.module.css`
- Test: `src/pages/AdminDashboard.test.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/AdminDashboard.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

import { SocketProvider } from '../contexts/SocketContext'
import AdminDashboard from './AdminDashboard'

function renderDashboard() {
  return render(
    <SocketProvider>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </SocketProvider>
  )
}

afterEach(() => {
  document.body.classList.remove('admin-mode')
})

describe('AdminDashboard', () => {
  it('마운트되면 body에 admin-mode 클래스를 추가한다', () => {
    renderDashboard()
    expect(document.body.classList.contains('admin-mode')).toBe(true)
  })

  it('언마운트되면 body에서 admin-mode 클래스를 제거한다', () => {
    const { unmount } = renderDashboard()
    unmount()
    expect(document.body.classList.contains('admin-mode')).toBe(false)
  })

  it('기본적으로 그리드 뷰를 표시한다', () => {
    renderDashboard()
    expect(screen.getByText('AB1234')).toBeInTheDocument()
  })

  it('테이블 뷰 탭을 클릭하면 테이블이 표시된다', async () => {
    renderDashboard()
    await userEvent.click(screen.getByText('테이블 뷰'))
    expect(screen.getByText('팀코드')).toBeInTheDocument()
  })

  it('진행중 방 카드를 클릭하면 관전 팝업이 열린다', async () => {
    renderDashboard()
    await userEvent.click(screen.getByText('AB1234'))
    expect(screen.getByText('관전 모드입니다')).toBeInTheDocument()
  })

  it('팝업 닫기 버튼을 클릭하면 팝업이 사라진다', async () => {
    renderDashboard()
    await userEvent.click(screen.getByText('AB1234'))
    await userEvent.click(screen.getByLabelText('닫기'))
    expect(screen.queryByText('관전 모드입니다')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/pages/AdminDashboard.test.jsx`
Expected: FAIL — `Failed to resolve import "./AdminDashboard"`

- [ ] **Step 3: `AdminDashboard` 구현**

`src/pages/AdminDashboard.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import Lobby from './Lobby'
import { ADMIN_MOCK_ROOMS } from '../data/adminMockData'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰' },
  { key: 'table', label: '테이블 뷰' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('grid')
  const [spectatingRoom, setSpectatingRoom] = useState(null)

  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>관리자 모드</h1>
          <p className={styles.subtitle}>데모 버전 — 목업 데이터로 동작합니다</p>
        </div>
        <button className={styles.exitBtn} onClick={() => navigate('/')} type="button">
          ← 나가기
        </button>
      </div>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'grid' && (
        <AdminGridView rooms={ADMIN_MOCK_ROOMS} onSpectate={setSpectatingRoom} />
      )}
      {activeTab === 'table' && <AdminTableView rooms={ADMIN_MOCK_ROOMS} />}

      {spectatingRoom && (
        <div className={styles.overlay} onClick={() => setSpectatingRoom(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <button
              className={styles.closeBtn}
              onClick={() => setSpectatingRoom(null)}
              aria-label="닫기"
              type="button"
            >
              ×
            </button>
            <Lobby readOnly mockRoom={spectatingRoom} />
          </div>
        </div>
      )}
    </div>
  )
}
```

`src/pages/AdminDashboard.module.css`:
```css
.page {
  width: 100%;
  min-height: 100dvh;
  max-width: 1280px;
  margin: 0 auto;
  padding: 40px 32px 80px;
  background: var(--white);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.title {
  font-size: 30px;
  font-weight: 900;
  color: var(--ink);
}

.subtitle {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  margin-top: 4px;
}

.exitBtn {
  background: var(--slot-empty);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  height: 44px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--divider);
}

.tab {
  background: none;
  border: none;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-2);
  border-bottom: 2px solid transparent;
}

.tabActive {
  color: var(--purple);
  border-bottom-color: var(--purple);
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.popup {
  position: relative;
  background: var(--white);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  width: min(430px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
}

.closeBtn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--slot-empty);
  color: var(--ink-2);
  font-size: 18px;
  line-height: 1;
  z-index: 1;
}
```

- [ ] **Step 4: `index.css`에 휴대폰 프레임 breakout 스타일 추가**

`src/index.css` 파일 맨 끝(`button { cursor: pointer; border: none; }` 다음 줄)에 추가:
```css

body.admin-mode {
  padding: 0;
  align-items: stretch;
  justify-content: stretch;
}

body.admin-mode::before,
body.admin-mode::after {
  display: none;
}

body.admin-mode #root {
  width: 100vw;
  height: 100dvh;
  max-width: none;
  aspect-ratio: unset;
  border-radius: 0;
  box-shadow: none;
  overflow: auto;
}
```

`#root`는 평소 휴대폰 화면처럼 `max-width: 430px`, 고정 `aspect-ratio`로 잠겨 있다(`src/index.css:79-93`). `AdminDashboard`가 마운트되어 있는 동안만 `body.admin-mode`가 이 제약을 해제해 1280px 데스크탑 레이아웃을 온전히 보여준다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/pages/AdminDashboard.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/pages/AdminDashboard.jsx src/pages/AdminDashboard.module.css src/pages/AdminDashboard.test.jsx src/index.css
git commit -m "feat: add AdminDashboard page with desktop layout breakout"
```

---

### Task 7: `LandingPage`에 톱니바퀴 진입 버튼 추가

**Files:**
- Modify: `src/pages/LandingPage.jsx`
- Modify: `src/pages/LandingPage.module.css`
- Test: `src/pages/LandingPage.test.jsx` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/LandingPage.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('톱니바퀴 버튼 클릭 시 /admin으로 이동한다', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    await userEvent.click(screen.getByLabelText('관리자 모드'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/pages/LandingPage.test.jsx`
Expected: FAIL — `Unable to find a label with the text of: 관리자 모드`

- [ ] **Step 3: 톱니바퀴 버튼 추가**

`src/pages/LandingPage.jsx` 전체를 아래 내용으로 교체:
```jsx
import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <button
        className={styles.adminBtn}
        onClick={() => navigate('/admin')}
        aria-label="관리자 모드"
        type="button"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm8.94-3.5a7.97 7.97 0 0 0-.15-1.5l2.06-1.6-2-3.46-2.43.98a8.07 8.07 0 0 0-2.6-1.5L15.4 2h-4l-.42 2.42a8.07 8.07 0 0 0-2.6 1.5l-2.43-.98-2 3.46 2.06 1.6c-.1.49-.15.99-.15 1.5s.05 1.01.15 1.5l-2.06 1.6 2 3.46 2.43-.98c.77.63 1.65 1.15 2.6 1.5L11.4 22h4l.42-2.42c.95-.35 1.83-.87 2.6-1.5l2.43.98 2-3.46-2.06-1.6c.1-.49.15-.99.15-1.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <div className={styles.blob} />
      <div className={styles.center}>
        <div className={styles.iconBox}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path d="M8 28L32 8L56 28V56H40V40H24V56H8V28Z" fill="white" />
          </svg>
        </div>
        <h1 className={styles.title}>머니빌리지</h1>
        <p className={styles.subtitle}>게임 결과를 기록해요!</p>
      </div>
      <div className={styles.buttons}>
        <button className={styles.primaryBtn} onClick={() => navigate('/join')}>
          참여하기
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/ranking')}>
          랭킹 보기
        </button>
      </div>
      <footer className={styles.footer}>© 2026 머니빌리지</footer>
    </div>
  )
}
```

`src/pages/LandingPage.module.css`의 `.blob { ... }` 규칙 앞에 추가:
```css
.adminBtn {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/pages/LandingPage.test.jsx`
Expected: PASS (1 test)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/LandingPage.jsx src/pages/LandingPage.module.css src/pages/LandingPage.test.jsx
git commit -m "feat: add admin mode entry button to LandingPage"
```

---

### Task 8: `/admin` 라우트 등록

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/App.test.jsx`의 `describe('App routing', ...)` 블록 안, 기존 두 `it` 다음에 추가:
```jsx
  it('/admin 에서 관리자 대시보드를 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>)
    expect(screen.getByText('관리자 모드')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/App.test.jsx`
Expected: FAIL — "관리자 모드" 텍스트를 찾지 못함 (`/admin` 라우트가 아직 없어 빈 화면 렌더링)

- [ ] **Step 3: 라우트 추가**

`src/App.jsx`:
```jsx
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'
import Home from './pages/Home'
import IndividualPage from './pages/IndividualPage'
import RankingPage from './pages/RankingPage'
import ResultPage from './pages/ResultPage'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/lobby/:code" element={<Lobby />} />
      <Route path="/lobby/:code/individual" element={<IndividualPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/result/:sessionId" element={<RankingPage />} />
      <Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}
```

`App.test.jsx`는 `AdminDashboard`가 내부적으로 `useSocketContext`를 쓰는 `Lobby`를 렌더링하지 않는 한(그리드 뷰 기본 진입이므로 팝업을 열기 전까지는 렌더링되지 않음) 별도 `SocketProvider` 목킹 없이도 통과한다. 다만 `App.test.jsx`가 이미 실제 `main.jsx`처럼 `SocketProvider`로 감싸고 있지 않다면 아래 Step 3-1을 확인한다.

- [ ] **Step 3-1: `SocketProvider` 래핑 확인**

`src/App.test.jsx` 상단을 확인해 `SocketProvider`로 감싸져 있지 않다면, socket.io-client를 모킹하고 감싸도록 아래처럼 수정한다:
```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

import { SocketProvider } from './contexts/SocketContext'
import App from './App'

describe('App routing', () => {
  it('/ 에서 랜딩페이지를 렌더링한다', () => {
    render(
      <SocketProvider>
        <MemoryRouter initialEntries={['/']}><App /></MemoryRouter>
      </SocketProvider>
    )
    expect(screen.getByText('머니빌리지')).toBeInTheDocument()
  })

  it('/join 에서 이름 입력 필드를 렌더링한다', () => {
    render(
      <SocketProvider>
        <MemoryRouter initialEntries={['/join?code=ABC123']}><App /></MemoryRouter>
      </SocketProvider>
    )
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
  })

  it('/admin 에서 관리자 대시보드를 렌더링한다', () => {
    render(
      <SocketProvider>
        <MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>
      </SocketProvider>
    )
    expect(screen.getByText('관리자 모드')).toBeInTheDocument()
  })
})
```

(기존 두 테스트가 이미 `SocketProvider` 없이 통과하고 있었다면 `AdminDashboard`가 마운트 시 `useSocketContext`를 호출하는 `Lobby`를 렌더링하지 않으므로 원래 형태를 유지하고 세 번째 `it`만 추가해도 된다. `npm test -- src/App.test.jsx` 실행 결과 에러가 나면 이 Step의 전체 교체본을 적용한다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/App.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: register /admin route"
```

---

### Task 9: 전체 테스트 실행 + 수동 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 모든 테스트 PASS (기존 테스트 포함, 회귀 없음)

- [ ] **Step 2: 개발 서버 실행**

Run: `npm run dev`
Expected: Vite dev 서버와 API 서버(`server/index.js`)가 함께 기동됨

- [ ] **Step 3: 수동 시나리오 확인 (브라우저)**

1. `http://localhost:5173`(또는 표시된 포트) 접속 → 홈 화면 우상단 톱니바퀴 아이콘 확인.
2. 톱니바퀴 클릭 → `/admin`으로 이동, 휴대폰 프레임이 사라지고 화면 전체(최대 1280px)로 데스크탑 레이아웃이 보이는지 확인.
3. 그리드 뷰 기본 표시 확인: 방 4개 카드(`AB1234` 빈 로비, `CD5678` 2명, `EF9012` 4명 진행중, `GH3456` 등록완료 배지).
4. `AB1234` 카드 클릭 → 관전 팝업으로 기존 로비 UI(팀 코드, 빈 슬롯 4개, "관전 모드입니다")가 뜨는지, 나가기/가격설정/결과등록 버튼이 없는지 확인. X 버튼으로 닫기.
5. "테이블 뷰" 탭 클릭 → 모든 방의 플레이어가 1행씩, 완료된 플레이어는 자산 금액이, 미완료는 `-`가 표시되는지 확인.
6. "← 나가기" 클릭 → `/`로 돌아가고 휴대폰 프레임이 다시 보이는지 확인.

- [ ] **Step 4: 문제 발견 시 조치**

수동 검증 중 레이아웃 깨짐/텍스트 겹침 등이 발견되면 해당 `*.module.css`만 수정하고 `npm test`로 회귀 여부를 재확인한 뒤 별도 커밋으로 기록한다:
```bash
git add <수정한 파일>
git commit -m "fix: adjust admin dashboard layout after manual QA"
```

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지**: §1 진입/라우팅 → Task 7·8, §2 레이아웃 → Task 6, §3 목업 데이터 → Task 1·2, §4 그리드 뷰 → Task 4, §5 테이블 뷰 → Task 5, §6 범위 밖 항목은 태스크에 포함하지 않음. 모두 커버됨.
- **플레이스홀더 없음**: 모든 스텝에 실제 코드/명령어 포함.
- **타입/이름 일관성**: `calculateAssetBreakdown`, `ADMIN_MOCK_ROOMS`, `readOnly`/`mockRoom`, `AdminGridView`/`AdminTableView`/`AdminDashboard` 이름이 전 태스크에서 동일하게 사용됨.
