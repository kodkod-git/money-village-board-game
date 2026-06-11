# Money Village Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React + Express/Socket.io 웹앱으로 보드게임 팀 생성/참가 + 실시간 로비를 구현한다.

**Architecture:** Express 단일 서버가 React Vite 빌드를 정적 파일로 서빙한다. 방 정보는 인메모리 Map으로 관리하며, Socket.io가 팀원 입장/퇴장을 모든 방 멤버에게 실시간 브로드캐스트한다. URL 파라미터로 방 코드·이름을 페이지 간 전달하고 전역 상태 관리 라이브러리는 사용하지 않는다.

**Tech Stack:** React 18, Vite, React Router v6, Express, Socket.io 4, socket.io-client, qrcode, Vitest, @testing-library/react, Railway

---

## 파일 구조

```
money-village-board-game/
├── server/
│   ├── index.js          # Express + Socket.io 진입점
│   └── rooms.js          # 인메모리 방 관리 (Map)
├── src/
│   ├── main.jsx
│   ├── App.jsx           # React Router 라우팅
│   ├── index.css
│   ├── setupTests.js
│   ├── constants/
│   │   └── characters.js # 16개 캐릭터 ID 목록
│   ├── hooks/
│   │   └── useSocket.js  # Socket.io 클라이언트 훅
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── NameInput.jsx
│   │   ├── CharacterSelect.jsx
│   │   └── Lobby.jsx
│   └── components/
│       ├── CharacterCard.jsx
│       ├── PlayerSlot.jsx
│       ├── CodeModal.jsx
│       └── QRModal.jsx
├── public/
│   └── characters/       # efti/ 이미지 (ptsc.png 등 16개)
├── package.json
├── vite.config.js
├── railway.toml
└── .gitignore
```

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/setupTests.js`, `.gitignore`

- [ ] **Step 1: Vite React 프로젝트 초기화**

```bash
npm create vite@latest . -- --template react
```

- [ ] **Step 2: 의존성 설치**

```bash
npm install express socket.io socket.io-client qrcode react-router-dom
npm install -D concurrently nodemon vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: `package.json` 스크립트 업데이트**

```json
{
  "type": "module",
  "scripts": {
    "dev": "concurrently \"nodemon server/index.js\" \"vite\"",
    "build": "vite build",
    "start": "NODE_ENV=production node server/index.js",
    "test": "vitest"
  }
}
```

- [ ] **Step 4: `vite.config.js` 작성**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
})
```

- [ ] **Step 5: `src/setupTests.js` 작성**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 6: `src/main.jsx` 작성**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
```

- [ ] **Step 7: `.gitignore` 작성**

```
node_modules/
dist/
.env
.superpowers/
```

- [ ] **Step 8: 캐릭터 이미지를 public으로 복사**

```bash
mkdir -p public/characters
cp efti/*.png public/characters/
```

- [ ] **Step 9: git 초기화 및 커밋**

```bash
git init
git add .
git commit -m "feat: project scaffold (Vite + React + Express)"
```

---

### Task 2: 인메모리 방 관리 모듈

**Files:**
- Create: `server/rooms.js`
- Create: `server/rooms.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/rooms.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms
} from './rooms.js'

beforeEach(() => clearRooms())

describe('createRoom', () => {
  it('6자리 영대문자+숫자 코드를 반환한다', () => {
    const room = createRoom()
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(room.players).toEqual([])
  })
})

describe('getRoom', () => {
  it('없는 코드는 null을 반환한다', () => {
    expect(getRoom('XXXXXX')).toBeNull()
  })
})

describe('addPlayer', () => {
  it('플레이어를 방에 추가한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(getRoom(code).players).toHaveLength(1)
  })

  it('4명 초과 시 Room is full 에러', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0 })
    }
    expect(() =>
      addPlayer(code, { socketId: 's5', name: 'p5', character: 'c5', isHost: false })
    ).toThrow('Room is full')
  })
})

describe('removePlayer', () => {
  it('socketId로 플레이어를 제거한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    removePlayer('s1')
    expect(getRoom(code).players).toHaveLength(0)
  })
})

describe('isCharacterTaken', () => {
  it('다른 플레이어가 이미 선택한 캐릭터는 true', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(isCharacterTaken(code, 'ptsc', 's2')).toBe(true)
  })

  it('자신이 선택한 캐릭터는 false', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(isCharacterTaken(code, 'ptsc', 's1')).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run server/rooms.test.js
```
Expected: FAIL — `rooms.js` not found

- [ ] **Step 3: `server/rooms.js` 구현**

```js
import crypto from 'crypto'

const rooms = new Map()
const socketToRoom = new Map()

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

export function createRoom() {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const room = { code, createdAt: new Date(), players: [] }
  rooms.set(code, room)
  return room
}

export function getRoom(code) {
  return rooms.get(code) ?? null
}

export function addPlayer(code, player) {
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')
  if (room.players.length >= 4) throw new Error('Room is full')
  room.players.push(player)
  socketToRoom.set(player.socketId, code)
  return room
}

export function removePlayer(socketId) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  room.players = room.players.filter(p => p.socketId !== socketId)
  socketToRoom.delete(socketId)
  if (room.players.length === 0) rooms.delete(code)
  return room
}

export function isCharacterTaken(code, character, requestingSocketId) {
  const room = rooms.get(code)
  if (!room) return false
  return room.players.some(p => p.character === character && p.socketId !== requestingSocketId)
}

export function clearRooms() {
  rooms.clear()
  socketToRoom.clear()
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run server/rooms.test.js
```
Expected: 6 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: in-memory room management with tests"
```

---

### Task 3: Express + Socket.io 서버

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: `server/index.js` 작성**

```js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'
import qrcode from 'qrcode'
import { createRoom, getRoom, addPlayer, removePlayer } from './rooms.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
const PORT = process.env.PORT || 3001

app.use(express.json())

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
}

// Health check — must be before /:code route
app.get('/api/rooms/health', (_req, res) => res.json({ ok: true }))

app.post('/api/rooms', (_req, res) => {
  const room = createRoom()
  res.json({ code: room.code })
})

app.get('/api/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({ code: room.code, playerCount: room.players.length })
})

app.get('/api/rooms/:code/qr', async (req, res) => {
  const code = req.params.code.toUpperCase()
  const url = `${req.protocol}://${req.get('host')}/join?code=${code}`
  const png = await qrcode.toBuffer(url)
  res.set('Content-Type', 'image/png').send(png)
})

if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

io.on('connection', (socket) => {
  socket.on('join-room', ({ code, name, character, isHost }, callback) => {
    try {
      const room = addPlayer(code.toUpperCase(), {
        socketId: socket.id, name, character, isHost: !!isHost,
      })
      socket.join(code.toUpperCase())
      io.to(code.toUpperCase()).emit('room-updated', { players: room.players })
      callback?.({ ok: true })
    } catch (err) {
      callback?.({ ok: false, error: err.message })
    }
  })

  socket.on('character-preview', ({ code, character }) => {
    socket.to(code.toUpperCase()).emit('character-locked', { character, socketId: socket.id })
  })

  socket.on('leave-room', () => {
    const room = removePlayer(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })

  socket.on('disconnect', () => {
    const room = removePlayer(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })
})

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
```

- [ ] **Step 2: 서버 수동 테스트**

```bash
node server/index.js
```
다른 터미널에서:
```bash
curl -X POST http://localhost:3001/api/rooms
# 예상: {"code":"ABC123"}

curl http://localhost:3001/api/rooms/ABC123
# 예상: {"code":"ABC123","playerCount":0}

curl http://localhost:3001/api/rooms/health
# 예상: {"ok":true}
```

- [ ] **Step 3: 커밋**

```bash
git add server/index.js
git commit -m "feat: Express + Socket.io server with REST API and QR"
```

---

### Task 4: React 라우팅 설정

**Files:**
- Create: `src/App.jsx`, `src/index.css`
- Create placeholder pages (Task 7-10에서 교체)

- [ ] **Step 1: 플레이스홀더 페이지 생성**

`src/pages/Home.jsx`:
```jsx
export default function Home() {
  return <div><button>팀 만들기</button><button>팀 참가</button></div>
}
```

`src/pages/NameInput.jsx`:
```jsx
export default function NameInput() {
  return <input placeholder="예) 홍길동" />
}
```

`src/pages/CharacterSelect.jsx`:
```jsx
export default function CharacterSelect() { return <div>캐릭터선택</div> }
```

`src/pages/Lobby.jsx`:
```jsx
export default function Lobby() { return <div>로비</div> }
```

- [ ] **Step 2: `src/App.jsx` 작성**

```jsx
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join" element={<Home />} />
      <Route path="/name" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/lobby/:code" element={<Lobby />} />
    </Routes>
  )
}
```

- [ ] **Step 3: `src/index.css` 작성**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0a1628;
  color: white;
  min-height: 100vh;
}
input, button { font-family: inherit; }
button { cursor: pointer; border: none; }
```

- [ ] **Step 4: 라우팅 테스트 작성 및 실행**

`src/App.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App routing', () => {
  it('/ 에서 팀 만들기 버튼을 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(screen.getByText('팀 만들기')).toBeInTheDocument()
  })

  it('/name 에서 이름 입력 필드를 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><App /></MemoryRouter>)
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
  })
})
```

```bash
npx vitest run src/App.test.jsx
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/
git commit -m "feat: React routing with placeholder pages"
```

---

### Task 5: useSocket 훅

**Files:**
- Create: `src/hooks/useSocket.js`
- Create: `src/hooks/useSocket.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/hooks/useSocket.test.js`:
```js
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn(), off: vi.fn(), emit: vi.fn(),
    disconnect: vi.fn(), connected: true, id: 'mock-id',
  }
  return { io: vi.fn(() => socket) }
})

import useSocket from './useSocket'

describe('useSocket', () => {
  it('socket과 isConnected를 반환한다', () => {
    const { result } = renderHook(() => useSocket())
    expect(result.current.socket).toBeDefined()
    expect(result.current.isConnected).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/hooks/useSocket.test.js
```
Expected: FAIL

- [ ] **Step 3: `src/hooks/useSocket.js` 구현**

```js
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

let sharedSocket = null

export default function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!sharedSocket) {
      sharedSocket = io({ transports: ['websocket'] })
    }
    socketRef.current = sharedSocket

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    socketRef.current.on('connect', onConnect)
    socketRef.current.on('disconnect', onDisconnect)
    if (socketRef.current.connected) setIsConnected(true)

    return () => {
      socketRef.current.off('connect', onConnect)
      socketRef.current.off('disconnect', onDisconnect)
    }
  }, [])

  return { socket: socketRef.current, isConnected }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/hooks/useSocket.test.js
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/
git commit -m "feat: useSocket hook (shared singleton socket.io-client)"
```

---

### Task 6: CodeModal + QRModal 컴포넌트

**Files:**
- Create: `src/components/CodeModal.jsx`, `src/components/CodeModal.module.css`
- Create: `src/components/QRModal.jsx`, `src/components/QRModal.module.css`
- Create: `src/components/CodeModal.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/CodeModal.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CodeModal from './CodeModal'

describe('CodeModal', () => {
  it('onSubmit에 대문자 코드를 전달한다', () => {
    const onSubmit = vi.fn()
    render(<CodeModal onSubmit={onSubmit} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('팀 코드를 입력하세요'), {
      target: { value: 'abc123' },
    })
    fireEvent.click(screen.getByText('참가'))
    expect(onSubmit).toHaveBeenCalledWith('ABC123')
  })

  it('X 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<CodeModal onSubmit={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/components/CodeModal.test.jsx
```
Expected: FAIL

- [ ] **Step 3: `src/components/CodeModal.jsx` 구현**

```jsx
import { useState } from 'react'
import styles from './CodeModal.module.css'

export default function CodeModal({ onSubmit, onClose }) {
  const [code, setCode] = useState('')
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
        <h2>코드로 팀 참가</h2>
        <div className={styles.divider} />
        <input
          className={styles.input}
          placeholder="팀 코드를 입력하세요"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button className={styles.btn} onClick={() => onSubmit(code)}>참가</button>
      </div>
    </div>
  )
}
```

`src/components/CodeModal.module.css`:
```css
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #1e88e5; border-radius: 14px;
  padding: 28px 32px; width: 320px;
  text-align: center; position: relative;
}
.close {
  position: absolute; top: 12px; right: 12px;
  background: #e53935; color: white;
  border-radius: 50%; width: 28px; height: 28px; font-size: 14px;
}
.modal h2 { color: white; font-size: 16px; margin-bottom: 8px; }
.divider { height: 2px; background: rgba(255,255,255,0.3); margin: 12px 0 20px; }
.input {
  width: 100%; padding: 11px; border-radius: 8px; border: none;
  font-size: 16px; letter-spacing: 4px; text-align: center; margin-bottom: 16px;
}
.btn {
  background: #1565c0; color: white;
  padding: 10px 40px; border-radius: 8px;
  font-size: 14px; font-weight: bold; box-shadow: 0 3px 0 #0d47a1;
}
```

- [ ] **Step 4: `src/components/QRModal.jsx` 구현**

```jsx
import styles from './QRModal.module.css'

export default function QRModal({ code, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
        <h2>내 팀의 QR 코드</h2>
        <div className={styles.divider} />
        <p className={styles.subtitle}>스캔해서 제 팀에 참가하세요!</p>
        <img src={`/api/rooms/${code}/qr`} alt="QR 코드" className={styles.qr} />
      </div>
    </div>
  )
}
```

`src/components/QRModal.module.css`:
```css
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #1e88e5; border-radius: 14px;
  padding: 28px 32px; width: 360px;
  text-align: center; position: relative;
}
.close {
  position: absolute; top: 12px; right: 12px;
  background: #e53935; color: white;
  border-radius: 50%; width: 28px; height: 28px; font-size: 14px;
}
.modal h2 { color: white; font-size: 16px; margin-bottom: 8px; }
.divider { height: 2px; background: rgba(255,255,255,0.3); margin: 12px 0 16px; }
.subtitle { color: white; font-size: 13px; margin-bottom: 16px; }
.qr { width: 220px; height: 220px; background: white; border-radius: 8px; padding: 8px; }
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/components/CodeModal.test.jsx
```
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/
git commit -m "feat: CodeModal and QRModal components"
```

---

### Task 7: Home 페이지

**Files:**
- Modify: `src/pages/Home.jsx`
- Create: `src/pages/Home.module.css`, `src/pages/Home.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/Home.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import Home from './Home'

describe('Home', () => {
  beforeEach(() => vi.clearAllMocks())

  it('팀 만들기, 팀 참가 버튼을 렌더링한다', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByText('팀 만들기')).toBeInTheDocument()
    expect(screen.getByText('팀 참가')).toBeInTheDocument()
  })

  it('팀 참가 클릭 시 CodeModal이 열린다', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    fireEvent.click(screen.getByText('팀 참가'))
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })

  it('팀 만들기 클릭 시 POST /api/rooms를 호출한다', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 'ABC123' }) })
    render(<MemoryRouter><Home /></MemoryRouter>)
    fireEvent.click(screen.getByText('팀 만들기'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('QR URL(/join?code=)로 접근 시 /name으로 자동 이동한다', () => {
    render(
      <MemoryRouter initialEntries={['/join?code=ABC123']}>
        <Home />
      </MemoryRouter>
    )
    expect(mockNavigate).toHaveBeenCalledWith('/name?code=ABC123')
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/pages/Home.test.jsx
```
Expected: FAIL

- [ ] **Step 3: `src/pages/Home.jsx` 구현**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CodeModal from '../components/CodeModal'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showCodeModal, setShowCodeModal] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) navigate(`/name?code=${code}`)  // QR 스캔: 코드 자동 주입
  }, [searchParams, navigate])

  async function handleCreate() {
    const res = await fetch('/api/rooms', { method: 'POST' })
    const { code } = await res.json()
    navigate(`/name?code=${code}&host=true`)
  }

  function handleJoinByCode(code) {
    setShowCodeModal(false)
    navigate(`/name?code=${code}`)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>💰 Money Village</h1>
      <p className={styles.subtitle}>보드게임 팀 구성 시스템</p>
      <div className={styles.buttons}>
        <button className={styles.createBtn} onClick={handleCreate}>팀 만들기</button>
        <button className={styles.joinBtn} onClick={() => setShowCodeModal(true)}>팀 참가</button>
      </div>
      {showCodeModal && (
        <CodeModal onSubmit={handleJoinByCode} onClose={() => setShowCodeModal(false)} />
      )}
    </div>
  )
}
```

`src/pages/Home.module.css`:
```css
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a1628 0%, #0f2a50 60%, #163d28 100%);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
}
.title { color: #ffd700; font-size: 32px; text-shadow: 0 2px 8px #000; }
.subtitle { color: #90caf9; font-size: 14px; margin-bottom: 24px; }
.buttons { display: flex; gap: 16px; }
.createBtn {
  background: #43a047; color: white;
  padding: 14px 28px; border-radius: 12px;
  font-size: 16px; font-weight: bold; box-shadow: 0 4px 0 #2e7d32;
}
.joinBtn {
  background: #1e88e5; color: white;
  padding: 14px 28px; border-radius: 12px;
  font-size: 16px; font-weight: bold; box-shadow: 0 4px 0 #1565c0;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/pages/Home.test.jsx
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Home.jsx src/pages/Home.module.css src/pages/Home.test.jsx
git commit -m "feat: Home page with team create/join and QR auto-redirect"
```

---

### Task 8: NameInput 페이지

**Files:**
- Modify: `src/pages/NameInput.jsx`
- Create: `src/pages/NameInput.module.css`, `src/pages/NameInput.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/NameInput.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import NameInput from './NameInput'

describe('NameInput', () => {
  it('이름 입력 필드와 다음 버튼을 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
    expect(screen.getByText('다음 →')).toBeInTheDocument()
  })

  it('이름 입력 후 /select로 이동한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) 홍길동'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?code=ABC123&name=%EC%B2%A0%EC%88%98')
  })

  it('이름이 비어있으면 이동하지 않는다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/pages/NameInput.test.jsx
```
Expected: FAIL

- [ ] **Step 3: `src/pages/NameInput.jsx` 구현**

```jsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')

  const code = searchParams.get('code') ?? ''
  const isHost = searchParams.get('host') === 'true'

  function handleNext() {
    if (!name.trim()) return
    const params = new URLSearchParams({ code, name: name.trim() })
    if (isHost) params.set('host', 'true')
    navigate(`/select?${params}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>💰 Money Village</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
        <label className={styles.label}>이름을 입력하세요</label>
        <input
          className={styles.input}
          placeholder="예) 홍길동"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          maxLength={20}
        />
        <button className={styles.btn} onClick={handleNext}>다음 →</button>
      </div>
    </div>
  )
}
```

`src/pages/NameInput.module.css`:
```css
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a1628 0%, #0f2a50 60%, #163d28 100%);
  display: flex; align-items: center; justify-content: center;
}
.card {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 16px; padding: 36px 32px;
  width: 360px; text-align: center;
}
.title { color: #ffd700; font-size: 22px; font-weight: bold; margin-bottom: 6px; }
.subtitle { color: #90caf9; font-size: 13px; margin-bottom: 28px; }
.label {
  display: block; color: #90caf9; font-size: 12px;
  font-weight: bold; text-align: left; margin-bottom: 6px;
}
.input {
  width: 100%; padding: 11px 14px;
  border-radius: 10px; border: 2px solid #42a5f5;
  background: rgba(13,27,62,0.8); color: white;
  font-size: 14px; margin-bottom: 24px;
}
.btn {
  width: 100%; background: #1e88e5; color: white;
  padding: 12px; border-radius: 10px;
  font-size: 14px; font-weight: bold; box-shadow: 0 3px 0 #1565c0;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/pages/NameInput.test.jsx
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/NameInput.jsx src/pages/NameInput.module.css src/pages/NameInput.test.jsx
git commit -m "feat: NameInput page"
```

---

### Task 9: CharacterCard 컴포넌트 + 캐릭터 상수

**Files:**
- Create: `src/constants/characters.js`
- Create: `src/components/CharacterCard.jsx`, `src/components/CharacterCard.module.css`
- Create: `src/components/CharacterCard.test.jsx`

- [ ] **Step 1: `src/constants/characters.js` 작성**

```js
export const CHARACTERS = [
  'ptsc', 'ptec', 'pasc', 'paec',
  'ftsc', 'ftec', 'fasc', 'faec',
  'ptsn', 'pten', 'pasn', 'paen',
  'ftsn', 'ften', 'fasn', 'faen',
]
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/components/CharacterCard.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CharacterCard from './CharacterCard'

describe('CharacterCard', () => {
  it('캐릭터 이미지를 렌더링한다', () => {
    render(<CharacterCard id="ptsc" state="idle" onSelect={() => {}} />)
    expect(screen.getByAltText('ptsc')).toBeInTheDocument()
  })

  it('idle 상태에서 클릭 시 onSelect를 호출한다', () => {
    const onSelect = vi.fn()
    render(<CharacterCard id="ptsc" state="idle" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('ptsc')
  })

  it('locked 상태에서 클릭해도 onSelect를 호출하지 않는다', () => {
    const onSelect = vi.fn()
    render(<CharacterCard id="ptsc" state="locked" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selected 상태에서 체크 뱃지를 표시한다', () => {
    render(<CharacterCard id="ptsc" state="selected" onSelect={() => {}} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('locked 상태에서 잠금 뱃지를 표시한다', () => {
    render(<CharacterCard id="ptsc" state="locked" onSelect={() => {}} />)
    expect(screen.getByText('🔒')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/components/CharacterCard.test.jsx
```
Expected: FAIL

- [ ] **Step 4: `src/components/CharacterCard.jsx` 구현**

```jsx
import styles from './CharacterCard.module.css'

export default function CharacterCard({ id, state, onSelect }) {
  return (
    <div
      className={`${styles.card} ${styles[state]}`}
      onClick={() => state !== 'locked' && onSelect(id)}
      role="button"
      aria-disabled={state === 'locked'}
    >
      {state === 'selected' && <span className={styles.badge}>✓</span>}
      {state === 'locked' && <span className={styles.badge}>🔒</span>}
      <img
        src={`/characters/${id}.png`}
        alt={id}
        className={styles.img}
      />
    </div>
  )
}
```

`src/components/CharacterCard.module.css`:
```css
.card {
  background: rgba(255,255,255,0.05);
  border: 2px solid #2a3a50;
  border-radius: 12px;
  padding: 10px 6px;
  text-align: center;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, opacity 0.15s;
}
.card.idle { opacity: 0.72; }
.card.idle:hover { border-color: #42a5f5; opacity: 1; }
.card.selected {
  background: rgba(66,165,245,0.18);
  border-color: #42a5f5;
  opacity: 1;
}
.card.locked { opacity: 0.35; cursor: not-allowed; }
.badge {
  position: absolute; top: 5px; right: 5px;
  background: #43a047; color: white;
  border-radius: 50%; width: 18px; height: 18px;
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
}
.card.locked .badge { background: transparent; }
.img { width: 68px; height: 80px; object-fit: contain; display: block; margin: 0 auto; }
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/components/CharacterCard.test.jsx
```
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/constants/ src/components/CharacterCard.jsx src/components/CharacterCard.module.css src/components/CharacterCard.test.jsx
git commit -m "feat: CharacterCard component with selected/locked states"
```

---

### Task 10: CharacterSelect 페이지

**Files:**
- Modify: `src/pages/CharacterSelect.jsx`
- Create: `src/pages/CharacterSelect.module.css`, `src/pages/CharacterSelect.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/CharacterSelect.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn(), off: vi.fn(),
    emit: vi.fn((ev, data, cb) => cb?.({ ok: true })),
    connected: true, id: 'mock-id',
  }
  return { io: vi.fn(() => socket) }
})
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

import CharacterSelect from './CharacterSelect'

describe('CharacterSelect', () => {
  it('16개 캐릭터 카드를 렌더링한다', () => {
    render(
      <MemoryRouter initialEntries={['/select?code=ABC123&name=철수']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('button')).toHaveLength(17) // 16 cards + 완료 button
  })

  it('카드 클릭 시 selected 상태로 변경된다', () => {
    render(
      <MemoryRouter initialEntries={['/select?code=ABC123&name=철수']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/pages/CharacterSelect.test.jsx
```
Expected: FAIL

- [ ] **Step 3: `src/pages/CharacterSelect.jsx` 구현**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CharacterCard from '../components/CharacterCard'
import useSocket from '../hooks/useSocket'
import { CHARACTERS } from '../constants/characters'
import styles from './CharacterSelect.module.css'

export default function CharacterSelect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocket()
  const [selected, setSelected] = useState(null)
  const [lockedByOthers, setLockedByOthers] = useState(new Set())

  const code = searchParams.get('code') ?? ''
  const name = searchParams.get('name') ?? ''
  const isHost = searchParams.get('host') === 'true'

  useEffect(() => {
    if (!socket) return
    const handler = ({ character }) =>
      setLockedByOthers(prev => new Set([...prev, character]))
    socket.on('character-locked', handler)
    return () => socket.off('character-locked', handler)
  }, [socket])

  function handleSelect(id) {
    setSelected(id)
    socket?.emit('character-preview', { code, character: id })
  }

  function handleSubmit() {
    if (!selected || !socket) return
    socket.emit('join-room', { code, name, character: selected, isHost }, ({ ok, error }) => {
      if (ok) navigate(`/lobby/${code}`)
      else alert(error)
    })
  }

  function getState(id) {
    if (id === selected) return 'selected'
    if (lockedByOthers.has(id)) return 'locked'
    return 'idle'
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.title}>캐릭터를 선택하세요</p>
        <p className={styles.subtitle}>{name} 님, 나를 대표할 캐릭터를 골라주세요</p>
      </div>
      <div className={styles.grid}>
        {CHARACTERS.map(id => (
          <CharacterCard key={id} id={id} state={getState(id)} onSelect={handleSelect} />
        ))}
      </div>
      <button className={styles.submitBtn} onClick={handleSubmit} disabled={!selected}>
        완료 → 로비 입장
      </button>
    </div>
  )
}
```

`src/pages/CharacterSelect.module.css`:
```css
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a1628 0%, #0f2a50 60%, #163d28 100%);
  display: flex; flex-direction: column;
  align-items: center; padding: 28px 20px;
}
.header { text-align: center; margin-bottom: 20px; }
.title { color: white; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
.subtitle { color: #90caf9; font-size: 12px; }
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%; max-width: 520px;
  margin-bottom: 20px;
}
.submitBtn {
  background: #43a047; color: white;
  padding: 13px 40px; border-radius: 10px;
  font-size: 14px; font-weight: bold; box-shadow: 0 3px 0 #2e7d32;
  max-width: 520px; width: 100%;
}
.submitBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/pages/CharacterSelect.test.jsx
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/pages/CharacterSelect.jsx src/pages/CharacterSelect.module.css src/pages/CharacterSelect.test.jsx
git commit -m "feat: CharacterSelect page (16 characters, real-time lock)"
```

---

### Task 11: PlayerSlot 컴포넌트

**Files:**
- Create: `src/components/PlayerSlot.jsx`, `src/components/PlayerSlot.module.css`
- Create: `src/components/PlayerSlot.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/PlayerSlot.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerSlot from './PlayerSlot'

describe('PlayerSlot', () => {
  it('참가한 플레이어의 이름과 캐릭터를 표시한다', () => {
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: true }} />)
    expect(screen.getByText('철수')).toBeInTheDocument()
    expect(screen.getByText('방장 ★')).toBeInTheDocument()
    expect(screen.getByAltText('ptsc')).toBeInTheDocument()
  })

  it('player가 null이면 대기 중... 을 표시한다', () => {
    render(<PlayerSlot player={null} />)
    expect(screen.getByText('대기 중...')).toBeInTheDocument()
  })

  it('isHost가 false이면 참가완료를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false }} />)
    expect(screen.getByText('참가완료')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/components/PlayerSlot.test.jsx
```
Expected: FAIL

- [ ] **Step 3: `src/components/PlayerSlot.jsx` 구현**

```jsx
import styles from './PlayerSlot.module.css'

export default function PlayerSlot({ player }) {
  if (!player) {
    return (
      <div className={styles.slot}>
        <div className={styles.emptyImg} />
        <div className={styles.badgeEmpty}>대기 중...</div>
      </div>
    )
  }
  return (
    <div className={styles.slot}>
      <img
        src={`/characters/${player.character}.png`}
        alt={player.character}
        className={styles.img}
      />
      <div className={styles.badge}>
        <span className={styles.name}>{player.name}</span>
        {player.isHost
          ? <span className={styles.host}>방장 ★</span>
          : <span className={styles.joined}>참가완료</span>
        }
      </div>
    </div>
  )
}
```

`src/components/PlayerSlot.module.css`:
```css
.slot {
  display: flex; flex-direction: column;
  align-items: center; gap: 8px;
}
.img { width: 145px; height: 175px; object-fit: contain; }
.emptyImg {
  width: 145px; height: 175px;
  background: rgba(255,255,255,0.05);
  border: 2px dashed #555;
  border-radius: 12px; opacity: 0.38;
}
.badge {
  background: rgba(66,165,245,0.2);
  border: 1px solid #42a5f5;
  border-radius: 20px; padding: 4px 16px;
  text-align: center;
}
.badgeEmpty {
  background: rgba(255,255,255,0.05);
  border: 1px dashed #555;
  border-radius: 20px; padding: 4px 16px;
  color: #777; font-size: 12px; opacity: 0.38;
}
.name { display: block; color: white; font-size: 12px; font-weight: bold; }
.host { display: block; color: #ffd700; font-size: 10px; }
.joined { display: block; color: #aaa; font-size: 10px; }
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/components/PlayerSlot.test.jsx
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/PlayerSlot.jsx src/components/PlayerSlot.module.css src/components/PlayerSlot.test.jsx
git commit -m "feat: PlayerSlot component"
```

---

### Task 12: Lobby 페이지

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Create: `src/pages/Lobby.module.css`, `src/pages/Lobby.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/pages/Lobby.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn((ev, cb) => {
      if (ev === 'room-updated') {
        cb({ players: [{ name: '철수', character: 'ptsc', isHost: true, socketId: 's1' }] })
      }
    }),
    off: vi.fn(), emit: vi.fn(),
    connected: true, id: 's1',
  }
  return { io: vi.fn(() => socket) }
})

import Lobby from './Lobby'

function renderLobby() {
  return render(
    <MemoryRouter initialEntries={['/lobby/ABC123']}>
      <Routes><Route path="/lobby/:code" element={<Lobby />} /></Routes>
    </MemoryRouter>
  )
}

describe('Lobby', () => {
  it('팀 코드를 표시한다', () => {
    renderLobby()
    expect(screen.getByText(/ABC123/)).toBeInTheDocument()
  })

  it('참가 인원을 표시한다', () => {
    renderLobby()
    expect(screen.getByText(/1 \/ 4 명 참가/)).toBeInTheDocument()
  })

  it('참가한 플레이어 이름을 표시한다', () => {
    renderLobby()
    expect(screen.getByText('철수')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/pages/Lobby.test.jsx
```
Expected: FAIL

- [ ] **Step 3: `src/pages/Lobby.jsx` 구현**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import useSocket from '../hooks/useSocket'
import styles from './Lobby.module.css'

export default function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocket()
  const [players, setPlayers] = useState([])
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    if (!socket) return
    const handler = ({ players }) => setPlayers(players)
    socket.on('room-updated', handler)
    return () => socket.off('room-updated', handler)
  }, [socket])

  function handleLeave() {
    socket?.emit('leave-room')
    navigate('/')
  }

  const slots = Array.from({ length: 4 }, (_, i) => players[i] ?? null)

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.codeBox}>
          팀 코드: <span className={styles.code}>{code}</span>
          <button
            className={styles.copyBtn}
            onClick={() => navigator.clipboard.writeText(code)}
            aria-label="코드 복사"
          >📋</button>
        </div>
        <div className={styles.actions}>
          <button className={styles.qrBtn} onClick={() => setShowQR(true)}>📱 QR</button>
          <button className={styles.leaveBtn} onClick={handleLeave}>팀 나가기</button>
        </div>
      </div>

      <div className={styles.counter}>{players.length} / 4 명 참가</div>

      <div className={styles.characters}>
        {slots.map((player, i) => <PlayerSlot key={i} player={player} />)}
      </div>

      {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
    </div>
  )
}
```

`src/pages/Lobby.module.css`:
```css
.page {
  min-height: 100vh;
  background: linear-gradient(180deg,
    #0a1628 0%, #0f2a50 30%, #1a3f6e 55%,
    #1e4e50 72%, #1a4a30 88%, #163d28 100%
  );
  display: flex; flex-direction: column;
}
.topBar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px;
}
.codeBox {
  background: rgba(0,0,0,0.45); border-radius: 8px;
  padding: 6px 14px; color: #aaa; font-size: 12px;
  display: flex; align-items: center; gap: 6px;
}
.code { color: #ffd700; font-weight: bold; letter-spacing: 3px; font-size: 14px; }
.copyBtn { background: transparent; color: #aaa; font-size: 13px; padding: 0; }
.actions { display: flex; gap: 8px; }
.qrBtn {
  background: #1e88e5; color: white;
  padding: 6px 14px; border-radius: 6px;
  font-size: 11px; box-shadow: 0 2px 0 #1565c0;
}
.leaveBtn {
  background: #e53935; color: white;
  padding: 6px 14px; border-radius: 6px;
  font-size: 11px; box-shadow: 0 2px 0 #b71c1c;
}
.counter {
  background: rgba(255,255,255,0.1);
  color: #90caf9; font-size: 12px;
  padding: 4px 16px; border-radius: 12px;
  width: fit-content; margin: 4px auto;
}
.characters {
  display: flex; justify-content: center;
  align-items: flex-end; gap: 20px;
  padding: 24px 20px 40px; flex: 1;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/pages/Lobby.test.jsx
```
Expected: PASS

- [ ] **Step 5: 전체 테스트 실행**

```bash
npx vitest run
```
Expected: 전체 통과

- [ ] **Step 6: 커밋**

```bash
git add src/pages/Lobby.jsx src/pages/Lobby.module.css src/pages/Lobby.test.jsx
git commit -m "feat: Lobby page with real-time character standing view"
```

---

### Task 13: Railway 배포 설정

**Files:**
- Create: `railway.toml`

- [ ] **Step 1: `railway.toml` 작성**

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/rooms/health"
```

- [ ] **Step 2: 로컬 프로덕션 빌드 테스트**

```bash
npm run build
npm start
```
브라우저에서 `http://localhost:3001` 열어 React 앱이 정상 서빙되는지 확인한다.

- [ ] **Step 3: Railway 배포**

Railway 대시보드에서 GitHub 레포를 연결하거나:
```bash
railway up
```

- [ ] **Step 4: 커밋**

```bash
git add railway.toml
git commit -m "feat: Railway deployment config"
```

---

## 셀프 리뷰

**스펙 커버리지 체크:**
- ✅ 홈 화면 (팀 만들기/참가): Task 7
- ✅ 팀 만들기 → 방 코드 생성: Task 3 (POST /api/rooms) + Task 7
- ✅ 코드로 팀 참가: Task 6 (CodeModal) + Task 7
- ✅ QR로 팀 참가: Task 3 (GET /qr) + Task 6 (QRModal) + Task 7 (auto-redirect)
- ✅ 이름 입력: Task 8
- ✅ 캐릭터 선택 16종: Task 9 + Task 10
- ✅ 캐릭터 잠금 (다른 플레이어 선택 시): Task 10 (character-locked 이벤트)
- ✅ 로비 실시간: Task 3 (Socket.io) + Task 11 + Task 12
- ✅ QR 공유 버튼 (로비): Task 12
- ✅ 팀 나가기: Task 12 + Task 3 (leave-room)

**타입 일관성:**
- `addPlayer(code, player)` → server/index.js에서 동일하게 호출
- `CharacterCard({ id, state, onSelect })` → CharacterSelect에서 동일 props 전달
- `PlayerSlot({ player })` → Lobby에서 `players[i] ?? null` 전달
- Socket 이벤트: `join-room`, `room-updated`, `leave-room`, `character-locked`, `character-preview` 서버/클라이언트 모두 동일
