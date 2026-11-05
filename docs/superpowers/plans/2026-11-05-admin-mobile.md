# 관리자 모드 모바일 대응 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 767px 이하에서 관리자 모드를 휴대폰으로 쓸 수 있게 하고, 768px 이상의 모습과 동작은 그대로 둔다.

**Architecture:** 모바일 전용 화면 없이 지금 화면을 반응형으로 바꾼다. 스타일만 다르면 각 CSS 끝에 `@media (max-width: 767px)`를 더하고, 보여 주는 요소가 다르면 `useIsAdminMobile` 훅으로 나눈다. 훅은 `matchMedia`가 없으면 `false`를 돌려주므로 기존 테스트는 PC 동작을 그대로 검증한다.

**Tech Stack:** React 18, CSS Modules, Vitest + Testing Library, Vite, headless Chrome(스크린샷)

**설계 문서:** `docs/superpowers/specs/2026-11-05-admin-mobile-design.md`

---

## 작업 전 규칙

- 브랜치는 `feat/admin-mobile`이다. `git add`에는 이 계획에 적힌 경로만 쓴다. 작업 폴더에 관련 없는 미추적 파일(`.omc/`, `Claude outputs/` 등)이 많다.
- 테스트 명령은 `npx vitest run <경로>`다. `npm test`는 감시 모드로 멈추므로 쓰지 않는다.
- CSS의 `@media` 블록은 **파일 맨 끝에** 더한다. 같은 특이도에서는 뒤의 규칙이 이긴다.
- 모바일 입력칸의 글자 크기는 16px 이상이어야 한다. iOS Safari는 그보다 작은 입력칸을 누르면 화면을 확대한다.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/hooks/useIsAdminMobile.js` (새 파일) | 767px 이하인지 판단 |
| `src/test-utils/mockViewport.js` (새 파일) | 테스트용 `matchMedia` 모의 함수 |
| `src/components/admin/adminNavItems.js` (새 파일) | 사이드바와 탭바가 함께 쓰는 메뉴 목록 |
| `src/components/admin/AdminBottomNav.jsx` (새 파일) | 하단 탭바 |
| `src/components/admin/AdminOverflowMenu.jsx` (새 파일) | `⋯` 메뉴 |
| `admin-preview.html`, `admin-frame.html`, `src/__adminPreview.jsx` (임시, 커밋 금지) | 스크린샷용 미리보기. Task 14에서 지운다 |

---

### Task 1: 미리보기 도구와 PC 기준 스크린샷

**반드시 다른 작업보다 먼저 한다.** 이 시점의 화면이 PC 비교 기준이다.

**Files:**
- Create (임시, 커밋 금지): `admin-preview.html`, `admin-frame.html`, `src/__adminPreview.jsx`
- Create (스크래치 폴더): `$SCRATCH/shots.cjs`

`$SCRATCH`는 세션 스크래치 폴더의 절대 경로다.

- [ ] **Step 1: 미리보기 페이지를 만든다**

`admin-preview.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>admin preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/__adminPreview.jsx"></script>
  </body>
</html>
```

`admin-frame.html` (headless Chrome 창은 폭을 500px 아래로 줄이기 어려워 iframe으로 폭을 만든다):

```html
<!doctype html>
<html lang="ko">
  <body style="margin:0;background:#888">
    <script>
      const q = new URLSearchParams(location.search)
      const frame = document.createElement('iframe')
      frame.style.border = '0'
      frame.style.display = 'block'
      frame.width = q.get('w')
      frame.height = q.get('h')
      frame.src = `/admin-preview.html?click=${encodeURIComponent(q.get('click') ?? '')}`
      document.body.append(frame)
    </script>
  </body>
</html>
```

`src/__adminPreview.jsx`:

```jsx
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import './index.css'
import AdminDashboard from './pages/AdminDashboard'
import { SocketProvider } from './contexts/SocketContext'
import { setAdminSession } from './utils/adminAuth'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}
const player = (id, name, character, cash) => ({
  playerUuid: id, name, character, affiliation: '서울중', connected: true,
  gameState: {
    cash, job: 'a', jobVisited: true,
    stocks: { semiconductor: 3, finance: 0, industrial: 1, auto: 0, bio: 2, content: 0 },
    realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 2, hani: 0 },
    badges: [true, false, true, false, false, false],
    isCompleted: true,
  },
})
const ROOMS = [
  { code: 'AB1234', title: null, status: 'completed-but-unregistered', registered: false, prices: PRICES, classId: 'class-1',
    players: [player('p1', '김민준', 'Innovator-사자', 1500000), player('p2', '이서연', 'Adventurer-강아지', 800000),
      player('p3', '박지호', 'Innovator-사자', 300000), player('p4', '최유진', 'Adventurer-강아지', 2100000)] },
  { code: 'CD5678', title: null, status: 'live', registered: false, prices: PRICES, classId: 'class-1',
    players: [player('p5', '정하늘', 'Innovator-사자', 700000)] },
  { code: 'EF9012', title: null, status: 'live', registered: true, sessionId: 's1', prices: PRICES, classId: 'class-1',
    players: [player('p6', '강바다', 'Adventurer-강아지', 900000)] },
]
const RANKINGS = ['김민준', '이서연', '박지호', '최유진', '정하늘'].map((name, i) => ({
  rank: i + 1, playerUuid: `r${i}`, name, character: i % 2 ? 'Adventurer-강아지' : 'Innovator-사자',
  affiliation: '서울중', job: 'a', teamName: `${i % 2 ? 2 : 1}조`, teamCode: 'AB1234', className: '3학년 2반',
  cash: 500000 - i * 50000, stockValue: 300000, realEstateValue: 200000,
  netWorth: 1000000 - i * 50000, totalAssets: 2000000 - i * 100000,
  stockHoldings: {}, realEstateHoldings: {}, badges: [false, false, false, false, false, false],
  stockPrices: PRICES.stocks, realEstatePrices: PRICES.realEstate,
}))

function body(url) {
  if (url.startsWith('/api/admin/classes')) {
    return [{ id: 'class-1', name: '3학년 2반', createdAt: '2026-07-27T00:00:00.000Z' }, { id: 'unassigned', name: '미배정 수업' }]
  }
  if (url.startsWith('/api/admin/rooms')) return ROOMS
  if (url.startsWith('/api/rankings')) return RANKINGS
  if (url.startsWith('/api/rooms/')) return { players: [], prices: PRICES }
  return []
}
window.fetch = async url => new Response(JSON.stringify(body(String(url))), { status: 200 })

setAdminSession('preview', { username: 'admin', isSuper: true })

const noMotion = document.createElement('style')
noMotion.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'
document.head.append(noMotion)

// click=수업이름|김민준|testid:edit-cash : 글자, aria-label, data-testid로 순서대로 누른다.
function find(target) {
  if (target.startsWith('testid:')) return document.querySelector(`[data-testid="${target.slice(7)}"]`)
  const labelled = document.querySelector(`[aria-label="${target}"]`)
  if (labelled) return labelled
  return [...document.querySelectorAll('button, span, p, h1')].find(el => el.textContent.trim() === target)
}
const steps = (new URLSearchParams(location.search).get('click') ?? '').split('|').filter(Boolean)
function runSteps(i = 0) {
  if (i >= steps.length) return
  find(steps[i])?.click()
  setTimeout(() => runSteps(i + 1), 500)
}

createRoot(document.getElementById('root')).render(
  <SocketProvider><MemoryRouter><AdminDashboard /></MemoryRouter></SocketProvider>
)
setTimeout(runSteps, 800)
```

- [ ] **Step 2: 촬영 스크립트를 만든다**

Windows의 headless Chrome은 파일을 쓰기 전에 명령이 끝나므로 파일이 생길 때까지 기다린다. `$SCRATCH/shots.cjs`:

```js
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const [, , outDir, sizesArg, screensArg] = process.argv
const SCREENS = {
  classes: '',
  team: '3학년 2반',
  spectate: '3학년 2반|김민준',
  edit: '3학년 2반|김민준|수정',
  field: '3학년 2반|김민준|수정|testid:edit-stocks',
  ranking: '3학년 2반|랭킹 보기',
  settings: '설정',
  'class-menu': '3학년 2반 메뉴',
  'team-menu': '3학년 2반|수업 메뉴',
  'spectate-menu': '3학년 2반|김민준|팀 메뉴',
  cash: '3학년 2반|김민준|수정|testid:edit-cash',
  'ranking-player': '3학년 2반|랭킹 보기|이서연',
}
const sizes = sizesArg.split(',').map(s => s.split('x').map(Number))
const names = screensArg ? screensArg.split(',') : Object.keys(SCREENS)
fs.mkdirSync(outDir, { recursive: true })

async function shoot(w, h, name) {
  const file = path.join(outDir, `${name}-${w}x${h}.png`)
  fs.rmSync(file, { force: true })
  const url = `http://localhost:5199/admin-frame.html?w=${w}&h=${h}&click=${encodeURIComponent(SCREENS[name])}`
  spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--user-data-dir=${path.join(outDir, '.chrome', `${name}-${w}`)}`,
    `--window-size=${Math.max(w, 600)},${h}`, '--virtual-time-budget=8000',
    `--screenshot=${file}`, url,
  ], { stdio: 'ignore', detached: true }).unref()
  for (let i = 0; i < 120 && !fs.existsSync(file); i++) await new Promise(r => setTimeout(r, 500))
  await new Promise(r => setTimeout(r, 300))
  console.log(fs.existsSync(file) ? `ok   ${file}` : `FAIL ${file}`)
}

;(async () => {
  for (const [w, h] of sizes) for (const name of names) await shoot(w, h, name)
  fs.rmSync(path.join(outDir, '.chrome'), { recursive: true, force: true })
})()
```

- [ ] **Step 3: 미리보기 서버를 켠다**

Run (백그라운드): `npx vite --port 5199 --strictPort`

Expected: `Local: http://localhost:5199/` 출력

- [ ] **Step 4: PC 기준 화면을 찍는다**

`class-menu`, `team-menu`, `spectate-menu`는 모바일 전용이라 PC 목록에서 뺀다. `cash`는 PC 동작 확인을 위해 포함한다.

Run: `node "$SCRATCH/shots.cjs" "$SCRATCH/baseline" 768x1024,1280x800,1440x900 classes,team,spectate,edit,field,cash,ranking,ranking-player,settings`

Expected: `ok` 27줄

- [ ] **Step 5: 찍은 화면을 눈으로 확인한다**

`$SCRATCH/baseline`의 `spectate-1280x800.png`, `field-1280x800.png`, `ranking-1280x800.png`를 Read로 연다. 빈 화면이나 오류가 있으면 미리보기를 고치고 Step 4를 다시 한다.

- [ ] **Step 6: 같은 화면을 한 번 더 찍어 결과가 일정한지 확인한다**

Run: `node "$SCRATCH/shots.cjs" "$SCRATCH/baseline2" 1280x800 team,ranking`
Run: `sha256sum "$SCRATCH"/baseline/team-1280x800.png "$SCRATCH"/baseline2/team-1280x800.png "$SCRATCH"/baseline/ranking-1280x800.png "$SCRATCH"/baseline2/ranking-1280x800.png`

Expected: 같은 화면끼리 해시가 같다. 다르면 Task 14의 비교는 해시 대신 눈으로 한다.

임시 파일은 커밋하지 않는다.

---

### Task 2: 화면 폭 훅과 테스트 도구

**Files:**
- Create: `src/test-utils/mockViewport.js`
- Create: `src/hooks/useIsAdminMobile.js`
- Test: `src/hooks/useIsAdminMobile.test.js`
- Modify: `src/index.css` (관리자 변수 블록 위 주석)

- [ ] **Step 1: 테스트 도구를 만든다**

`src/test-utils/mockViewport.js`:

```js
import { act } from '@testing-library/react'

// jsdom에는 matchMedia가 없어 관리자 화면 테스트의 폭을 이것으로 흉내 낸다.
export function mockViewport(initialWidth) {
  let width = initialWidth
  const listeners = new Set()

  window.matchMedia = query => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1])
    return {
      media: query,
      get matches() { return width <= max },
      addEventListener: (_, fn) => listeners.add({ fn, max }),
      removeEventListener: (_, fn) => {
        listeners.forEach(entry => { if (entry.fn === fn) listeners.delete(entry) })
      },
    }
  }

  return {
    resize(nextWidth) {
      width = nextWidth
      act(() => listeners.forEach(({ fn, max }) => fn({ matches: width <= max })))
    },
  }
}

export function restoreViewport() {
  delete window.matchMedia
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/hooks/useIsAdminMobile.test.js`:

```js
import { renderHook } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import useIsAdminMobile from './useIsAdminMobile'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

afterEach(restoreViewport)

describe('useIsAdminMobile', () => {
  it('767px은 모바일이다', () => {
    mockViewport(767)
    expect(renderHook(() => useIsAdminMobile()).result.current).toBe(true)
  })

  it('768px은 모바일이 아니다', () => {
    mockViewport(768)
    expect(renderHook(() => useIsAdminMobile()).result.current).toBe(false)
  })

  it('폭이 바뀌면 값도 바뀐다', () => {
    const viewport = mockViewport(1280)
    const { result } = renderHook(() => useIsAdminMobile())
    viewport.resize(390)
    expect(result.current).toBe(true)
    viewport.resize(1280)
    expect(result.current).toBe(false)
  })

  it('matchMedia가 없으면 PC로 판단한다', () => {
    expect(renderHook(() => useIsAdminMobile()).result.current).toBe(false)
  })
})
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/hooks/useIsAdminMobile.test.js`

Expected: FAIL, `Failed to resolve import "./useIsAdminMobile"`

- [ ] **Step 4: 훅을 만든다**

`src/hooks/useIsAdminMobile.js`:

```js
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

function matches() {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/**
 * 관리자 화면이 모바일 폭(767px 이하)인지 알려 준다.
 * 스타일만 다를 때는 쓰지 말고 CSS의 @media를 쓴다.
 */
export default function useIsAdminMobile() {
  const [isMobile, setIsMobile] = useState(matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(QUERY)
    const handleChange = event => setIsMobile(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/hooks/useIsAdminMobile.test.js`

Expected: PASS, 4 tests

- [ ] **Step 6: 기준값 주석을 더한다**

`src/index.css`의 `/* --admin-* 변수는 admin-mode 전체 화면뿐 아니라,` 주석 바로 위에 넣는다.

```css
/* 관리자 화면의 모바일 기준: 767px 이하가 모바일, 768px 이상이 PC·태블릿이다.
   CSS 변수는 @media 조건에 쓸 수 없어 각 CSS에 @media (max-width: 767px)로
   직접 적고, 컴포넌트를 나눌 때는 useIsAdminMobile 훅을 쓴다. */
```

- [ ] **Step 7: 커밋한다**

```bash
git add src/test-utils/mockViewport.js src/hooks/useIsAdminMobile.js src/hooks/useIsAdminMobile.test.js src/index.css
git commit -m "feat: add admin mobile viewport hook"
```

---

### Task 3: 메뉴 목록 분리와 하단 탭바

**Files:**
- Create: `src/components/admin/adminNavItems.js`
- Create: `src/components/admin/AdminBottomNav.jsx`, `src/components/admin/AdminBottomNav.module.css`
- Test: `src/components/admin/AdminBottomNav.test.jsx`
- Modify: `src/components/admin/AdminSidebar.jsx`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/admin/AdminBottomNav.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminBottomNav from './AdminBottomNav'

describe('AdminBottomNav', () => {
  it('탭 4개만 보여 주고 분석 메뉴는 보여 주지 않는다', () => {
    render(<AdminBottomNav activeSection="classes" onNavigate={vi.fn()} teamStatusDisabled={false} />)
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['수업 목록', '팀 현황', '랭킹 보기', '설정'])
  })

  it('수업을 고르기 전에는 팀 현황과 랭킹 보기를 누를 수 없다', () => {
    render(<AdminBottomNav activeSection="classes" onNavigate={vi.fn()} teamStatusDisabled />)
    expect(screen.getByRole('button', { name: '팀 현황' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '랭킹 보기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '설정' })).toBeEnabled()
  })

  it('탭을 누르면 onNavigate를 부르고, 현재 탭을 표시한다', async () => {
    const onNavigate = vi.fn()
    render(<AdminBottomNav activeSection="settings" onNavigate={onNavigate} teamStatusDisabled={false} />)
    expect(screen.getByRole('button', { name: '설정' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))
    expect(onNavigate).toHaveBeenCalledWith('ranking')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/admin/AdminBottomNav.test.jsx`

Expected: FAIL, `Failed to resolve import "./AdminBottomNav"`

- [ ] **Step 3: 메뉴 목록을 옮긴다**

`src/components/admin/adminNavItems.js`:

```js
// needsClass: 수업을 고르기 전에는 누를 수 없다. mobile: false: 모바일 탭바에서 숨긴다.
export const NAV_ITEMS = [
  { key: 'classes', label: '수업 목록', icon: '/icons/IconClasses.png' },
  { key: 'team-status', label: '팀 현황', icon: '/icons/IconTeams.png', needsClass: true },
  { key: 'ranking', label: '랭킹 보기', icon: '/icons/IconRankings.png', needsClass: true },
  // 설문 응답 원본을 다루므로 마스터 관리자에게만 보인다.
  { key: 'responses', label: '테스트 분석', icon: '/icons/assignment.png', superOnly: true, mobile: false },
  // 모든 수업의 참가자 결과를 보여 주므로 마찬가지로 마스터 관리자 전용이다.
  { key: 'all-results', label: '게임 분석', icon: '/icons/IconGame.svg', superOnly: true, mobile: false },
  { key: 'settings', label: '설정', icon: '/icons/IconSettings.png' },
]
```

`src/components/admin/AdminSidebar.jsx`에서 `const NAV_ITEMS = [ ... ]` 블록을 지우고 맨 위 import에 더한다.

```jsx
import { NAV_ITEMS } from './adminNavItems'
```

같은 파일의 비활성화 줄을 바꾼다.

```jsx
const disabled = item.needsClass ? teamStatusDisabled : false
```

- [ ] **Step 4: 탭바를 만든다**

`src/components/admin/AdminBottomNav.jsx`:

```jsx
import { NAV_ITEMS } from './adminNavItems'
import styles from './AdminBottomNav.module.css'

const MOBILE_ITEMS = NAV_ITEMS.filter(item => item.mobile !== false)

export default function AdminBottomNav({ activeSection, onNavigate, teamStatusDisabled }) {
  return (
    <nav className={styles.nav}>
      {MOBILE_ITEMS.map(item => {
        const active = activeSection === item.key
        return (
          <button
            key={item.key}
            type="button"
            className={`${styles.item} ${active ? styles.itemActive : ''}`}
            onClick={() => onNavigate(item.key)}
            disabled={item.needsClass ? teamStatusDisabled : false}
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={styles.icon}
              style={{ WebkitMaskImage: `url(${item.icon})`, maskImage: `url(${item.icon})` }}
              aria-hidden="true"
            />
            <span className={styles.label}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

`src/components/admin/AdminBottomNav.module.css`:

```css
.nav {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--admin-surface);
  border-top: 1px solid var(--admin-border);
}

.item {
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: none;
  font-size: 11px;
  font-weight: 500;
  color: var(--admin-text-2);
}

.item:disabled {
  color: var(--admin-disabled);
  cursor: not-allowed;
}

.itemActive {
  color: var(--admin-blue);
  font-weight: 700;
}

.icon {
  width: 20px;
  height: 20px;
  background-color: var(--admin-text-2);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.itemActive .icon { background-color: var(--admin-blue); }

.item:disabled .icon { background-color: var(--admin-disabled); }

.label { white-space: nowrap; }
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/components/admin/AdminBottomNav.test.jsx src/pages/AdminDashboard.test.jsx`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add src/components/admin/adminNavItems.js src/components/admin/AdminSidebar.jsx src/components/admin/AdminBottomNav.jsx src/components/admin/AdminBottomNav.module.css src/components/admin/AdminBottomNav.test.jsx
git commit -m "feat: add admin bottom navigation"
```

---

### Task 4: 화면 틀과 분석 화면 안내

**Files:**
- Modify: `src/components/admin/AdminShell.jsx`, `src/components/admin/AdminShell.module.css`
- Modify: `src/pages/AdminDashboard.jsx`, `src/pages/AdminDashboard.module.css`
- Test: `src/pages/AdminDashboard.mobile.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/pages/AdminDashboard.mobile.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminDashboard from './AdminDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { SocketProvider } from '../contexts/SocketContext'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})
vi.mock('./AdminResponseAnalytics', () => ({ default: () => <div>테스트 분석 본문</div> }))

function renderDashboard() {
  return render(<SocketProvider><MemoryRouter><AdminDashboard /></MemoryRouter></SocketProvider>)
}

beforeEach(() => {
  setAdminSession('t1', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
})

afterEach(() => {
  restoreViewport()
  clearAdminSession()
  document.body.classList.remove('admin-mode')
})

describe('AdminDashboard 모바일', () => {
  it('마스터 관리자라도 모바일에서는 분석 메뉴가 없고 탭바를 보여 준다', () => {
    mockViewport(390)
    renderDashboard()
    expect(screen.queryByRole('button', { name: '테스트 분석' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '게임 분석' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '메뉴 접기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '설정' })).toBeInTheDocument()
  })

  it('PC에서는 사이드바를 보여 준다', () => {
    mockViewport(1280)
    renderDashboard()
    expect(screen.getByRole('button', { name: '테스트 분석' })).toBeInTheDocument()
    expect(screen.getByText('메뉴 접기')).toBeInTheDocument()
  })

  it('분석 화면을 보다가 좁히면 안내 문구가 나오고, 넓히면 돌아온다', async () => {
    const viewport = mockViewport(1280)
    renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: '테스트 분석' }))
    expect(screen.getByText('테스트 분석 본문')).toBeInTheDocument()

    viewport.resize(390)
    expect(screen.getByText('PC에서 이용해 주세요')).toBeInTheDocument()
    expect(screen.queryByText('테스트 분석 본문')).not.toBeInTheDocument()

    viewport.resize(1280)
    expect(screen.getByText('테스트 분석 본문')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/pages/AdminDashboard.mobile.test.jsx`

Expected: FAIL. 모바일에서도 `테스트 분석` 버튼이 보인다.

- [ ] **Step 3: `AdminShell`을 바꾼다**

`src/components/admin/AdminShell.jsx` 전체:

```jsx
import AdminSidebar from './AdminSidebar'
import AdminBottomNav from './AdminBottomNav'
import useIsAdminMobile from '../../hooks/useIsAdminMobile'
import styles from './AdminShell.module.css'

export default function AdminShell({ activeSection, onNavigate, teamStatusDisabled, isSuper, children }) {
  const isMobile = useIsAdminMobile()

  return (
    <div className={`${styles.shell} ${isMobile ? styles.shellMobile : ''}`}>
      {!isMobile && (
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={onNavigate}
          teamStatusDisabled={teamStatusDisabled}
          isSuper={isSuper}
        />
      )}
      <div className={styles.main}>{children}</div>
      {isMobile && (
        <AdminBottomNav
          activeSection={activeSection}
          onNavigate={onNavigate}
          teamStatusDisabled={teamStatusDisabled}
        />
      )}
    </div>
  )
}
```

`src/components/admin/AdminShell.module.css` 끝에 더한다.

```css
.shellMobile { flex-direction: column; }

.shellMobile .main { height: auto; min-height: 0; }
```

- [ ] **Step 4: `AdminDashboard`에 안내 문구를 넣는다**

`src/pages/AdminDashboard.jsx` import에 더한다.

```jsx
import useIsAdminMobile from '../hooks/useIsAdminMobile'
import styles from './AdminDashboard.module.css'
```

`export default function` 위에 더한다.

```jsx
const DESKTOP_ONLY_SECTIONS = ['responses', 'all-results']
```

`useState` 선언들 아래에 더한다.

```jsx
const isMobile = useIsAdminMobile()
// section은 그대로 두어, 창을 다시 넓히면 보던 화면으로 돌아온다.
const desktopOnly = isMobile && DESKTOP_ONLY_SECTIONS.includes(section)
```

두 분석 화면 줄을 바꾼다.

```jsx
{desktopOnly && <p className={styles.desktopOnly}>PC에서 이용해 주세요</p>}
{!desktopOnly && section === 'responses' && profile.isSuper && <AdminResponseAnalytics />}
{!desktopOnly && section === 'all-results' && profile.isSuper && <AdminAllResults />}
```

`src/pages/AdminDashboard.module.css` 끝에 더한다.

```css
.desktopOnly {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--admin-text-2);
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/pages/AdminDashboard.mobile.test.jsx src/pages/AdminDashboard.test.jsx`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add src/components/admin/AdminShell.jsx src/components/admin/AdminShell.module.css src/pages/AdminDashboard.jsx src/pages/AdminDashboard.module.css src/pages/AdminDashboard.mobile.test.jsx
git commit -m "feat: swap admin sidebar for bottom nav on mobile"
```

---

### Task 5: `⋯` 메뉴

**Files:**
- Create: `src/components/admin/AdminOverflowMenu.jsx`, `src/components/admin/AdminOverflowMenu.module.css`
- Test: `src/components/admin/AdminOverflowMenu.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/admin/AdminOverflowMenu.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminOverflowMenu from './AdminOverflowMenu'

const open = () => userEvent.click(screen.getByRole('button', { name: '수업 메뉴' }))

describe('AdminOverflowMenu', () => {
  it('처음에는 닫혀 있고, 누르면 항목이 보인다', async () => {
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    await open()
    expect(screen.getByRole('menuitem', { name: 'QR 코드' })).toBeInTheDocument()
  })

  it('항목을 고르면 닫고 onSelect를 부른다', async () => {
    const onSelect = vi.fn()
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect }]} />)
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'QR 코드' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('위험 항목은 넘긴 순서와 상관없이 맨 아래에 둔다', async () => {
    render(
      <AdminOverflowMenu
        label="수업 메뉴"
        items={[
          { key: 'delete', label: '삭제', danger: true, onSelect: vi.fn() },
          { key: 'qr', label: 'QR 코드', onSelect: vi.fn() },
        ]}
      />
    )
    await open()
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['QR 코드', '삭제'])
  })

  it('비활성 항목은 누를 수 없다', async () => {
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'delete', label: '삭제', disabled: true, onSelect: vi.fn() }]} />)
    await open()
    expect(screen.getByRole('menuitem', { name: '삭제' })).toBeDisabled()
  })

  it('바깥을 누르거나 Esc를 누르면 닫힌다', async () => {
    render(
      <div>
        <button type="button">바깥</button>
        <AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />
      </div>
    )
    await open()
    await userEvent.click(screen.getByRole('button', { name: '바깥' }))
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()

    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/admin/AdminOverflowMenu.test.jsx`

Expected: FAIL, `Failed to resolve import "./AdminOverflowMenu"`

- [ ] **Step 3: 메뉴를 만든다**

`src/components/admin/AdminOverflowMenu.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import styles from './AdminOverflowMenu.module.css'

// placement: 화면 아래쪽 버튼에서 열 때는 'up'으로 위로 펼친다.
export default function AdminOverflowMenu({ label, items, placement = 'down' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const ordered = [...items.filter(item => !item.danger), ...items.filter(item => item.danger)]

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className={`${styles.menu} ${placement === 'up' ? styles.menuUp : ''}`}>
          {ordered.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect() }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

`src/components/admin/AdminOverflowMenu.module.css`:

```css
.root { position: relative; flex-shrink: 0; }

.trigger {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--admin-r-sm);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  font-size: 18px;
  font-weight: 700;
  color: var(--admin-text-2);
}

.menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 50;
  min-width: 168px;
  display: flex;
  flex-direction: column;
  padding: 4px;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-r-md);
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.18);
}

.menuUp {
  top: auto;
  bottom: calc(100% + 4px);
}

.item {
  min-height: 44px;
  padding: 0 14px;
  border-radius: var(--admin-r-sm);
  background: none;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
  white-space: nowrap;
}

.item:disabled { color: var(--admin-disabled); cursor: not-allowed; }

/* 되돌릴 수 없는 작업은 선으로 나눠 다른 항목과 구분한다. */
.itemDanger {
  margin-top: 4px;
  border-top: 1px solid var(--admin-border);
  border-radius: 0 0 var(--admin-r-sm) var(--admin-r-sm);
  color: #dc2626;
}

.itemDanger:first-child { margin-top: 0; border-top: none; }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/admin/AdminOverflowMenu.test.jsx`

Expected: PASS, 5 tests

- [ ] **Step 5: 커밋한다**

```bash
git add src/components/admin/AdminOverflowMenu.jsx src/components/admin/AdminOverflowMenu.module.css src/components/admin/AdminOverflowMenu.test.jsx
git commit -m "feat: add admin overflow menu"
```

---

### Task 6: 팀 현황

**Files:**
- Modify: `src/pages/AdminClassDashboard.jsx`, `src/pages/AdminDashboard.module.css`
- Modify: `src/components/admin/AdminStatCards.module.css`, `src/components/admin/AdminGridView.module.css`, `src/components/admin/AdminGridCard.module.css`
- Test: `src/pages/AdminClassDashboard.mobile.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/pages/AdminClassDashboard.mobile.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassDashboard from './AdminClassDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { SocketProvider } from '../contexts/SocketContext'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') } }))
vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}
const ROOMS = [{
  code: 'CD5678', status: 'live', registered: false, prices: PRICES, classId: 'class-1',
  players: [{
    playerUuid: 'p1', name: '홍길동', character: 'Adventurer-강아지', affiliation: '서울중',
    gameState: {
      cash: 15000, job: 'a',
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
      isCompleted: false,
    },
  }],
}]

function renderDashboard() {
  return render(<SocketProvider><AdminClassDashboard classId="class-1" initialName="3학년 2반" /></SocketProvider>)
}

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ROOMS) })
})

afterEach(() => {
  restoreViewport()
  clearAdminSession()
})

describe('AdminClassDashboard 모바일', () => {
  it('보기 탭과 헤더의 개별 버튼을 숨기고 전체 등록은 남긴다', async () => {
    mockViewport(390)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    expect(screen.queryByRole('button', { name: '테이블 뷰' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'QR 코드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전체 삭제' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '전체 등록' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('이름 또는 팀 검색...')).toBeInTheDocument()
  })

  it('표를 보다가 좁히면 그리드가 나오고, 넓히면 표로 돌아온다', async () => {
    const viewport = mockViewport(1280)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    await userEvent.click(screen.getByRole('button', { name: '테이블 뷰' }))
    expect(screen.queryByTestId('admin-player-slot')).not.toBeInTheDocument()

    viewport.resize(390)
    expect(screen.getAllByTestId('admin-player-slot').length).toBeGreaterThan(0)

    viewport.resize(1280)
    expect(screen.queryByTestId('admin-player-slot')).not.toBeInTheDocument()
  })

  it('전체 삭제는 메뉴를 거쳐 확인 창을 띄운다', async () => {
    mockViewport(390)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    await userEvent.click(screen.getByRole('button', { name: '수업 메뉴' }))
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['QR 코드', '만족도 조사', '전체 삭제'])
    await userEvent.click(screen.getByRole('menuitem', { name: '전체 삭제' }))
    expect(screen.getByText(/모든 팀을 삭제하면 되돌릴 수 없습니다/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/pages/AdminClassDashboard.mobile.test.jsx`

Expected: FAIL. 모바일에서도 `테이블 뷰` 버튼이 보인다.

- [ ] **Step 3: 보여 줄 탭 계산을 넣는다**

`src/pages/AdminClassDashboard.jsx` import에 더한다.

```jsx
import AdminOverflowMenu from '../components/admin/AdminOverflowMenu'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
```

`const [activeTab, setActiveTab] = useState('grid')` 아래에 더한다.

```jsx
const isMobile = useIsAdminMobile()
// 모바일은 그리드만 지원한다. activeTab은 그대로 두어 창을 다시 넓히면 보던 탭이 나온다.
const visibleTab = isMobile ? 'grid' : activeTab
```

다음 자리의 `activeTab`을 `visibleTab`으로 바꾼다.

- 결과 불러오기 effect의 조건과 의존성 배열: `if (visibleTab !== 'chart') return`, `[visibleTab, classId, rooms]`
- `activeTab === 'clans' && rooms.length > 0` (배너)
- 아래쪽 `activeTab === 'grid'`, `'table'`, `'chart'`(4곳), `'clans'` 렌더 조건

보기 전환 버튼의 강조(`activeTab === tab.key`)는 PC에서만 보이므로 그대로 둔다.

- [ ] **Step 4: 헤더를 나눈다**

`return (` 바로 위에 더한다.

```jsx
const titleRow = (
  <div className={styles.titleRow}>
    <span className={styles.editIcon} aria-hidden="true">✏️</span>
    <input
      className={styles.titleInput}
      value={name}
      onChange={e => setName(e.target.value)}
      onBlur={handleTitleBlur}
    />
  </div>
)
const searchInput = (
  <input
    className={styles.searchInput}
    placeholder="이름 또는 팀 검색..."
    value={search}
    onChange={e => setSearch(e.target.value)}
  />
)
const bulkRegisterButton = (
  <button
    className={styles.bulkRegisterBtn}
    onClick={() => setConfirmBulkRegister(true)}
    disabled={isBulkRegistering}
    type="button"
  >
    <img src="/icons/IconRegister.png" alt="" className={styles.btnIcon} />
    <span>전체 등록</span>
  </button>
)
```

`<div className={styles.header}> ... </div>` 블록 전체를 바꾼다. PC 쪽 구조는 지금과 같다.

```jsx
{isMobile ? (
  <div className={styles.mobileHeader}>
    <div className={styles.mobileTitleBar}>
      {titleRow}
      <AdminOverflowMenu
        label="수업 메뉴"
        items={[
          { key: 'qr', label: 'QR 코드', onSelect: () => setShowQr(true) },
          { key: 'survey', label: '만족도 조사', onSelect: () => setShowSurveyQr(true) },
          { key: 'delete-all', label: '전체 삭제', danger: true, disabled: rooms.length === 0, onSelect: () => setConfirmDeleteAll(true) },
        ]}
      />
    </div>
    {searchInput}
    {bulkRegisterButton}
  </div>
) : (
  <div className={styles.header}>
    <div>
      {titleRow}
      <p className={styles.subtitle}>진행중인 팀과 완료한 팀을 확인하고 수정할 수 있습니다</p>
    </div>
    <div className={styles.headerActions}>
      {activeTab !== 'clans' && searchInput}
      <div className={styles.viewToggle}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            aria-label={tab.label}
            className={`${styles.viewToggleBtn} ${activeTab === tab.key ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span
              className={styles.viewToggleIcon}
              style={{ WebkitMaskImage: `url(${tab.icon})`, maskImage: `url(${tab.icon})` }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <button className={styles.qrBtn} onClick={() => setShowSurveyQr(true)} type="button">만족도 조사</button>
      <button className={styles.qrBtn} onClick={() => setShowQr(true)} type="button">QR 코드</button>
      <button
        className={styles.deleteAllBtn}
        onClick={() => setConfirmDeleteAll(true)}
        disabled={rooms.length === 0}
        type="button"
      >
        <img src="/icons/IconDelete.png" alt="" className={styles.btnIcon} />
        <span>전체 삭제</span>
      </button>
      {bulkRegisterButton}
    </div>
  </div>
)}
```

- [ ] **Step 5: 스타일을 더한다**

`src/pages/AdminDashboard.module.css` 끝에 더한다. 관전 팝업 규칙도 이 파일에 있다.

```css
.mobileHeader,
.mobileTitleBar { display: flex; }

.mobileHeader { flex-direction: column; gap: 8px; margin-bottom: 16px; }

.mobileTitleBar { align-items: center; gap: 8px; }

@media (max-width: 767px) {
  .page { padding: 16px 16px 24px; }

  .titleRow { flex: 1; min-width: 0; }

  .titleInput { font-size: 18px; max-width: none; min-height: 44px; }

  .searchInput { width: 100%; height: 44px; font-size: 16px; }

  .bulkRegisterBtn { width: 100%; height: 44px; justify-content: center; font-size: 14px; }

  /* 관전 화면은 화면 전체를 덮는다. */
  .spectatePopup {
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
}
```

`src/components/admin/AdminStatCards.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-sm); }

  .card { gap: var(--space-sm); padding: var(--space-sm) var(--space-md); }

  .icon { min-width: 36px; height: 36px; font-size: 16px; }

  .pendingTag { display: none; }
}
```

`src/components/admin/AdminGridView.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }

  .createCard { min-height: 96px; }
}
```

`src/components/admin/AdminGridCard.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .tab { min-height: 44px; min-width: 44px; }
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/pages/AdminClassDashboard.mobile.test.jsx src/pages/AdminClassDashboard.test.jsx src/components/admin/AdminGridView.test.jsx src/components/admin/AdminGridCard.test.jsx`

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add src/pages/AdminClassDashboard.jsx src/pages/AdminClassDashboard.mobile.test.jsx src/pages/AdminDashboard.module.css src/components/admin/AdminStatCards.module.css src/components/admin/AdminGridView.module.css src/components/admin/AdminGridCard.module.css
git commit -m "feat: adapt team status screen to mobile"
```

---

### Task 7: 관전

**Files:**
- Modify: `src/components/admin/AdminSpectateModal.jsx`, `src/components/admin/AdminSpectateModal.module.css`
- Modify: `src/components/admin/AdminPlayerCard.module.css`
- Test: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 더한다**

`src/components/admin/AdminSpectateModal.test.jsx`의 import를 바꾼다.

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
```

import 아래에 더한다.

```jsx
import { mockViewport, restoreViewport } from '../../test-utils/mockViewport'
```

파일 끝에 더한다.

```jsx
describe('AdminSpectateModal 모바일', () => {
  afterEach(restoreViewport)

  function swipe(fromX, fromY, toX, toY) {
    const target = screen.getByText(/ \/ 2$/)
    fireEvent.touchStart(target, { touches: [{ clientX: fromX, clientY: fromY }] })
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: toX, clientY: toY }] })
  }

  function renderModal(initialIndex = 0, rooms = ROOMS) {
    return render(<AdminSpectateModal rooms={rooms} initialIndex={initialIndex} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  }

  it('왼쪽으로 밀면 다음 팀, 오른쪽으로 밀면 이전 팀으로 간다', () => {
    mockViewport(390)
    renderModal()
    swipe(300, 100, 200, 110)
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    swipe(100, 100, 200, 110)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('세로로 움직이거나 50px보다 짧으면 팀이 바뀌지 않는다', () => {
    mockViewport(390)
    renderModal()
    swipe(300, 100, 200, 300)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    swipe(300, 100, 260, 100)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('첫 팀과 마지막 팀에서는 더 넘어가지 않는다', () => {
    mockViewport(390)
    renderModal()
    swipe(100, 100, 300, 100)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    swipe(300, 100, 100, 100)
    swipe(300, 100, 100, 100)
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('다른 창이 열려 있으면 넘겨지지 않는다', async () => {
    mockViewport(390)
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: '가격 설정' }))
    swipe(300, 100, 100, 100)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('PC에서는 넘겨지지 않는다', () => {
    mockViewport(1280)
    renderModal()
    swipe(300, 100, 100, 100)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('삭제와 자세히 보기는 메뉴 안에 있고, 삭제는 확인 창을 거친다', async () => {
    mockViewport(390)
    renderModal()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '자세히 보기' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '팀 메뉴' }))
    const labels = screen.getAllByRole('menuitem').map(el => el.textContent)
    expect(labels).toEqual(['자세히 보기', '직접 등록하기', '삭제'])
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(screen.getByText('팀 삭제')).toBeInTheDocument()
  })

  it('등록된 팀은 메뉴에 공유 항목이 있고 가격 설정 버튼이 없다', async () => {
    mockViewport(390)
    const rooms = [{ ...ROOMS[0], registered: true, sessionId: 's1' }, ROOMS[1]]
    renderModal(0, rooms)
    expect(screen.queryByRole('button', { name: '가격 설정' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '팀 메뉴' }))
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['카카오 공유', '링크 복사', '자세히 보기', '삭제'])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx -t "모바일"`

Expected: FAIL. 넘겨도 `1 / 2`로 남고 `팀 메뉴` 버튼이 없다.

- [ ] **Step 3: 넘기기를 넣는다**

`src/components/admin/AdminSpectateModal.jsx` import에 더한다.

```jsx
import AdminOverflowMenu from './AdminOverflowMenu'
import useIsAdminMobile from '../../hooks/useIsAdminMobile'
```

`const POLL_INTERVAL_MS = 3000` 아래에 더한다.

```jsx
const SWIPE_MIN_PX = 50
```

`const pollTimer = useRef(null)` 아래에 더한다.

```jsx
const isMobile = useIsAdminMobile()
const touchStart = useRef(null)
const hasOpenLayer = Boolean(confirmDelete || kickTarget || confirmRegister || showPriceModal || showDetail || showAddPlayer)
```

`handleRegister` 함수 아래에 더한다.

```jsx
function handleTouchStart(event) {
  // 팀 이름을 고치거나 다른 창을 쓰는 중에는 손가락 움직임을 넘기기로 보지 않는다.
  if (!isMobile || hasOpenLayer || event.target.closest('input')) {
    touchStart.current = null
    return
  }
  const { clientX, clientY } = event.touches[0]
  touchStart.current = { x: clientX, y: clientY }
}

function handleTouchEnd(event) {
  const start = touchStart.current
  touchStart.current = null
  if (!start) return
  const { clientX, clientY } = event.changedTouches[0]
  const dx = clientX - start.x
  const dy = clientY - start.y
  // 세로 스크롤 중에 팀이 바뀌지 않도록 가로 이동이 더 클 때만 넘긴다.
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return
  const next = rooms[dx < 0 ? index + 1 : index - 1]
  if (next) setCurrentCode(next.code)
}
```

맨 바깥 `<div className={styles.page}>`를 바꾼다.

```jsx
<div className={styles.page} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
```

- [ ] **Step 4: 하단 버튼을 나눈다**

`if (editingPlayerUuid) {` 블록 아래에 더한다.

```jsx
const priceButton = !room.registered && (
  <button type="button" className={styles.priceBtn} onClick={() => setShowPriceModal(true)}>가격 설정</button>
)
const registerButton = room.status === 'completed-but-unregistered' && (
  <button type="button" className={styles.registerBtn} onClick={() => setConfirmRegister(true)}>결과 등록</button>
)
const canAddPlayer = !room.registered && room.players.length < 4
const menuItems = [
  ...(canShare ? [
    { key: 'kakao', label: '카카오 공유', onSelect: () => setShareNotice(shareGameResultToKakao(room.sessionId)) },
    { key: 'link', label: '링크 복사', onSelect: async () => setShareNotice(await copyGameResultLink(room.sessionId)) },
  ] : []),
  { key: 'detail', label: '자세히 보기', onSelect: () => setShowDetail(true) },
  ...(canAddPlayer ? [{ key: 'add', label: '직접 등록하기', onSelect: () => setShowAddPlayer(true) }] : []),
  { key: 'delete', label: '삭제', danger: true, onSelect: () => setConfirmDelete(true) },
]
```

`<div className={styles.actions}> ... </div>` 블록 전체를 바꾼다.

```jsx
{isMobile ? (
  <div className={styles.actions}>
    {priceButton}
    {registerButton}
    <AdminOverflowMenu label="팀 메뉴" placement="up" items={menuItems} />
  </div>
) : (
  <div className={styles.actions}>
    {priceButton}
    {registerButton}
    {canShare && (
      <button
        type="button"
        className={`${styles.shareIconBtn} ${styles.kakaoIconBtn}`}
        onClick={() => setShareNotice(shareGameResultToKakao(room.sessionId))}
        aria-label="카카오톡 공유하기"
      >
        <img className={styles.shareIconImg} src="/icons/mode_comment.png" alt="" aria-hidden="true" />
      </button>
    )}
    {canShare && (
      <button
        type="button"
        className={styles.shareIconBtn}
        onClick={async () => setShareNotice(await copyGameResultLink(room.sessionId))}
        aria-label="링크 복사하기"
      >
        <img className={styles.shareIconImg} src="/icons/link_2.png" alt="" aria-hidden="true" />
      </button>
    )}
    <button type="button" className={styles.detailBtn} onClick={() => setShowDetail(true)}>자세히 보기</button>
    {canAddPlayer && (
      <button type="button" className={styles.addPlayerBtn} onClick={() => setShowAddPlayer(true)}>직접 등록하기</button>
    )}
    <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
  </div>
)}
```

- [ ] **Step 5: 스타일을 더한다**

`src/components/admin/AdminSpectateModal.module.css`에서 다음 블록을 지운다. 461~767px에서 두 칸의 최소 폭 때문에 넘치므로 파일 끝의 모바일 규칙으로 옮긴다.

```css
@media (max-width: 460px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

파일 끝에 더한다.

```css
@media (max-width: 767px) {
  .page { touch-action: pan-y; }

  .nav { padding: 12px 12px 8px; }

  .navArrow { width: 44px; height: 44px; border-radius: 22px; }

  .teamNameInput { font-size: 18px; }

  .dots { padding: 0 12px 8px; }

  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 0 12px 4px;
  }

  .actions {
    align-items: center;
    gap: 8px;
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
  }

  .priceBtn,
  .registerBtn { flex: 1; min-width: 0; padding: 0 8px; }

  /* 버튼이 하나도 없을 때도 메뉴를 오른쪽 끝에 둔다. */
  .actions > :last-child { margin-left: auto; }
}
```

`src/components/admin/AdminPlayerCard.module.css` 끝에 더한다. 두 칸에서는 버튼 3개가 이름 옆에 들어가지 않으므로 다음 줄로 내린다.

```css
@media (max-width: 767px) {
  .card { padding: 12px; }

  .header { flex-wrap: wrap; gap: 8px 4px; }

  .identity { flex: 1 1 calc(100% - 52px); }

  .editBtn,
  .reportBtn,
  .kickBtn {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
    padding: 0 4px;
    white-space: nowrap;
  }
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/components/admin/AdminSpectateModal.test.jsx src/components/admin/AdminPlayerCard.test.jsx`

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.module.css src/components/admin/AdminSpectateModal.test.jsx src/components/admin/AdminPlayerCard.module.css
git commit -m "feat: make spectate modal full screen with swipe on mobile"
```

---

### Task 8: 항목 수정 시트와 키패드

키패드는 현재 값에서 시작한다. 플레이어 화면의 `QuantitySelector`, `AdminAddPlayerModal`과 같고, 키패드에 `초기화` 버튼이 있다.

**Files:**
- Modify: `src/components/admin/CashEditModal.jsx`, `src/components/admin/AssetQtyStepper.jsx`, `src/components/admin/FieldEditModal.module.css`
- Test: `src/components/admin/CashEditModal.test.jsx`, `src/components/admin/AssetQtyStepper.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 더한다**

`src/components/admin/CashEditModal.test.jsx`의 import 아래에 더한다.

```jsx
import { mockViewport, restoreViewport } from '../../test-utils/mockViewport'
```

파일 끝에 더한다.

```jsx
describe('CashEditModal 모바일', () => {
  afterEach(restoreViewport)

  it('입력칸 대신 현재 값에서 시작하는 키패드를 연다', () => {
    mockViewport(390)
    render(<CashEditModal initialValue={125000} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByLabelText('현금')).not.toBeInTheDocument()
    expect(screen.getByTestId('display-value')).toHaveTextContent('125,000')
  })

  it('확인을 누르면 값을 넘기고 닫는다', async () => {
    mockViewport(390)
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<CashEditModal initialValue={12} onConfirm={onConfirm} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledWith(123)
    expect(onClose).toHaveBeenCalled()
  })
})
```

같은 파일의 vitest import에 `afterEach`를 더한다.

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest'
```

`src/components/admin/AssetQtyStepper.test.jsx` 맨 위 import를 확인해 `render`, `screen`, `userEvent`, `describe`, `it`, `expect`, `vi`, `afterEach`가 모두 있게 하고, import 아래에 더한다.

```jsx
import { mockViewport, restoreViewport } from '../../test-utils/mockViewport'
```

파일 끝에 더한다.

```jsx
describe('AssetQtyStepper 모바일', () => {
  afterEach(restoreViewport)

  it('숫자를 누르면 키패드가 열리고, 고른 값을 문자열로 넘기며 최댓값으로 제한한다', async () => {
    mockViewport(390)
    const onChange = vi.fn()
    render(<AssetQtyStepper value="1" onChange={onChange} max={50} label="바이오" />)
    await userEvent.click(screen.getByRole('button', { name: '바이오 수량' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith('19')

    await userEvent.click(screen.getByRole('button', { name: '바이오 수량' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenLastCalledWith('50')
  })

  it('PC에서는 입력칸을 그대로 보여 준다', () => {
    mockViewport(1280)
    render(<AssetQtyStepper value="1" onChange={vi.fn()} max={50} label="바이오" />)
    expect(screen.getByRole('spinbutton', { name: '바이오 수량' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/admin/CashEditModal.test.jsx src/components/admin/AssetQtyStepper.test.jsx`

Expected: FAIL. `display-value`와 `바이오 수량` 버튼을 찾지 못한다.

- [ ] **Step 3: 현금 수정을 바꾼다**

`src/components/admin/CashEditModal.jsx` import에 더한다.

```jsx
import NumberInputModal from '../NumberInputModal'
import useIsAdminMobile from '../../hooks/useIsAdminMobile'
```

`const [display, setDisplay] = useState(String(initialValue ?? 0))` 아래에 더한다.

```jsx
const isMobile = useIsAdminMobile()
```

`const parsedValue = ...` 아래, `return (` 위에 더한다.

```jsx
if (isMobile) {
  return (
    <NumberInputModal
      title="현금"
      initialValue={initialValue}
      unit="원"
      maxValue={MAX_CASH}
      onConfirm={value => { onConfirm(value); onClose() }}
      onClose={onClose}
    />
  )
}
```

- [ ] **Step 4: 수량 조절을 바꾼다**

`src/components/admin/AssetQtyStepper.jsx` 전체:

```jsx
import { useState } from 'react'
import NumberInputModal from '../NumberInputModal'
import useIsAdminMobile from '../../hooks/useIsAdminMobile'
import styles from './FieldEditModal.module.css'

export default function AssetQtyStepper({ value, onChange, max, label }) {
  const numValue = Number(value) || 0
  const isMobile = useIsAdminMobile()
  const [showKeypad, setShowKeypad] = useState(false)

  return (
    <div className={`${styles.qtyBox} ${numValue > 0 ? styles.qtyBoxActive : ''}`}>
      <button
        type="button"
        className={styles.qtyMinusBtn}
        onClick={() => onChange(String(Math.max(0, numValue - 1)))}
        disabled={numValue <= 0}
        aria-label={`${label} 수량 감소`}
      >
        −
      </button>
      {isMobile ? (
        <button
          type="button"
          className={styles.qtyInput}
          aria-label={`${label} 수량`}
          onClick={() => setShowKeypad(true)}
        >
          {numValue}
        </button>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          className={styles.qtyInput}
          value={value}
          aria-label={`${label} 수량`}
          onChange={e => onChange(e.target.value)}
        />
      )}
      <button
        type="button"
        className={styles.qtyPlusBtn}
        onClick={() => onChange(String(Math.min(max, numValue + 1)))}
        disabled={numValue >= max}
        aria-label={`${label} 수량 증가`}
      >
        +
      </button>
      {showKeypad && (
        <NumberInputModal
          title={`${label} 수량`}
          initialValue={numValue}
          maxValue={max}
          onConfirm={next => { onChange(String(next)); setShowKeypad(false) }}
          onClose={() => setShowKeypad(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: 시트 스타일을 더한다**

`src/components/admin/FieldEditModal.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .overlay { align-items: flex-end; padding: 0; }

  .sheet {
    width: 100%;
    max-height: 90dvh;
    border-radius: 24px 24px 0 0;
  }

  .header { padding: 14px 16px 10px; }

  .title { font-size: 20px; }

  .closeBtn { width: 44px; height: 44px; border-radius: 22px; }

  .body { padding: 12px 16px; }

  .footer { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }

  .pickerGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

  .pickerTile { padding: 14px 8px; gap: 8px; min-height: 44px; }

  .pickerIcon { width: 40px; height: 40px; }

  .pickerLabel { font-size: 14px; }

  .assetGrid { grid-template-columns: minmax(0, 1fr); gap: 8px; }

  .qtyBox { height: 56px; border-radius: 28px; }

  .qtyMinusBtn,
  .qtyPlusBtn { width: 44px; height: 44px; border-radius: 22px; font-size: 20px; }
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/components/admin/CashEditModal.test.jsx src/components/admin/AssetQtyStepper.test.jsx src/components/admin/StockEditModal.test.jsx src/components/admin/RealEstateEditModal.test.jsx src/components/admin/AdminEditModal.test.jsx`

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add src/components/admin/CashEditModal.jsx src/components/admin/CashEditModal.test.jsx src/components/admin/AssetQtyStepper.jsx src/components/admin/AssetQtyStepper.test.jsx src/components/admin/FieldEditModal.module.css
git commit -m "feat: use bottom sheets and keypad for admin field edits on mobile"
```

---

### Task 9: 나머지 창 스타일

CSS만 바뀌므로 자동 테스트를 더하지 않는다. Task 14의 스크린샷으로 확인한다.

**Files:**
- Modify: `src/components/admin/AdminEditModal.module.css`, `AdminPriceSettingModal.module.css`, `AdminTeamAssetsModal.module.css`, `PlayerAssetReceipt.module.css`, `AdminAddPlayerModal.module.css`, `ConfirmDialog.module.css`, `ClassQRModal.module.css` (모두 `src/components/admin/`)

- [ ] **Step 1: 학생 정보 화면**

`src/components/admin/AdminEditModal.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .header { gap: 8px; padding: 10px 12px; }

  .backBtn { height: 44px; border-radius: 22px; }

  .closeBtn { width: 44px; height: 44px; border-radius: 22px; }

  .name { font-size: 17px; }

  .columns { padding: 12px; gap: 8px; }

  .column { gap: 8px; }

  .editBtn { min-height: 44px; min-width: 56px; }

  .footer { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }

  .footerValue { font-size: 22px; }
}
```

- [ ] **Step 2: 가격 설정**

`src/components/admin/AdminPriceSettingModal.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .overlay { align-items: flex-end; padding: 0; }

  .sheet {
    width: 100%;
    max-height: 90dvh;
    border: none;
    border-radius: 24px 24px 0 0;
  }

  .header { padding: 8px 16px; }

  .backBtn { min-height: 44px; }

  .title { font-size: 18px; }

  .resetBtn { height: 44px; border-radius: 22px; }

  .tab { min-height: 44px; padding: 10px 0; font-size: 16px; }

  .row { gap: 10px; padding: 12px 16px; }

  .pricePill { min-width: 0; min-height: 44px; padding: 8px 12px; font-size: 14px; }

  .footer { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }

  .confirmBtn { max-width: none; height: 48px; font-size: 16px; }
}
```

- [ ] **Step 3: 자세히 보기**

가로로 넘기던 영수증을 세로로 쌓는다. 모바일에서 의도하지 않은 가로 스크롤을 없애기 위해서다.

`src/components/admin/AdminTeamAssetsModal.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .overlay { align-items: flex-end; padding: 0; }

  .panel {
    width: 100%;
    max-height: 90dvh;
    border-radius: 24px 24px 0 0;
  }

  .header { padding: 10px 16px; }

  .closeBtn { width: 44px; height: 44px; border-radius: 22px; }

  .strip {
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    padding: 12px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .actions { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }

  .footerCloseBtn { width: 100%; }
}
```

`src/components/admin/PlayerAssetReceipt.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .receipt {
    flex: none;
    width: 100%;
    min-width: 0;
    max-width: none;
    align-self: stretch;
  }
}
```

- [ ] **Step 4: 직접 등록하기**

`src/components/admin/AdminAddPlayerModal.module.css`의 `@media (max-width: 480px)` 블록 전체를 다음으로 바꾼다.

```css
@media (max-width: 767px) {
  .overlay {
    align-items: flex-end;
    padding: 0;
    background: rgba(15, 23, 42, 0.45);
  }

  .frame {
    width: 100%;
    height: 90dvh;
    min-height: 0;
    border-radius: 24px 24px 0 0;
    box-shadow: none;
  }
}
```

- [ ] **Step 5: 가운데 팝업 폭 제한**

`src/components/admin/ConfirmDialog.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .overlay { padding: 16px; }

  .card {
    width: min(420px, calc(100vw - 32px));
    padding: 24px 20px 20px;
  }
}
```

`src/components/admin/ClassQRModal.module.css` 끝에 더한다. `SurveyQRModal`도 이 파일을 쓴다.

```css
@media (max-width: 767px) {
  .modal { width: min(330px, calc(100vw - 32px)); }

  .close { top: 6px; right: 6px; width: 44px; height: 44px; }
}
```

- [ ] **Step 6: 관련 테스트를 확인한다**

Run: `npx vitest run src/components/admin`

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add src/components/admin/AdminEditModal.module.css src/components/admin/AdminPriceSettingModal.module.css src/components/admin/AdminTeamAssetsModal.module.css src/components/admin/PlayerAssetReceipt.module.css src/components/admin/AdminAddPlayerModal.module.css src/components/admin/ConfirmDialog.module.css src/components/admin/ClassQRModal.module.css
git commit -m "feat: adapt remaining admin modals to mobile"
```

---

### Task 10: 수업 목록

**Files:**
- Modify: `src/pages/AdminClassList.jsx`, `src/pages/AdminClassList.module.css`
- Test: `src/pages/AdminClassList.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 더한다**

`src/pages/AdminClassList.test.jsx`의 import 아래에 더한다.

```jsx
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'
```

파일 끝에 더한다.

```jsx
describe('AdminClassList 모바일', () => {
  afterEach(restoreViewport)

  function renderList() {
    return render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
  }

  it('행의 버튼 3개를 메뉴로 옮기고, 미배정 수업에는 메뉴를 두지 않는다', async () => {
    mockViewport(390)
    renderList()
    await screen.findByText('3학년 2반')
    expect(screen.queryByRole('button', { name: 'QR' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3학년 2반 메뉴' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '미배정 수업 메뉴' })).not.toBeInTheDocument()
  })

  it('삭제는 메뉴를 거쳐 확인 창을 띄운다', async () => {
    mockViewport(390)
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: '3학년 2반 메뉴' }))
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['만족도 조사', 'QR', '삭제'])
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(screen.getByText('수업 삭제')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/pages/AdminClassList.test.jsx -t "모바일"`

Expected: FAIL. `QR` 버튼이 보이고 메뉴 버튼이 없다.

- [ ] **Step 3: 행을 나눈다**

`src/pages/AdminClassList.jsx` import에 더한다.

```jsx
import AdminOverflowMenu from '../components/admin/AdminOverflowMenu'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
```

`const [showEmptyNameWarning, ...` 아래에 더한다.

```jsx
const isMobile = useIsAdminMobile()
```

`{cls.id !== 'unassigned' && ( ... )}` 블록을 바꾼다.

```jsx
{cls.id !== 'unassigned' && (isMobile ? (
  <AdminOverflowMenu
    label={`${cls.name} 메뉴`}
    items={[
      { key: 'survey', label: '만족도 조사', onSelect: () => setShowSurveyQr(true) },
      { key: 'qr', label: 'QR', onSelect: () => setQrClass(cls) },
      { key: 'delete', label: '삭제', danger: true, onSelect: () => setDeleteTarget(cls) },
    ]}
  />
) : (
  <>
    <button type="button" className={styles.qrBtn} onClick={() => setShowSurveyQr(true)}>만족도 조사</button>
    <button type="button" className={styles.qrBtn} onClick={() => setQrClass(cls)}>QR</button>
    <button type="button" className={styles.deleteBtn} onClick={() => setDeleteTarget(cls)}>삭제</button>
  </>
))}
```

- [ ] **Step 4: 스타일을 더한다**

`src/pages/AdminClassList.module.css` 끝에 더한다. 이름과 로그아웃은 설정 탭에 있으므로 숨긴다.

```css
@media (max-width: 767px) {
  .page { padding: 16px; }

  .header { margin-bottom: 16px; }

  .headerActions { display: none; }

  .createForm { flex-direction: column; max-width: none; }

  .createInput { flex: none; height: 44px; font-size: 16px; }

  .createBtn { height: 44px; font-size: 14px; }

  .list { max-width: none; }

  .item { padding: 4px 8px 4px 4px; }

  .itemBtn { min-width: 0; }

  .itemName { overflow-wrap: anywhere; }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/pages/AdminClassList.test.jsx`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add src/pages/AdminClassList.jsx src/pages/AdminClassList.module.css src/pages/AdminClassList.test.jsx
git commit -m "feat: adapt class list to mobile"
```

---

### Task 11: `RankingTable`의 두 번째 줄 교체

**Files:**
- Modify: `src/components/RankingTable.jsx`
- Test: `src/components/RankingTable.test.jsx`

- [ ] **Step 1: 실패하는 테스트를 더한다**

`src/components/RankingTable.test.jsx`의 `describe('RankingTable', () => {` 바로 안쪽 첫 줄에 더한다.

```jsx
it('getSub를 넘기면 두 번째 줄을 그 값으로 바꾼다', () => {
  render(<MemoryRouter><RankingTable rows={[{ ...mockRows[0], teamName: '1조' }]} getSub={row => row.teamName} /></MemoryRouter>)
  expect(screen.getByText('1조')).toBeInTheDocument()
  expect(screen.queryByText('1반')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/RankingTable.test.jsx`

Expected: FAIL, `Unable to find an element with the text: 1조`

- [ ] **Step 3: prop을 더한다**

`src/components/RankingTable.jsx`의 함수 선언을 바꾼다.

```jsx
export default function RankingTable({ rows, highlightPlayerUuid, onRowClick, valueKey = 'totalAssets', podium, getSub = row => row.className }) {
```

행의 두 번째 줄을 바꾼다. 고정 줄(`pinnedRow`)은 플레이어 화면 전용이므로 그대로 둔다.

```jsx
<span className={styles.sub}>{getSub(row)}</span>
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/RankingTable.test.jsx`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/components/RankingTable.jsx src/components/RankingTable.test.jsx
git commit -m "feat: allow custom second line in ranking rows"
```

---

### Task 12: 랭킹

**`RankingPodium`은 안에서 순서를 `[1, 0, 2]`로 바꾼다.** 관리자 화면의 `podiumRows`는 이미 바뀐 순서이므로 넘기면 안 된다. `rows.slice(0, 3)`을 넘긴다.

**Files:**
- Modify: `src/pages/AdminRankingView.jsx`, `src/pages/AdminRankingView.module.css`
- Test: `src/pages/AdminRankingView.test.jsx` (새 파일)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/pages/AdminRankingView.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminRankingView from './AdminRankingView'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

const ROWS = ['가나', '다라', '마바', '사아'].map((name, i) => ({
  rank: i + 1, playerUuid: `p${i}`, name, character: 'Innovator-사자', affiliation: '서울중',
  teamName: `${i + 1}조`, teamCode: 'AB1234', className: '3학년 2반',
  cash: 100, stockValue: 200, realEstateValue: 300, netWorth: 600, totalAssets: 1000 - i,
  stockHoldings: {}, realEstateHoldings: {}, badges: [false, false, false, false, false, false],
  stockPrices: {}, realEstatePrices: {},
}))

function renderView() {
  return render(<AdminRankingView classId="class-1" classDisplayName="3학년 2반" onGoToTeamStatus={vi.fn()} />)
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ROWS) })
})

afterEach(restoreViewport)

describe('AdminRankingView', () => {
  it('PC에서는 표를 보여 준다', async () => {
    mockViewport(1280)
    renderView()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('★ 관리자 모드')).toBeInTheDocument()
  })

  it('모바일에서는 표 없이 팀 이름이 있는 목록과 시상대를 보여 준다', async () => {
    mockViewport(390)
    renderView()
    expect(await screen.findByText('4조')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('★ 관리자 모드')).not.toBeInTheDocument()
    expect(screen.getAllByText('가나')).toHaveLength(2)
  })

  it('시상대 왼쪽은 2위, 가운데는 1위다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    const names = screen.getAllByText(/^(가나|다라|마바)$/).slice(0, 3).map(el => el.textContent)
    expect(names).toEqual(['다라', '가나', '마바'])
  })

  it('검색 중에는 시상대를 숨긴다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    await userEvent.type(screen.getByPlaceholderText('이름 또는 팀 검색...'), '가나')
    await waitFor(() => expect(screen.getAllByText('가나')).toHaveLength(1))
    expect(screen.queryByText('4조')).not.toBeInTheDocument()
  })

  it('줄을 누르면 읽기 전용 학생 정보를 연다', async () => {
    mockViewport(390)
    renderView()
    await userEvent.click(await screen.findByText('4조'))
    expect(screen.getByRole('button', { name: '‹ 뒤로' })).toBeInTheDocument()
    expect(screen.queryByTestId('edit-cash')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/pages/AdminRankingView.test.jsx`

Expected: PASS 1(PC), 나머지 FAIL. 모바일에서도 표가 나온다.

- [ ] **Step 3: 모바일 화면을 나눈다**

`src/pages/AdminRankingView.jsx` import에 더한다.

```jsx
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
```

`export default function` 위에 더한다.

```jsx
const teamLabel = row => row.teamName || row.teamCode
```

`const [viewingPlayer, setViewingPlayer] = useState(null)` 아래에 더한다.

```jsx
const isMobile = useIsAdminMobile()
```

`return (` 바로 위에 더한다.

```jsx
const searchBox = (
  <div className={styles.searchWrap}>
    <svg className={styles.searchIcon} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    <input
      className={styles.searchInput}
      placeholder="이름 또는 팀 검색..."
      value={search}
      onChange={e => setSearch(e.target.value)}
    />
  </div>
)
const categoryTabs = (
  <div className={styles.tabs}>
    {CATEGORY_TABS.map(tab => (
      <button
        key={tab.key}
        type="button"
        className={`${styles.tab} ${category === tab.key ? styles.tabActive : ''}`}
        onClick={() => { setRows([]); setCategory(tab.key) }}
      >
        {tab.label}
      </button>
    ))}
  </div>
)
const statusAndEmpty = (
  <>
    {loading && <p className={styles.message}>불러오는 중...</p>}
    {error && <p className={styles.message}>{error}</p>}
    {!loading && !error && rows.length === 0 && (
      <AdminEmptyState
        icon={EMPTY_ICON}
        tone="blue"
        title="아직 랭킹 정보가 없습니다."
        subtitle="게임 결과가 등록되면 랭킹을 확인할 수 있습니다."
        actionLabel="팀 현황 보기"
        actionVariant="outline"
        onAction={onGoToTeamStatus}
      />
    )}
  </>
)
const playerPopup = viewingPlayer && (
  <div className={styles.overlay} onClick={() => setViewingPlayer(null)}>
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      <AdminEditModal
        player={toAdminPlayer(viewingPlayer)}
        prices={toAdminPrices(viewingPlayer)}
        onClose={() => setViewingPlayer(null)}
        readOnly
      />
    </div>
  </div>
)

if (isMobile) {
  // RankingPodium이 안에서 2·1·3위 순서로 바꾸므로 podiumRows가 아니라 원래 순서를 넘긴다.
  const showPodium = rows.length >= 3 && !search.trim()
  return (
    <div className={styles.page}>
      <div className={styles.mobileHeader}>
        <h1 className={styles.title}>자산 랭킹</h1>
        <p className={styles.subtitle}>{classDisplayName}</p>
        {categoryTabs}
        {searchBox}
      </div>
      <div className={styles.mobileContent}>
        {statusAndEmpty}
        {!loading && !error && rows.length > 0 && (
          <RankingTable
            rows={filteredRows}
            valueKey={valueKey}
            getSub={teamLabel}
            onRowClick={setViewingPlayer}
            podium={showPodium ? <RankingPodium rows={rows.slice(0, 3)} valueKey={valueKey} onRowClick={setViewingPlayer} /> : null}
          />
        )}
      </div>
      {playerPopup}
    </div>
  )
}
```

PC 쪽 JSX에서 중복을 줄인다.

- `<div className={styles.searchWrap}> ... </div>`를 `{searchBox}`로 바꾼다.
- `<div className={styles.tabs}> ... </div>`를 `{categoryTabs}`로 바꾼다.
- `.content` 안의 `loading`, `error`, 빈 상태 세 줄을 `{statusAndEmpty}`로 바꾼다.
- 맨 아래 `{viewingPlayer && ( ... )}`를 `{playerPopup}`로 바꾼다.
- 표의 팀 칸을 `<td className={styles.td}>{teamLabel(row)}</td>`로 바꾼다.

- [ ] **Step 4: 스타일을 더한다**

`src/pages/AdminRankingView.module.css` 끝에 더한다.

```css
.mobileHeader {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 16px 12px;
  background: var(--admin-surface);
  border-bottom: 1px solid var(--admin-border);
}

.mobileContent {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 0;
}

@media (max-width: 767px) {
  /* 분류 탭은 넘치면 가로로 스크롤한다. */
  .tabs {
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 4px 0;
  }

  .tabs::-webkit-scrollbar { display: none; }

  .tab { flex: 1 0 auto; height: 44px; font-size: 13px; }

  .searchWrap { width: 100%; }

  .searchInput { height: 44px; font-size: 16px; }

  /* 학생 정보는 시트로 띄운다. */
  .overlay { align-items: flex-end; }

  .popup {
    width: 100%;
    max-height: 90dvh;
    border-radius: 24px 24px 0 0;
  }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/pages/AdminRankingView.test.jsx src/components/RankingTable.test.jsx src/components/RankingPodium.test.jsx`

Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add src/pages/AdminRankingView.jsx src/pages/AdminRankingView.module.css src/pages/AdminRankingView.test.jsx
git commit -m "feat: show admin ranking as a list on mobile"
```

---

### Task 13: 설정

CSS만 바뀐다.

**Files:**
- Modify: `src/pages/AdminSettings.module.css`

- [ ] **Step 1: 스타일을 더한다**

`src/pages/AdminSettings.module.css` 끝에 더한다.

```css
@media (max-width: 767px) {
  .header { padding: 0 16px; }

  .content { padding: 16px; }

  .card {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    max-width: none;
  }

  .logoutBtn { width: 100%; height: 44px; }
}
```

- [ ] **Step 2: 커밋한다**

```bash
git add src/pages/AdminSettings.module.css
git commit -m "feat: stack admin settings on mobile"
```

---

### Task 14: 전체 확인과 정리

**Files:**
- Delete: `admin-preview.html`, `admin-frame.html`, `src/__adminPreview.jsx`

- [ ] **Step 1: 전체 테스트와 빌드를 돌린다**

Run: `npx vitest run`

Expected: 실패 0개

Run: `npx vite build`

Expected: 오류 없이 완료. `dist/`가 추적 대상이 되지 않는지 `git status --short dist`로 확인한다.

- [ ] **Step 2: PC 화면을 다시 찍어 기준과 비교한다**

Run: `node "$SCRATCH/shots.cjs" "$SCRATCH/after" 768x1024,1280x800,1440x900 classes,team,spectate,edit,field,cash,ranking,ranking-player,settings`

Run:

```bash
cd "$SCRATCH/baseline" && for f in *.png; do cmp -s "$f" "../after/$f" && echo "same $f" || echo "DIFF $f"; done
```

Expected: 모두 `same`. `DIFF`가 있으면 두 파일을 Read로 열어 비교하고, 실제로 달라졌으면 원인을 고친다. Task 1 Step 6에서 해시가 일정하지 않았다면 모든 화면을 눈으로 비교한다.

- [ ] **Step 3: 모바일 화면을 찍는다**

Run: `node "$SCRATCH/shots.cjs" "$SCRATCH/mobile" 390x844,360x800`

Expected: `ok` 24줄

- [ ] **Step 4: 모바일 화면을 한 장씩 확인한다**

각 파일을 Read로 열어 확인한다. 특히 다음을 본다.

- 공통: 가로 스크롤과 잘린 버튼이 없고, 탭바가 내용을 가리지 않는다.
- `spectate`: 360px에서 학생 카드의 버튼 3개가 한 줄에 들어간다.
- `team-menu`, `spectate-menu`, `class-menu`: 삭제가 맨 아래 빨간색이고 메뉴가 잘리지 않는다.
- `field`: 시트의 `확인`이 하단에 보인다.
- `cash`: 키패드가 학생 정보 위에 보인다.
- `ranking`: 시상대가 2·1·3위 순서이고 각 줄에 팀 이름이 보인다.
- `ranking-player`: 학생 정보가 시트로 뜬다.

문제가 있으면 해당 CSS를 고치고 그 화면을 다시 찍는다. 고칠 때마다 PC 규칙을 건드리지 않았는지 확인한다.

- [ ] **Step 5: 고친 것이 있으면 커밋한다**

```bash
git status --short src
git add <Step 4에서 고친 CSS 파일 경로>
git commit -m "fix: resolve admin mobile layout issues from screenshots"
```

고친 것이 없으면 이 단계를 건너뛴다.

- [ ] **Step 6: 임시 파일을 지우고 서버를 끈다**

미리보기 서버(`vite --port 5199`)를 끄고 임시 파일을 지운다.

Run: `rm -f admin-preview.html admin-frame.html src/__adminPreview.jsx`

Run: `git status --short -- src admin-preview.html admin-frame.html`

Expected: 임시 파일이 목록에 없다. `src/.omc/`는 원래 있던 미추적 폴더이므로 그대로 둔다.

- [ ] **Step 7: 마지막으로 전체 테스트를 돌린다**

Run: `npx vitest run`

Expected: 실패 0개

- [ ] **Step 8: 사용자에게 알린다**

실제 휴대폰에서 직접 확인해야 하는 항목을 전달한다.

- 안전 영역: 아이폰 하단 막대가 탭바와 `확인` 버튼을 가리지 않는지
- 넘기기 느낌: 50px 기준이 적당한지, 세로 스크롤 중에 팀이 바뀌지 않는지
- 실제 수업 데이터: 긴 수업 이름과 팀 이름, 큰 금액에서 레이아웃이 깨지지 않는지
- 분석 화면 안내 문구: 자동 테스트로 확인했으며, 실제 브라우저에서 창을 줄여 보면 볼 수 있다
