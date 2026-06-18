# Supabase Result Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "결과 등록하기" 버튼 클릭 시 게임 결과를 Supabase에 저장하고, `/result/:sessionId` 페이지에서 팀 내 순위를 표시한다.

**Architecture:** 서버(Express)가 Supabase service role key로 DB write를 담당하고, 클라이언트는 서버 REST API(`/api/results/:sessionId`)를 통해 결과를 조회한다. 총자산은 서버에서 계산해 `total_assets` 컬럼에 저장한다.

**Tech Stack:** React + React Router, Express, Socket.IO, Supabase (PostgreSQL), @supabase/supabase-js, dotenv, Vitest

---

## File Map

| 파일 | 작업 | 역할 |
|---|---|---|
| `supabase/schema.sql` | 신규 | Supabase 테이블 생성 SQL |
| `.env.example` | 신규 | 환경 변수 템플릿 |
| `server/supabase.js` | 신규 | Supabase 클라이언트 초기화 |
| `server/db.js` | 신규 | DB 함수 (calculateTotalAssets, saveGameResult, getGameResult) |
| `server/db.test.js` | 신규 | calculateTotalAssets 단위 테스트 |
| `server/index.js` | 수정 | dotenv 로드, submit + results 엔드포인트 추가 |
| `src/utils/playerUuid.js` | 신규 | localStorage 기반 익명 UUID 관리 |
| `src/pages/Home.jsx` | 수정 | join-room 이벤트에 playerUuid 추가 |
| `src/pages/Lobby.jsx` | 수정 | 결과 등록하기 버튼 onClick 연결 |
| `src/App.jsx` | 수정 | `/result/:sessionId` 라우트 추가 |
| `src/pages/ResultPage.jsx` | 신규 | 팀 결과 순위 페이지 |
| `src/pages/ResultPage.module.css` | 신규 | 결과 페이지 스타일 |

---

## Task 1: 환경 설정 (dotenv, Supabase 클라이언트)

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `server/supabase.js`
- Modify: `server/index.js` (dotenv import 1줄)

- [ ] **Step 1: dotenv 설치**

```bash
npm install dotenv
```

Expected output: `added 1 package`

- [ ] **Step 2: `.env.example` 생성**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: `.env` 파일 생성 (Supabase 콘솔에서 값 복사)**

Supabase 콘솔 → Settings → API에서:
- `Project URL` → `SUPABASE_URL`
- `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

`.env` 파일 생성 (`.gitignore`에 이미 포함됨):
```
SUPABASE_URL=https://실제값.supabase.co
SUPABASE_SERVICE_ROLE_KEY=실제_서비스_롤_키
```

- [ ] **Step 4: `server/supabase.js` 생성**

```js
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
```

- [ ] **Step 5: `server/index.js` 상단에 dotenv import 추가**

`server/index.js` 첫 번째 줄에 추가:
```js
import 'dotenv/config'
```

최종 import 순서:
```js
import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
// ... 나머지 기존 import
```

- [ ] **Step 6: 서버 시작 확인**

```bash
npm run dev
```

Expected: 서버 정상 시작, 환경 변수 에러 없음

- [ ] **Step 7: @supabase/supabase-js 설치**

```bash
npm install @supabase/supabase-js
```

Expected output: `added N packages`

---

## Task 2: Supabase 테이블 생성

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: `supabase/schema.sql` 생성**

```sql
-- game_sessions: 게임 세션 (팀코드 = 1세션)
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_code TEXT UNIQUE NOT NULL,
  stock_prices JSONB NOT NULL,
  real_estate_prices JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- game_results: 플레이어별 결과
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_uuid UUID NOT NULL,
  name TEXT NOT NULL,
  character TEXT NOT NULL,
  job TEXT NOT NULL,
  cash INTEGER NOT NULL,
  stock_holdings JSONB NOT NULL,
  real_estate_holdings JSONB NOT NULL,
  badges JSONB NOT NULL,
  total_assets NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- 읽기는 공개 (URL 공유로 결과 조회 가능)
CREATE POLICY "Public read game_sessions"
  ON game_sessions FOR SELECT USING (true);

CREATE POLICY "Public read game_results"
  ON game_results FOR SELECT USING (true);

-- 쓰기는 service role key만 (RLS 우회 — 서버에서만 INSERT)
```

- [ ] **Step 2: Supabase 콘솔에서 SQL 실행**

Supabase 콘솔 → SQL Editor → 위 SQL 전체 붙여넣기 → Run

Expected: `Success. No rows returned`

- [ ] **Step 3: 테이블 생성 확인**

Supabase 콘솔 → Table Editor에서 `game_sessions`, `game_results` 테이블 확인

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql .env.example
git commit -m "chore: add Supabase schema and env template"
```

---

## Task 3: DB 함수 + 단위 테스트

**Files:**
- Create: `server/db.js`
- Create: `server/db.test.js`

- [ ] **Step 1: `server/db.test.js` 작성 (실패 테스트)**

```js
import { describe, it, expect } from 'vitest'
import { calculateTotalAssets } from './db.js'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makeState(overrides = {}) {
  return {
    cash: 0,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    ...overrides,
  }
}

describe('calculateTotalAssets', () => {
  it('뱃지 0개이면 0원을 반환한다', () => {
    const state = makeState({ cash: 100000 })
    expect(calculateTotalAssets(state, PRICES)).toBe(0)
  })

  it('뱃지 2개이면 base × 1.0을 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, false, false, false, false] })
    expect(calculateTotalAssets(state, PRICES)).toBe(100000)
  })

  it('뱃지 3개이면 base × 1.5를 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, false, false, false] })
    expect(calculateTotalAssets(state, PRICES)).toBe(150000)
  })

  it('뱃지 6개이면 base × 3.0을 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, true, true] })
    expect(calculateTotalAssets(state, PRICES)).toBe(300000)
  })

  it('주식 보유량을 가격과 곱해 base에 포함한다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [true, true, false, false, false, false], // ×1.0
    })
    // base = 0 + 10*2000 + 0 = 20000, total = 20000 * 1.0 = 20000
    expect(calculateTotalAssets(state, PRICES)).toBe(20000)
  })

  it('부동산 보유량을 가격과 곱해 base에 포함한다', () => {
    const state = makeState({
      realEstate: { gaon: 3, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false], // ×1.0
    })
    // base = 0 + 0 + 3*10000 = 30000, total = 30000 * 1.0 = 30000
    expect(calculateTotalAssets(state, PRICES)).toBe(30000)
  })

  it('현금+주식+부동산을 합산한다', () => {
    const state = makeState({
      cash: 50000,
      stocks: { semiconductor: 5, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false], // ×1.0
    })
    // base = 50000 + 5*2000 + 1*10000 = 50000+10000+10000 = 70000
    expect(calculateTotalAssets(state, PRICES)).toBe(70000)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- server/db.test.js
```

Expected: FAIL — `calculateTotalAssets` is not a function

- [ ] **Step 3: `server/db.js` 생성**

```js
import { supabase } from './supabase.js'

export function calculateTotalAssets(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(stocks).reduce(
    (sum, key) => sum + stocks[key] * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(realEstate).reduce(
    (sum, key) => sum + realEstate[key] * (prices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  return baseAssets * (badgeCount * 0.5)
}

export async function saveGameResult(room) {
  const { code, prices, players } = room

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      team_code: code,
      stock_prices: prices.stocks,
      real_estate_prices: prices.realEstate,
    })
    .select('id')
    .single()

  if (sessionError) throw sessionError

  const rows = players.map(player => ({
    session_id: session.id,
    player_uuid: player.playerUuid,
    name: player.name,
    character: player.character,
    job: player.gameState.job,
    cash: player.gameState.cash ?? 0,
    stock_holdings: player.gameState.stocks,
    real_estate_holdings: player.gameState.realEstate,
    badges: player.gameState.badges,
    total_assets: calculateTotalAssets(player.gameState, prices),
  }))

  const { error: resultsError } = await supabase.from('game_results').insert(rows)
  if (resultsError) throw resultsError

  return session.id
}

export async function getGameResult(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('*')
    .eq('session_id', sessionId)
    .order('total_assets', { ascending: false })

  if (resultsError) throw resultsError

  return { session, results }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npm test -- server/db.test.js
```

Expected: PASS — 7 tests passed

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add DB functions and total_assets calculation"
```

---

## Task 4: Player UUID 유틸리티 + join-room 연결

**Files:**
- Create: `src/utils/playerUuid.js`
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: `src/utils/playerUuid.js` 생성**

```js
export function getPlayerUuid() {
  let uuid = localStorage.getItem('player_uuid')
  if (!uuid) {
    uuid = crypto.randomUUID()
    localStorage.setItem('player_uuid', uuid)
  }
  return uuid
}
```

- [ ] **Step 2: `src/pages/Home.jsx` 수정 — playerUuid import 및 join-room에 추가**

파일 상단에 import 추가:
```js
import { getPlayerUuid } from '../utils/playerUuid'
```

`joinRoom` 함수 수정 (기존 코드 교체):
```js
function joinRoom(code, isHost) {
  const playerUuid = getPlayerUuid()
  socket.emit('join-room', { code, name, character, isHost, playerUuid }, ({ ok, error }) => {
    if (ok) navigate(`/lobby/${code}`)
    else alert(error)
  })
}
```

- [ ] **Step 3: `server/index.js` — join-room 핸들러에 playerUuid 추가**

기존:
```js
socket.on('join-room', ({ code, name, character, isHost }, callback) => {
  try {
    const room = addPlayer(code.toUpperCase(), {
      socketId: socket.id, name, character, isHost: !!isHost,
    })
```

수정:
```js
socket.on('join-room', ({ code, name, character, isHost, playerUuid }, callback) => {
  try {
    const room = addPlayer(code.toUpperCase(), {
      socketId: socket.id, name, character, isHost: !!isHost, playerUuid,
    })
```

- [ ] **Step 4: 동작 확인**

`npm run dev` 실행 후:
1. 앱 접속 → 이름 입력 → 캐릭터 선택 → 팀 생성
2. 브라우저 DevTools → Application → localStorage에 `player_uuid` 키 확인

- [ ] **Step 5: 커밋**

```bash
git add src/utils/playerUuid.js src/pages/Home.jsx server/index.js
git commit -m "feat: add anonymous player UUID to join-room flow"
```

---

## Task 5: Submit 엔드포인트 (`POST /api/rooms/:code/submit`)

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: `server/index.js` 상단에 DB import 추가**

기존 import 블록에 추가:
```js
import { saveGameResult } from './db.js'
```

- [ ] **Step 2: submit 엔드포인트 추가**

`server/index.js`에서 `/api/rooms/:code/qr` 엔드포인트 아래에 추가:

```js
app.post('/api/rooms/:code/submit', async (req, res) => {
  const room = getRoom(req.params.code.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Room not found' })

  if (!room.players.every(p => p.gameState?.isCompleted)) {
    return res.status(400).json({ error: 'Not all players have completed' })
  }

  try {
    const sessionId = await saveGameResult(room)
    res.json({ sessionId })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Results already submitted for this room' })
    }
    console.error('submit error:', err)
    res.status(500).json({ error: 'Failed to save results' })
  }
})
```

- [ ] **Step 3: 동작 수동 확인**

서버 실행 중인 상태에서:
```bash
curl -X POST http://localhost:3001/api/rooms/FAKECODE/submit
```

Expected: `{"error":"Room not found"}` (404)

- [ ] **Step 4: 커밋**

```bash
git add server/index.js
git commit -m "feat: add POST /api/rooms/:code/submit endpoint"
```

---

## Task 6: Results 엔드포인트 (`GET /api/results/:sessionId`)

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: `server/index.js` DB import에 `getGameResult` 추가**

기존:
```js
import { saveGameResult } from './db.js'
```

수정:
```js
import { saveGameResult, getGameResult } from './db.js'
```

- [ ] **Step 2: results 엔드포인트 추가**

submit 엔드포인트 아래에 추가:

```js
app.get('/api/results/:sessionId', async (req, res) => {
  try {
    const { session, results } = await getGameResult(req.params.sessionId)
    res.json({
      teamCode: session.team_code,
      createdAt: session.created_at,
      stockPrices: session.stock_prices,
      realEstatePrices: session.real_estate_prices,
      players: results.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        character: r.character,
        job: r.job,
        cash: r.cash,
        stockHoldings: r.stock_holdings,
        realEstateHoldings: r.real_estate_holdings,
        badges: r.badges,
        totalAssets: Number(r.total_assets),
      })),
    })
  } catch (err) {
    console.error('results error:', err)
    res.status(404).json({ error: 'Result not found' })
  }
})
```

- [ ] **Step 3: 커밋**

```bash
git add server/index.js
git commit -m "feat: add GET /api/results/:sessionId endpoint"
```

---

## Task 7: Lobby 버튼 연결 + App 라우트 추가

**Files:**
- Modify: `src/pages/Lobby.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: `src/pages/Lobby.jsx` — 결과 등록하기 버튼 onClick 연결**

`useNavigate` import는 이미 있음. `useState` import도 이미 있음.

`isHost`, `allCompleted` 선언 아래에 state 추가:
```js
const [isSubmitting, setIsSubmitting] = useState(false)
```

버튼 위에 handleSubmit 함수 추가:
```js
async function handleSubmit() {
  setIsSubmitting(true)
  try {
    const res = await fetch(`/api/rooms/${code}/submit`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    navigate(`/result/${data.sessionId}`)
  } catch (err) {
    alert(err.message)
    setIsSubmitting(false)
  }
}
```

버튼 JSX 수정 (기존 버튼 교체):
```jsx
<button
  className={`${styles.registerBtn} ${allCompleted ? styles.registerBtnActive : ''}`}
  disabled={!allCompleted || isSubmitting}
  onClick={handleSubmit}
>
  {isSubmitting ? '저장 중...' : '결과 등록하기'}
</button>
```

- [ ] **Step 2: `src/App.jsx` — ResultPage 라우트 추가**

import 추가:
```js
import ResultPage from './pages/ResultPage'
```

Routes 안에 추가:
```jsx
<Route path="/result/:sessionId" element={<ResultPage />} />
```

최종 App.jsx:
```jsx
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'
import IndividualPage from './pages/IndividualPage'
import ResultPage from './pages/ResultPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NameInput />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/lobby/:code" element={<Lobby />} />
      <Route path="/lobby/:code/individual" element={<IndividualPage />} />
      <Route path="/result/:sessionId" element={<ResultPage />} />
    </Routes>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/pages/Lobby.jsx src/App.jsx
git commit -m "feat: wire up submit button and add result route"
```

---

## Task 8: 결과 페이지 (`/result/:sessionId`)

**Files:**
- Create: `src/pages/ResultPage.jsx`
- Create: `src/pages/ResultPage.module.css`

- [ ] **Step 1: `src/pages/ResultPage.jsx` 생성**

```jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import styles from './ResultPage.module.css'

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}

const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#AAAAAA']

export default function ResultPage() {
  const { sessionId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch(`/api/results/${sessionId}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('결과를 불러올 수 없습니다.'))
  }, [sessionId])

  if (error) return <div className={styles.message}>{error}</div>
  if (!data) return <div className={styles.message}>불러오는 중...</div>

  const dateStr = new Date(data.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.teamCode}>팀 {data.teamCode}</div>
        <div className={styles.date}>{dateStr}</div>
      </div>

      <div className={styles.rankList}>
        {data.players.map((player, i) => (
          <div
            key={i}
            className={`${styles.rankCard} ${expanded === i ? styles.rankCardExpanded : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className={styles.rankRow}>
              <span className={styles.rank} style={{ color: RANK_COLORS[i] }}>
                {player.rank}위
              </span>
              <img
                src={`/characters/${player.character}.png`}
                alt={player.character}
                className={styles.characterImg}
              />
              <div className={styles.playerInfo}>
                <span className={styles.name}>{player.name}</span>
                <span className={styles.job}>{JOB_LABELS[player.job]}</span>
              </div>
              <span className={styles.totalAssets}>
                {player.totalAssets.toLocaleString()}원
              </span>
            </div>

            {expanded === i && (
              <div className={styles.detail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>현금</span>
                  <span className={styles.detailValue}>{player.cash.toLocaleString()}원</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>성공카드</span>
                  <span className={styles.detailValue}>
                    {player.badges.filter(Boolean).length}개
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>획득 뱃지</span>
                  <div className={styles.badgeRow}>
                    {BADGE_NAMES.map((name, bi) => (
                      <img
                        key={name}
                        src={`/badges/${name}.png`}
                        alt={name}
                        className={`${styles.badgeImg} ${!player.badges[bi] ? styles.badgeLocked : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `src/pages/ResultPage.module.css` 생성**

```css
.page {
  min-height: 100vh;
  background: #0f1117;
  color: #fff;
  padding: 24px 16px;
  max-width: 480px;
  margin: 0 auto;
}

.message {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  font-size: 1rem;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.teamCode {
  font-size: 1.6rem;
  font-weight: 700;
  color: #FFD700;
}

.date {
  font-size: 0.85rem;
  color: #888;
  margin-top: 4px;
}

.rankList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rankCard {
  background: #1a1d2e;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  border: 1px solid #2a2d3e;
  transition: border-color 0.2s;
}

.rankCard:hover {
  border-color: #444;
}

.rankCardExpanded {
  border-color: #555;
}

.rankRow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rank {
  font-size: 1.2rem;
  font-weight: 700;
  min-width: 36px;
}

.characterImg {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.playerInfo {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 1rem;
  font-weight: 600;
}

.job {
  font-size: 0.75rem;
  color: #888;
}

.totalAssets {
  font-size: 1rem;
  font-weight: 700;
  color: #4caf50;
  text-align: right;
}

.detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #2a2d3e;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detailRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detailLabel {
  font-size: 0.85rem;
  color: #888;
}

.detailValue {
  font-size: 0.9rem;
  font-weight: 600;
}

.badgeRow {
  display: flex;
  gap: 6px;
}

.badgeImg {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.badgeLocked {
  opacity: 0.25;
  filter: grayscale(1);
}
```

- [ ] **Step 3: 전체 동작 E2E 확인**

1. `npm run dev` 실행
2. 앱 접속 → 이름 입력 → 캐릭터 선택 → 팀 생성
3. 4명 각자 IndividualPage에서 직업/주식/부동산/뱃지 모두 입력 후 "입력완료"
4. Lobby에서 "결과 등록하기" 버튼 활성화 확인
5. 버튼 클릭 → `/result/:sessionId` 페이지로 이동 확인
6. 총자산 순위 정렬 확인
7. 각 플레이어 카드 탭 → 상세 정보 확인
8. Supabase 콘솔 → `game_sessions`, `game_results` 테이블에 데이터 저장 확인

- [ ] **Step 4: 커밋**

```bash
git add src/pages/ResultPage.jsx src/pages/ResultPage.module.css
git commit -m "feat: add result page with team ranking"
```

---

## 완료 기준

- [ ] 모든 테스트 통과: `npm test`
- [ ] Lobby "결과 등록하기" 클릭 시 `/result/:sessionId`로 이동
- [ ] 결과 페이지에서 4인 total_assets DESC 순위 표시
- [ ] Supabase `game_results` 테이블에 데이터 저장 확인
- [ ] 결과 페이지 URL 공유로 로그인 없이 접근 가능
