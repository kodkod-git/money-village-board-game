# 관리자 권한 관리 (소속별 접근 제어) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 로그인/회원가입, 소속(org)을 1급 개체로 등록, 관리자별 소속 접근 제한, 소속별 QR로 소속 입력 없이 참여하는 흐름을 추가한다.

**Architecture:** Supabase에 `admins`/`orgs`/`admin_org_access` 테이블과 `game_sessions.affiliation` 컬럼을 신설한다. 인메모리 room 객체(`server/rooms.js`)에도 `affiliation` 필드를 추가해 진행중인 팀을 소속에 고정한다. 인증은 JWT를 `sessionStorage`에 저장하는 stateless 방식이고, `requireAdmin` 미들웨어 + `hasOrgAccess`로 모든 `/api/admin/*` 라우트에서 서버 측 권한을 강제한다. 기존 `AdminDashboard.jsx`는 로그인 폼 → 소속 리스트업 → 소속별 대시보드(`AdminOrgDashboard.jsx`, 기존 내용 이전)로 이어지는 3단 스위처로 재구성한다.

**Tech Stack:** Express, Supabase(`@supabase/supabase-js`), `bcryptjs`(비밀번호 해시), `jsonwebtoken`(JWT), React, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-27-admin-mode-authority-design.md`

---

## 사전 준비: 브랜치

이 작업은 변경 범위가 크므로 별도 브랜치에서 진행한다.

- [ ] **Step 1: 새 브랜치 생성**

```bash
git checkout -b feat/admin-mode-authority
```

---

### Task 1: Supabase 마이그레이션 (admins / orgs / admin_org_access / game_sessions.affiliation)

**Files:**
- Create: `supabase/migrations/2026-07-27-add-admin-org-tables.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 관리자 권한 관리: 소속(orgs) 등록, 관리자 계정, 관리자-소속 접근 매핑.
-- 이 세 테이블은 서비스 롤 키(server/supabase.js)로만 접근하므로 RLS/공개 정책을 두지 않는다.

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_super BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admin_org_access (
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  PRIMARY KEY (admin_id, org_id)
);

-- 완료된 팀(세션)이 어느 소속인지 저장. 기존 행은 미소속/기타로 취급되도록 빈 문자열 기본값.
ALTER TABLE game_sessions ADD COLUMN affiliation TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 2: Supabase 프로젝트에 마이그레이션 적용**

Supabase 대시보드 SQL 에디터(또는 `supabase db push`가 설정되어 있다면 그 명령)로 위 SQL을 실행한다. 로컬 실행 방법이 없다면 이 저장소의 기존 관례대로 SQL 파일만 커밋하고, 실제 적용은 수동으로 Supabase 콘솔에서 진행한다(`supabase/migrations/2026-07-15-add-booth-values.sql`과 동일한 관례).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/2026-07-27-add-admin-org-tables.sql
git commit -m "feat: add admins/orgs/admin_org_access tables and game_sessions.affiliation"
```

---

### Task 2: 의존성 추가 (bcryptjs, jsonwebtoken)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 설치**

```bash
npm install bcryptjs jsonwebtoken
```

Expected: `package.json`의 `dependencies`에 `"bcryptjs": "^..."`, `"jsonwebtoken": "^..."`가 추가되고 `package-lock.json`이 갱신된다.

- [ ] **Step 2: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs and jsonwebtoken dependencies"
```

---

### Task 3: `server/admins.js` — 관리자 계정 데이터 계층

**Files:**
- Create: `server/admins.js`
- Create: `server/admins.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createAdmin, verifyAdminPassword, seedMasterAdmin } from './admins.js'

beforeEach(() => mockFrom.mockReset())

describe('createAdmin', () => {
  it('비밀번호를 해시해서 저장하고 평문 비밀번호는 반환하지 않는다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'coach1', is_super: false },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const admin = await createAdmin('coach1', 'hunter2')

    expect(admin).toEqual({ id: 'a1', username: 'coach1', isSuper: false })
    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.username).toBe('coach1')
    expect(insertedRow.password_hash).not.toBe('hunter2')
  })
})

describe('verifyAdminPassword', () => {
  it('비밀번호가 맞으면 admin 정보를 반환한다', async () => {
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash('hunter2', 10)
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'coach1', password_hash: passwordHash, is_super: false },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await verifyAdminPassword('coach1', 'hunter2')

    expect(result).toEqual({ id: 'a1', username: 'coach1', isSuper: false })
  })

  it('비밀번호가 틀리면 null을 반환한다', async () => {
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash('hunter2', 10)
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'coach1', password_hash: passwordHash, is_super: false },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await verifyAdminPassword('coach1', 'wrong-password')

    expect(result).toBeNull()
  })

  it('존재하지 않는 아이디면 null을 반환한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await verifyAdminPassword('nobody', 'anything')

    expect(result).toBeNull()
  })
})

describe('seedMasterAdmin', () => {
  it('admin 계정이 이미 있으면 새로 만들지 않는다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'admin', password_hash: 'x', is_super: true },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockInsert = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })

    await seedMasterAdmin()

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('admin 계정이 없으면 is_super=true로 생성한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })

    await seedMasterAdmin()

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ username: 'admin', is_super: true }))
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/admins.test.js`
Expected: FAIL — `server/admins.js` 파일이 없어서 import 에러.

- [ ] **Step 3: 구현 작성**

```js
import bcrypt from 'bcryptjs'
import { supabase } from './supabase.js'

const SALT_ROUNDS = 10
const MASTER_USERNAME = 'admin'
const MASTER_PASSWORD = '0000'

export async function createAdmin(username, password) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const { data, error } = await supabase
    .from('admins')
    .insert({ username, password_hash: passwordHash })
    .select('id, username, is_super')
    .single()
  if (error) throw error
  return { id: data.id, username: data.username, isSuper: data.is_super }
}

export async function findAdminByUsername(username) {
  const { data, error } = await supabase
    .from('admins')
    .select('id, username, password_hash, is_super')
    .eq('username', username)
    .single()
  if (error) return null
  return data
}

export async function verifyAdminPassword(username, password) {
  const admin = await findAdminByUsername(username)
  if (!admin) return null
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return null
  return { id: admin.id, username: admin.username, isSuper: admin.is_super }
}

export async function seedMasterAdmin() {
  const existing = await findAdminByUsername(MASTER_USERNAME)
  if (existing) return
  const passwordHash = await bcrypt.hash(MASTER_PASSWORD, SALT_ROUNDS)
  const { error } = await supabase
    .from('admins')
    .insert({ username: MASTER_USERNAME, password_hash: passwordHash, is_super: true })
  if (error) throw error
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/admins.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/admins.js server/admins.test.js
git commit -m "feat: add admin account data layer (create/verify/seed master)"
```

---

### Task 4: `server/orgs.js` — 소속 데이터 계층

**Files:**
- Create: `server/orgs.js`
- Create: `server/orgs.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createOrg, listOrgsForAdmin, hasOrgAccess, UNASSIGNED_ORG } from './orgs.js'

beforeEach(() => mockFrom.mockReset())

describe('createOrg', () => {
  it('org을 생성하고 생성자에게 접근권을 부여한다', async () => {
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-1', name: '경영학과' }, error: null })
    const mockOrgSelect = vi.fn().mockReturnValue({ single: mockOrgSingle })
    const mockOrgInsert = vi.fn().mockReturnValue({ select: mockOrgSelect })
    const mockAccessInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation(table => {
      if (table === 'orgs') return { insert: mockOrgInsert }
      if (table === 'admin_org_access') return { insert: mockAccessInsert }
      throw new Error(`unexpected table: ${table}`)
    })

    const org = await createOrg('  경영학과  ', 'admin-1')

    expect(mockOrgInsert).toHaveBeenCalledWith({ name: '경영학과', created_by: 'admin-1' })
    expect(mockAccessInsert).toHaveBeenCalledWith({ admin_id: 'admin-1', org_id: 'org-1' })
    expect(org).toEqual({ id: 'org-1', name: '경영학과' })
  })
})

describe('listOrgsForAdmin', () => {
  it('is_super면 전체 소속 + 미소속/기타 가상 항목을 반환한다', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'org-1', name: '경영학과' }], error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const orgs = await listOrgsForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(orgs).toEqual([
      { id: 'org-1', name: '경영학과' },
      { id: 'unassigned', name: UNASSIGNED_ORG },
    ])
  })

  it('일반 관리자는 admin_org_access로 연결된 소속만 반환한다', async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [{ orgs: { id: 'org-1', name: '경영학과' } }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const orgs = await listOrgsForAdmin({ adminId: 'admin-1', isSuper: false })

    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(orgs).toEqual([{ id: 'org-1', name: '경영학과' }])
  })
})

describe('hasOrgAccess', () => {
  it('is_super면 항상 true를 반환한다', async () => {
    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: true }, '아무 소속')
    expect(result).toBe(true)
  })

  it('일반 관리자는 미소속/기타에 접근할 수 없다', async () => {
    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: false }, UNASSIGNED_ORG)
    expect(result).toBe(false)
  })

  it('접근권이 있으면 true를 반환한다', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: [{ orgs: { name: '경영학과' } }], error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: false }, '경영학과')

    expect(result).toBe(true)
  })

  it('접근권이 없으면 false를 반환한다', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: false }, '다른 소속')

    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/orgs.test.js`
Expected: FAIL — `server/orgs.js` 파일이 없어서 import 에러.

- [ ] **Step 3: 구현 작성**

```js
import { supabase } from './supabase.js'

export const UNASSIGNED_ORG = '미소속/기타'

export async function createOrg(name, adminId) {
  const trimmed = name.trim()
  const { data: org, error } = await supabase
    .from('orgs')
    .insert({ name: trimmed, created_by: adminId })
    .select('id, name')
    .single()
  if (error) throw error

  const { error: accessError } = await supabase
    .from('admin_org_access')
    .insert({ admin_id: adminId, org_id: org.id })
  if (accessError) throw accessError

  return org
}

export async function listOrgsForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase.from('orgs').select('id, name').order('name')
    if (error) throw error
    return [...data, { id: 'unassigned', name: UNASSIGNED_ORG }]
  }

  const { data, error } = await supabase
    .from('admin_org_access')
    .select('orgs(id, name)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data.map(row => row.orgs)
}

export async function hasOrgAccess(admin, orgName) {
  if (admin.isSuper) return true
  if (orgName === UNASSIGNED_ORG) return false

  const { data, error } = await supabase
    .from('admin_org_access')
    .select('orgs!inner(name)')
    .eq('admin_id', admin.adminId)
    .eq('orgs.name', orgName)
  if (error) throw error
  return data.length > 0
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/orgs.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/orgs.js server/orgs.test.js
git commit -m "feat: add org (소속) data layer with per-admin access checks"
```

---

### Task 5: `server/adminAuth.js` — JWT 발급 + `requireAdmin` 미들웨어

**Files:**
- Create: `server/adminAuth.js`
- Create: `server/adminAuth.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { signAdminToken, requireAdmin } from './adminAuth.js'

function mockReqRes(headerValue) {
  const req = { get: () => headerValue }
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  return { req, res }
}

describe('signAdminToken / requireAdmin', () => {
  it('유효한 토큰이면 req.admin에 payload를 담고 next를 호출한다', () => {
    const token = signAdminToken({ id: 'a1', username: 'admin', isSuper: true })
    const { req, res } = mockReqRes(`Bearer ${token}`)
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.admin).toMatchObject({ adminId: 'a1', username: 'admin', isSuper: true })
  })

  it('토큰이 없으면 401을 반환한다', () => {
    const { req, res } = mockReqRes('')
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('토큰이 위조되었으면 401을 반환한다', () => {
    const { req, res } = mockReqRes('Bearer not-a-real-token')
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/adminAuth.test.js`
Expected: FAIL — `server/adminAuth.js` 파일이 없어서 import 에러.

- [ ] **Step 3: 구현 작성**

```js
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me'
const TOKEN_EXPIRY = '12h'

export function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, isSuper: admin.isSuper },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

export function requireAdmin(req, res, next) {
  const header = req.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    req.admin = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/adminAuth.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/adminAuth.js server/adminAuth.test.js
git commit -m "feat: add JWT admin token signing and requireAdmin middleware"
```

---

### Task 6: `server/rooms.js` — room에 `affiliation` 필드 추가

**Files:**
- Modify: `server/rooms.js:33-40`
- Modify: `server/rooms.test.js:12-24`

- [ ] **Step 1: 실패하는 테스트 추가**

`server/rooms.test.js`의 `describe('createRoom', ...)` 블록에 아래 두 테스트를 추가한다 (기존 두 `it`은 그대로 둔다):

```js
  it('affiliation을 지정하지 않으면 빈 문자열로 초기화한다', () => {
    const room = createRoom()
    expect(room.affiliation).toBe('')
  })

  it('affiliation을 지정하면 방에 저장한다', () => {
    const room = createRoom({ affiliation: '경영학과' })
    expect(room.affiliation).toBe('경영학과')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL — `room.affiliation`이 `undefined`.

- [ ] **Step 3: 구현 수정**

`server/rooms.js:33-40`을 아래로 교체:

```js
export function createRoom({ affiliation = '' } = {}) {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const now = new Date()
  const room = { code, createdAt: now, updatedAt: now, players: [], prices: defaultPrices(), affiliation }
  rooms.set(code, room)
  return room
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS (모든 테스트, 기존 것 포함)

- [ ] **Step 5: 커밋**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: store affiliation on live room objects"
```

---

### Task 7: `server/db.js` — 완료된 팀에도 `affiliation` 저장/반환

**Files:**
- Modify: `server/db.js:19-21`, `server/db.js:90-95`
- Modify: `server/db.test.js:104-146`, `server/db.test.js:220-262`

- [ ] **Step 1: 기존 테스트 수정 (실패하도록)**

`server/db.test.js`의 `describe('saveGameResult', ...)` 안 room 객체와 단언을 아래로 교체:

```js
    const room = {
      code: 'AB1234',
      prices: PRICES,
      affiliation: '경영학과',
      players: [
        {
          playerUuid: 'p1', name: '홍길동', affiliation: '서울중', character: 'fox',
          gameState: {
            job: 'a', cash: 10000,
            stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
            realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
            badges: [true, true, false, false, false, false],
          },
        },
      ],
    }

    await saveGameResult(room)

    expect(mockSessionInsert).toHaveBeenCalledWith(expect.objectContaining({
      team_code: 'AB1234',
      affiliation: '경영학과',
    }))
    expect(mockResultsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        player_uuid: 'p1',
        stock_value: 4000,
        real_estate_value: 10000,
        total_assets: 24000,
      }),
    ])
```

`describe('getAllCompletedTeams', ...)` 안 `sessions` mock과 기대값을 아래로 교체:

```js
    const sessions = [{
      id: 'session-1', team_code: 'AB1234', created_at: '2026-01-01T00:00:00Z',
      stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
      affiliation: '경영학과',
    }]
```

그리고 `expect(rooms).toEqual([{ ... }])`의 최상위 객체에 `affiliation: '경영학과',`를 `createdAt` 다음 줄에 추가한다:

```js
    expect(rooms).toEqual([{
      code: 'AB1234',
      status: 'completed',
      registered: true,
      createdAt: '2026-01-01T00:00:00Z',
      affiliation: '경영학과',
      prices: { stocks: PRICES.stocks, realEstate: PRICES.realEstate },
      players: [{
        playerUuid: 'p1', name: '김민준', character: 'lion', affiliation: '서울중',
        gameState: {
          cash: 10000, job: 'a',
          stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      }],
    }])
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `saveGameResult`가 `affiliation`을 insert하지 않고, `getAllCompletedTeams` 결과에 `affiliation`이 없음.

- [ ] **Step 3: 구현 수정**

`server/db.js:19-21` (`saveGameResult` 시작부)을 아래로 교체:

```js
export async function saveGameResult(room) {
  const { code, prices, players, affiliation = '' } = room

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      team_code: code,
      stock_prices: prices.stocks,
      real_estate_prices: prices.realEstate,
      affiliation,
    })
    .select('id')
    .single()
```

`server/db.js`의 `getAllCompletedTeams` 안 `return sessions.map(...)` 블록에서 `createdAt: session.created_at,` 다음 줄에 `affiliation: session.affiliation ?? '',`를 추가:

```js
  return sessions.map(session => ({
    code: session.team_code,
    status: 'completed',
    registered: true,
    createdAt: session.created_at,
    affiliation: session.affiliation ?? '',
    prices: { stocks: session.stock_prices, realEstate: session.real_estate_prices },
    players: results
      .filter(r => r.session_id === session.id)
      .map(r => ({
        playerUuid: r.player_uuid,
        name: r.name,
        character: r.character,
        affiliation: r.affiliation,
        gameState: {
          cash: r.cash,
          job: r.job,
          stocks: r.stock_holdings,
          realEstate: r.real_estate_holdings,
          badges: r.badges,
          isCompleted: true,
        },
      })),
  }))
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (모든 테스트)

- [ ] **Step 5: 커밋**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: persist and return affiliation on completed team sessions"
```

---

### Task 8: `server/index.js` — 인증/소속 라우트 배선 + 기존 라우트 권한 적용

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: import 추가**

`server/index.js` 최상단 import 블록에 추가:

```js
import { createAdmin, verifyAdminPassword, seedMasterAdmin } from './admins.js'
import { signAdminToken, requireAdmin } from './adminAuth.js'
import { createOrg, listOrgsForAdmin, hasOrgAccess, UNASSIGNED_ORG } from './orgs.js'
```

- [ ] **Step 2: `POST /api/rooms`를 affiliation 반영하도록 수정**

`server/index.js:26-29`를 아래로 교체:

```js
app.post('/api/rooms', (req, res) => {
  const room = createRoom({ affiliation: req.body?.affiliation ?? '' })
  res.json({ code: room.code })
})
```

- [ ] **Step 3: 회원가입/로그인/소속 라우트 추가**

`app.get('/api/rankings', ...)` 블록과 `app.get('/api/admin/rooms', ...)` 블록 사이에 삽입:

```js
app.post('/api/admin/signup', async (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'username과 password가 필요합니다' })
  }
  try {
    const admin = await createAdmin(username.trim(), password)
    const token = signAdminToken(admin)
    res.json({ token, username: admin.username, isSuper: admin.isSuper })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 존재하는 아이디입니다' })
    console.error('admin signup error:', err)
    res.status(500).json({ error: 'Failed to create admin' })
  }
})

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'username과 password가 필요합니다' })
  }
  const admin = await verifyAdminPassword(username.trim(), password)
  if (!admin) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' })
  const token = signAdminToken(admin)
  res.json({ token, username: admin.username, isSuper: admin.isSuper })
})

app.get('/api/admin/orgs', requireAdmin, async (req, res) => {
  try {
    const orgs = await listOrgsForAdmin(req.admin)
    res.json(orgs)
  } catch (err) {
    console.error('list orgs error:', err)
    res.status(500).json({ error: 'Failed to list orgs' })
  }
})

app.post('/api/admin/orgs', requireAdmin, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name이 필요합니다' })
  try {
    const org = await createOrg(name, req.admin.adminId)
    res.json(org)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 존재하는 소속입니다' })
    console.error('create org error:', err)
    res.status(500).json({ error: 'Failed to create org' })
  }
})

async function findRoomAffiliation(code) {
  const liveRoom = getRoom(code)
  if (liveRoom) return liveRoom.affiliation
  const completed = await getAllCompletedTeams()
  const match = completed.find(r => r.code === code)
  return match ? match.affiliation : null
}
```

- [ ] **Step 4: `GET /api/admin/rooms`를 소속 스코프 + 권한 검사로 교체**

`server/index.js:79-102`(기존 `app.get('/api/admin/rooms', ...)` 전체)를 아래로 교체:

```js
app.get('/api/admin/rooms', requireAdmin, async (req, res) => {
  const { org } = req.query
  if (!org) return res.status(400).json({ error: 'org 쿼리 파라미터가 필요합니다' })

  try {
    const allowed = await hasOrgAccess(req.admin, org)
    if (!allowed) return res.status(403).json({ error: '해당 소속에 접근 권한이 없습니다' })

    const now = new Date()
    const liveRooms = listAllRooms().map(room => ({
      code: room.code,
      status: computeLiveRoomStatus(room, now),
      registered: false,
      updatedAt: room.updatedAt,
      affiliation: room.affiliation,
      prices: room.prices,
      players: room.players.map(p => ({
        playerUuid: p.playerUuid,
        name: p.name,
        character: p.character,
        affiliation: p.affiliation,
        gameState: p.gameState,
      })),
    }))
    const completedRooms = await getAllCompletedTeams()
    const allRooms = [...liveRooms, ...completedRooms]

    const matchesOrg = room => (org === UNASSIGNED_ORG ? !room.affiliation : room.affiliation === org)

    res.json(sortRoomsByRecency(allRooms.filter(matchesOrg)))
  } catch (err) {
    console.error('admin rooms error:', err)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})
```

- [ ] **Step 5: `DELETE`/`PATCH` admin 라우트에 인증 + 권한 검사 추가**

`server/index.js:104-115`(기존 `app.delete('/api/admin/rooms/:code', ...)`)을 아래로 교체:

```js
app.delete('/api/admin/rooms/:code', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const affiliation = await findRoomAffiliation(code)
  if (affiliation === null) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasOrgAccess(req.admin, affiliation || UNASSIGNED_ORG))) {
    return res.status(403).json({ error: '해당 소속에 접근 권한이 없습니다' })
  }

  if (deleteRoomByCode(code)) return res.json({ ok: true })

  try {
    await deleteCompletedTeam(code)
    res.json({ ok: true })
  } catch (err) {
    console.error('admin delete error:', err)
    res.status(404).json({ error: 'Room not found' })
  }
})
```

`server/index.js:117-142`(기존 `app.patch('/api/admin/rooms/:code/players/:playerUuid', ...)`)을 아래로 교체:

```js
app.patch('/api/admin/rooms/:code/players/:playerUuid', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const { playerUuid } = req.params
  const partialGameState = req.body

  const affiliation = await findRoomAffiliation(code)
  if (affiliation === null) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasOrgAccess(req.admin, affiliation || UNASSIGNED_ORG))) {
    return res.status(403).json({ error: '해당 소속에 접근 권한이 없습니다' })
  }

  const room = updatePlayerStateByUuid(code, playerUuid, partialGameState)
  if (room) {
    io.to(code).emit('room-updated', { players: room.players })
    const player = room.players.find(p => p.playerUuid === playerUuid)
    return res.json({
      playerUuid: player.playerUuid,
      name: player.name,
      character: player.character,
      affiliation: player.affiliation,
      gameState: player.gameState,
    })
  }

  try {
    const updatedPlayer = await updateGameResult(code, playerUuid, partialGameState)
    res.json(updatedPlayer)
  } catch (err) {
    console.error('admin patch error:', err)
    res.status(404).json({ error: 'Player not found' })
  }
})
```

- [ ] **Step 6: 서버 기동 시 master 계정 시드**

파일 맨 끝의 `httpServer.listen(PORT, () => console.log(\`Server running on port ${PORT}\`))`를 아래로 교체:

```js
seedMasterAdmin()
  .catch(err => console.error('Failed to seed master admin:', err))
  .finally(() => {
    httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
```

- [ ] **Step 7: `.env`에 JWT secret 추가**

로컬 `.env` 파일에 아래 줄 추가 (커밋되지 않는 파일이므로 직접 추가):

```
ADMIN_JWT_SECRET=<임의의 긴 랜덤 문자열>
```

- [ ] **Step 8: 서버가 정상적으로 뜨는지 수동 확인**

Run: `npm run dev`
Expected: 콘솔에 `Server running on port 3001` 출력, 에러 없음. `curl -X POST http://localhost:3001/api/admin/login -H "Content-Type: application/json" -d '{"username":"admin","password":"0000"}'` 호출 시 `{ token, username: "admin", isSuper: true }` 형태 응답.

- [ ] **Step 9: 커밋**

```bash
git add server/index.js
git commit -m "feat: wire admin auth/org routes and enforce org-scoped access on room routes"
```

---

### Task 9: `src/utils/adminAuth.js` — 프론트 토큰 저장/adminFetch 헬퍼

**Files:**
- Create: `src/utils/adminAuth.js`

- [ ] **Step 1: 구현 작성 (순수 유틸이라 별도 유닛테스트 없이 이후 태스크의 컴포넌트 테스트로 검증)**

```js
const TOKEN_KEY = 'admin_token'
const PROFILE_KEY = 'admin_profile'

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getAdminProfile() {
  const raw = sessionStorage.getItem(PROFILE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function setAdminSession(token, profile) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearAdminSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PROFILE_KEY)
}

export function adminFetch(url, options = {}) {
  const token = getAdminToken()
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/utils/adminAuth.js
git commit -m "feat: add admin session storage and adminFetch helper"
```

---

### Task 10: 소속별 QR 코드 (`QRCodeImage` 일반화 + `OrgQRModal`)

**Files:**
- Modify: `src/components/QRCodeImage.jsx`
- Create: `src/components/admin/OrgQRModal.jsx`
- Create: `src/components/admin/OrgQRModal.module.css`
- Create: `src/components/admin/OrgQRModal.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import OrgQRModal from './OrgQRModal'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}))

describe('OrgQRModal', () => {
  it('소속 이름을 제목에 보여준다', () => {
    render(<OrgQRModal orgName="경영학과" onClose={vi.fn()} />)
    expect(screen.getByText('경영학과 소속 QR 코드')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<OrgQRModal orgName="경영학과" onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })

  it('affiliation 쿼리에 소속 이름을 인코딩한 URL로 QR을 생성한다', async () => {
    const QRCode = (await import('qrcode')).default
    render(<OrgQRModal orgName="경영 학과" onClose={vi.fn()} />)
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining('/join?affiliation=%EA%B2%BD%EC%98%81%20%ED%95%99%EA%B3%BC'),
      expect.anything()
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/components/admin/OrgQRModal.test.jsx`
Expected: FAIL — `OrgQRModal` 파일이 없어서 import 에러.

- [ ] **Step 3: `QRCodeImage`를 `url` prop도 받도록 일반화**

`src/components/QRCodeImage.jsx` 전체를 아래로 교체 (기존 `code` prop 방식과 하위 호환 유지):

```jsx
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function buildJoinUrl(code) {
  const origin = window.location?.origin ?? ''
  return `${origin}/join?code=${encodeURIComponent(code)}`
}

export default function QRCodeImage({ code, url, className }) {
  const target = url ?? buildJoinUrl(code)
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(target, { margin: 1, width: 220 })
      .then(dataUrl => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [target])

  return <img src={src} alt="QR 코드" className={className} />
}
```

- [ ] **Step 4: `OrgQRModal` 구현**

```jsx
import QRCodeImage from '../QRCodeImage'
import styles from './OrgQRModal.module.css'

function buildOrgJoinUrl(orgName) {
  const origin = window.location?.origin ?? ''
  return `${origin}/join?affiliation=${encodeURIComponent(orgName)}`
}

export default function OrgQRModal({ orgName, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">×</button>
        <h2>{orgName} 소속 QR 코드</h2>
        <div className={styles.divider} />
        <p className={styles.subtitle}>스캔하면 소속 입력 없이 바로 참가할 수 있어요</p>
        <QRCodeImage url={buildOrgJoinUrl(orgName)} className={styles.qr} />
      </div>
    </div>
  )
}
```

```css
.overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #1e88e5; border-radius: 14px;
  padding: 28px clamp(20px, 8vw, 32px);
  width: min(330px, calc(100% - 28px));
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
.qr {
  width: min(220px, 70vw);
  height: min(220px, 70vw);
  background: white;
  border-radius: 8px;
  padding: 8px;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/components/admin/OrgQRModal.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 6: 기존 QR 관련 테스트가 깨지지 않았는지 확인**

Run: `npx vitest run src/pages/Lobby.test.jsx`
Expected: PASS (QRCodeImage를 `code` prop으로 쓰는 기존 동작은 그대로 유지됨)

- [ ] **Step 7: 커밋**

```bash
git add src/components/QRCodeImage.jsx src/components/admin/OrgQRModal.jsx src/components/admin/OrgQRModal.module.css src/components/admin/OrgQRModal.test.jsx
git commit -m "feat: add org QR code modal (join link without affiliation input)"
```

---

### Task 11: `src/pages/AdminLogin.jsx` — 로그인/회원가입 폼

**Files:**
- Create: `src/pages/AdminLogin.jsx`
- Create: `src/pages/AdminLogin.module.css`
- Create: `src/pages/AdminLogin.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminLogin from './AdminLogin'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('AdminLogin', () => {
  it('기본으로 로그인하기 버튼을 보여준다', () => {
    render(<AdminLogin onLogin={vi.fn()} />)
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument()
  })

  it('회원가입 탭 클릭 시 회원가입하기 버튼으로 바뀐다', async () => {
    render(<AdminLogin onLogin={vi.fn()} />)
    await userEvent.click(screen.getByText('회원가입'))
    expect(screen.getByRole('button', { name: '회원가입하기' })).toBeInTheDocument()
  })

  it('로그인 성공 시 onLogin을 토큰/프로필과 함께 호출한다', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 't1', username: 'admin', isSuper: true }),
    })
    const onLogin = vi.fn()
    render(<AdminLogin onLogin={onLogin} />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: '0000' }),
    }))
    expect(onLogin).toHaveBeenCalledWith('t1', { username: 'admin', isSuper: true })
  })

  it('로그인 실패 시 에러 메시지를 보여준다', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }),
    })
    render(<AdminLogin onLogin={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))

    expect(await screen.findByText('아이디 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/AdminLogin.test.jsx`
Expected: FAIL — `AdminLogin` 파일이 없어서 import 에러.

- [ ] **Step 3: 구현 작성**

```jsx
import { useState } from 'react'
import styles from './AdminLogin.module.css'

export default function AdminLogin({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const url = mode === 'login' ? '/api/admin/login' : '/api/admin/signup'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    onLogin(data.token, { username: data.username, isSuper: data.isSuper })
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => setMode('login')}
          >
            로그인
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
            onClick={() => setMode('signup')}
          >
            회원가입
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            className={styles.input}
            placeholder="아이디"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className={styles.input}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submitBtn}>
            {mode === 'login' ? '로그인하기' : '회원가입하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

```css
.page {
  width: 100%;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--white);
}
.card {
  width: min(360px, 90vw);
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
}
.tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--divider); }
.tab {
  background: none; border: none; padding: 10px 16px;
  font-size: 14px; font-weight: 700; color: var(--ink-2);
  border-bottom: 2px solid transparent;
}
.tabActive { color: var(--purple); border-bottom-color: var(--purple); }
.input {
  width: 100%; height: 44px; padding: 0 14px; margin-bottom: 12px;
  border: 1px solid var(--line); border-radius: var(--r-sm); font-size: 14px;
}
.error { color: #e53935; font-size: 13px; margin-bottom: 12px; }
.submitBtn {
  width: 100%; height: 46px; border: none; border-radius: var(--r-sm);
  background: var(--purple); color: white; font-size: 15px; font-weight: 700;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/AdminLogin.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminLogin.jsx src/pages/AdminLogin.module.css src/pages/AdminLogin.test.jsx
git commit -m "feat: add admin login/signup form"
```

---

### Task 12: `src/pages/AdminOrgList.jsx` — 소속 리스트업 + 생성 + QR

**Files:**
- Create: `src/pages/AdminOrgList.jsx`
- Create: `src/pages/AdminOrgList.module.css`
- Create: `src/pages/AdminOrgList.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminOrgList from './AdminOrgList'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'

const ORGS = [{ id: 'org-1', name: '경영학과' }, { id: 'unassigned', name: '미소속/기타' }]

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ORGS) })
})

afterEach(() => clearAdminSession())

describe('AdminOrgList', () => {
  it('마운트 시 /api/admin/orgs를 호출해 소속 목록을 보여준다', async () => {
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('경영학과')).toBeInTheDocument()
    expect(screen.getByText('미소속/기타')).toBeInTheDocument()
  })

  it('소속 클릭 시 onSelectOrg를 소속 이름과 함께 호출한다', async () => {
    const onSelectOrg = vi.fn()
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={onSelectOrg} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('경영학과'))
    expect(onSelectOrg).toHaveBeenCalledWith('경영학과')
  })

  it('소속 생성하기로 새 소속을 만들면 목록을 새로고침한다', async () => {
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'org-2', name: '자원경영학과' }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ORGS) })
    })
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('경영학과')
    await userEvent.type(screen.getByPlaceholderText('새 소속 이름'), '자원경영학과')
    await userEvent.click(screen.getByText('소속 생성하기'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/orgs', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '자원경영학과' }),
      }))
    )
  })

  it('로그아웃 버튼 클릭 시 onLogout을 호출한다', async () => {
    const onLogout = vi.fn()
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={vi.fn()} onLogout={onLogout} />)
    await userEvent.click(screen.getByText('로그아웃'))
    expect(onLogout).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/AdminOrgList.test.jsx`
Expected: FAIL — `AdminOrgList` 파일이 없어서 import 에러.

- [ ] **Step 3: 구현 작성**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import OrgQRModal from '../components/admin/OrgQRModal'
import styles from './AdminOrgList.module.css'

export default function AdminOrgList({ profile, onSelectOrg, onLogout }) {
  const [orgs, setOrgs] = useState([])
  const [newOrgName, setNewOrgName] = useState('')
  const [error, setError] = useState('')
  const [qrOrg, setQrOrg] = useState(null)

  const loadOrgs = useCallback(() => {
    adminFetch('/api/admin/orgs')
      .then(r => r.json())
      .then(setOrgs)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadOrgs()
  }, [loadOrgs])

  async function handleCreateOrg(e) {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setError('')
    const res = await adminFetch('/api/admin/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    setNewOrgName('')
    loadOrgs()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>소속 선택</h1>
        <div className={styles.headerActions}>
          <span className={styles.username}>{profile.username}</span>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      <form className={styles.createForm} onSubmit={handleCreateOrg}>
        <input
          className={styles.createInput}
          placeholder="새 소속 이름"
          value={newOrgName}
          onChange={e => setNewOrgName(e.target.value)}
        />
        <button type="submit" className={styles.createBtn}>소속 생성하기</button>
      </form>
      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {orgs.map(org => (
          <li key={org.id} className={styles.item}>
            <button type="button" className={styles.itemBtn} onClick={() => onSelectOrg(org.name)}>
              {org.name}
            </button>
            {org.id !== 'unassigned' && (
              <button type="button" className={styles.qrBtn} onClick={() => setQrOrg(org)}>QR</button>
            )}
          </li>
        ))}
      </ul>

      {qrOrg && <OrgQRModal orgName={qrOrg.name} onClose={() => setQrOrg(null)} />}
    </div>
  )
}
```

```css
.page {
  width: 100%;
  min-height: 100dvh;
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 32px 80px;
  background: var(--white);
}
.header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
.headerActions { display: flex; align-items: center; gap: 12px; }
.username { font-size: 14px; font-weight: 700; color: var(--ink-2); }
.title { font-size: 26px; font-weight: 900; color: var(--ink); }
.logoutBtn {
  background: var(--slot-empty); border: 1px solid var(--line);
  border-radius: var(--r-sm); height: 40px; padding: 0 16px;
  font-size: 13px; font-weight: 700; color: var(--ink-2);
}
.createForm { display: flex; gap: 8px; margin-bottom: 8px; }
.createInput {
  flex: 1; height: 44px; padding: 0 14px;
  border: 1px solid var(--line); border-radius: var(--r-sm); font-size: 14px;
}
.createBtn {
  height: 44px; padding: 0 16px; border: none; border-radius: var(--r-sm);
  background: var(--purple); color: white; font-size: 14px; font-weight: 700;
}
.error { color: #e53935; font-size: 13px; margin-bottom: 12px; }
.list { list-style: none; margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.item {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px;
}
.itemBtn {
  flex: 1; text-align: left; background: none; border: none;
  padding: 12px 14px; font-size: 15px; font-weight: 700; color: var(--ink);
}
.qrBtn {
  background: var(--slot-empty); border: 1px solid var(--line);
  border-radius: var(--r-sm); height: 36px; padding: 0 14px;
  font-size: 13px; font-weight: 700; color: var(--ink-2);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/AdminOrgList.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminOrgList.jsx src/pages/AdminOrgList.module.css src/pages/AdminOrgList.test.jsx
git commit -m "feat: add org list-up screen with org creation and QR button"
```

---

### Task 13: `AdminDashboard.jsx` 내용을 `AdminOrgDashboard.jsx`로 이전 (org 스코프)

**Files:**
- Create: `src/pages/AdminOrgDashboard.jsx` (기존 `AdminDashboard.jsx` 내용 기반)
- Create: `src/pages/AdminOrgDashboard.test.jsx` (기존 `AdminDashboard.test.jsx` 기반)
- Modify: `src/components/admin/AdminSpectateModal.jsx` (adminFetch 사용)
- Modify: `src/components/admin/AdminSpectateModal.test.jsx`

- [ ] **Step 1: `AdminOrgDashboard.test.jsx` 작성 (실패할 것)**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminOrgDashboard from './AdminOrgDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const ROOMS = [{
  code: 'CD5678', status: 'live', registered: false, prices: PRICES, affiliation: '경영학과',
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

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(ROOMS) })
})

afterEach(() => {
  document.body.classList.remove('admin-mode')
  clearAdminSession()
})

function renderDashboard(onBack = vi.fn()) {
  return render(<AdminOrgDashboard org="경영학과" onBack={onBack} />)
}

describe('AdminOrgDashboard', () => {
  it('마운트 시 admin-mode 바디 클래스를 추가한다', async () => {
    renderDashboard()
    expect(document.body.classList.contains('admin-mode')).toBe(true)
    await screen.findByText('홍길동')
  })

  it('언마운트 시 admin-mode 바디 클래스를 제거한다', () => {
    const { unmount } = renderDashboard()
    unmount()
    expect(document.body.classList.contains('admin-mode')).toBe(false)
  })

  it('org 쿼리와 함께 /api/admin/rooms를 호출하고 받은 팀을 그리드 뷰에 보여준다', async () => {
    renderDashboard()
    expect(await screen.findByText('홍길동')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms?org=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
    )
  })

  it('테이블 뷰 탭 클릭 시 테이블을 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('테이블 뷰'))
    expect(screen.getByText('이름')).toBeInTheDocument()
  })

  it('팀 카드 클릭 시 관전 팝업을 연다', async () => {
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /홍길동/ }))
    expect(screen.getByText('1팀')).toBeInTheDocument()
  })

  it('배경 클릭 시 팝업을 닫는다', async () => {
    const { container } = renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /홍길동/ }))
    await userEvent.click(container.querySelector('[class*="overlay"]'))
    expect(screen.queryByText('1팀')).toBeNull()
  })

  it('새로고침 버튼 클릭 시 /api/admin/rooms를 다시 호출한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    global.fetch.mockClear()
    await userEvent.click(screen.getByText('↻ 새로고침'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms?org=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC',
      expect.anything()
    )
  })

  it('← 소속 목록 버튼 클릭 시 onBack을 호출한다', async () => {
    const onBack = vi.fn()
    renderDashboard(onBack)
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('← 소속 목록'))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/AdminOrgDashboard.test.jsx`
Expected: FAIL — `AdminOrgDashboard` 파일이 없어서 import 에러.

- [ ] **Step 3: `AdminOrgDashboard.jsx` 구현 (기존 `AdminDashboard.jsx` 내용을 org 스코프로 이전)**

```jsx
import { useState, useEffect, useCallback } from 'react'
import AdminGridView from '../components/admin/AdminGridView'
import AdminTableView from '../components/admin/AdminTableView'
import AdminSpectateModal from '../components/admin/AdminSpectateModal'
import { adminFetch } from '../utils/adminAuth'
import styles from './AdminDashboard.module.css'

const TABS = [
  { key: 'grid', label: '그리드 뷰' },
  { key: 'table', label: '테이블 뷰' },
]

export default function AdminOrgDashboard({ org, onBack }) {
  const [activeTab, setActiveTab] = useState('grid')
  const [rooms, setRooms] = useState([])
  const [spectateIndex, setSpectateIndex] = useState(null)

  const loadRooms = useCallback(() => {
    adminFetch(`/api/admin/rooms?org=${encodeURIComponent(org)}`)
      .then(r => r.json())
      .then(setRooms)
      .catch(() => {})
  }, [org])

  useEffect(() => {
    document.body.classList.add('admin-mode')
    loadRooms()
    return () => document.body.classList.remove('admin-mode')
  }, [loadRooms])

  function handlePlayerUpdate(code, updatedPlayer) {
    setRooms(prev => prev.map(room => {
      if (room.code !== code) return room
      return {
        ...room,
        players: room.players.map(p => (p.playerUuid === updatedPlayer.playerUuid ? updatedPlayer : p)),
      }
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{org}</h1>
          <p className={styles.subtitle}>진행중인 팀과 완료된 팀을 확인하고 수정할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadRooms} type="button">↻ 새로고침</button>
          <button className={styles.exitBtn} onClick={onBack} type="button">← 소속 목록</button>
        </div>
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
        <AdminGridView rooms={rooms} onSpectate={room => setSpectateIndex(rooms.findIndex(r => r.code === room.code))} />
      )}
      {activeTab === 'table' && <AdminTableView rooms={rooms} />}

      {spectateIndex !== null && (
        <div className={styles.overlay} onClick={() => setSpectateIndex(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <AdminSpectateModal
              rooms={rooms}
              initialIndex={spectateIndex}
              onPlayerUpdate={handlePlayerUpdate}
              onClose={() => setSpectateIndex(null)}
              onRoomChanged={loadRooms}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `AdminSpectateModal.jsx`가 PATCH/DELETE에 인증 헤더를 붙이도록 수정**

`src/components/admin/AdminSpectateModal.jsx:1-5`의 import 블록을 아래로 교체:

```jsx
import { useState, useEffect, useRef } from 'react'
import AdminPlayerCard from './AdminPlayerCard'
import AdminEditModal from './AdminEditModal'
import { adminFetch } from '../../utils/adminAuth'
import styles from './AdminSpectateModal.module.css'
```

`handleSave`(32-44행)와 `handleDelete`(46-52행)의 `fetch` 호출을 `adminFetch`로 교체:

```js
  async function handleSave(playerUuid, field, value) {
    const res = await adminFetch(`/api/admin/rooms/${room.code}/players/${playerUuid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) return
    const updated = await res.json()
    onPlayerUpdate(room.code, updated)
    onRoomChanged?.()
  }

  async function handleDelete() {
    const res = await adminFetch(`/api/admin/rooms/${room.code}`, { method: 'DELETE' })
    setConfirmDelete(false)
    if (!res.ok) return
    onRoomChanged()
    onClose()
  }
```

(`handleRegister`는 `/api/admin/*`가 아니므로 그대로 둔다.)

- [ ] **Step 5: `AdminSpectateModal.test.jsx`를 인증 헤더 포함하도록 수정**

파일 최상단에 import 추가:

```js
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'
```

기존 `beforeEach`(29-31행)를 아래로 교체:

```js
beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
})

afterEach(() => clearAdminSession())
```

(`afterEach`가 없었으므로 `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`로 상단 import도 갱신)

`'필드 수정 시 PATCH 요청을 보내고 응답으로 onPlayerUpdate를 호출한다'` 테스트의 단언(87-94행)을 아래로 교체:

```js
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms/AB1234/players/AB1234-p1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ job: 'c' }),
      })
    )
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/pages/AdminOrgDashboard.test.jsx src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS (모든 테스트)

- [ ] **Step 7: 기존 `AdminDashboard.jsx`/`AdminDashboard.test.jsx` 삭제 (다음 Task에서 새로 작성)**

```bash
git rm src/pages/AdminDashboard.jsx src/pages/AdminDashboard.test.jsx
```

- [ ] **Step 8: 커밋**

```bash
git add src/pages/AdminOrgDashboard.jsx src/pages/AdminOrgDashboard.test.jsx src/components/admin/AdminSpectateModal.jsx src/components/admin/AdminSpectateModal.test.jsx
git commit -m "refactor: move org-scoped dashboard into AdminOrgDashboard, authenticate spectate actions"
```

---

### Task 14: `src/pages/AdminDashboard.jsx` — 로그인/소속목록/대시보드 스위처로 재작성

**Files:**
- Create: `src/pages/AdminDashboard.jsx` (Task 13에서 삭제한 자리에 새 내용으로 재생성)
- Create: `src/pages/AdminDashboard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminDashboard from './AdminDashboard'
import { clearAdminSession } from '../utils/adminAuth'

beforeEach(() => {
  clearAdminSession()
  global.fetch = vi.fn(url => {
    if (url === '/api/admin/login') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 't1', username: 'admin', isSuper: true }),
      })
    }
    if (url === '/api/admin/orgs') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'org-1', name: '경영학과' }]) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  })
})

afterEach(() => {
  document.body.classList.remove('admin-mode')
  clearAdminSession()
})

describe('AdminDashboard', () => {
  it('토큰이 없으면 로그인 화면을 보여준다', () => {
    render(<AdminDashboard />)
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument()
  })

  it('로그인에 성공하면 소속 목록 화면으로 전환한다', async () => {
    render(<AdminDashboard />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))
    expect(await screen.findByText('경영학과')).toBeInTheDocument()
  })

  it('소속을 선택하면 해당 소속의 대시보드로 전환한다', async () => {
    render(<AdminDashboard />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))
    await userEvent.click(await screen.findByText('경영학과'))
    expect(await screen.findByText('← 소속 목록')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/AdminDashboard.test.jsx`
Expected: FAIL — `AdminDashboard` 파일이 없어서 import 에러.

- [ ] **Step 3: 구현 작성**

```jsx
import { useState } from 'react'
import { getAdminToken, getAdminProfile, setAdminSession, clearAdminSession } from '../utils/adminAuth'
import AdminLogin from './AdminLogin'
import AdminOrgList from './AdminOrgList'
import AdminOrgDashboard from './AdminOrgDashboard'

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken())
  const [profile, setProfile] = useState(() => getAdminProfile())
  const [selectedOrg, setSelectedOrg] = useState(null)

  function handleLogin(newToken, newProfile) {
    setAdminSession(newToken, newProfile)
    setToken(newToken)
    setProfile(newProfile)
  }

  function handleLogout() {
    clearAdminSession()
    setToken(null)
    setProfile(null)
    setSelectedOrg(null)
  }

  if (!token || !profile) return <AdminLogin onLogin={handleLogin} />
  if (!selectedOrg) {
    return <AdminOrgList profile={profile} onSelectOrg={setSelectedOrg} onLogout={handleLogout} />
  }
  return <AdminOrgDashboard org={selectedOrg} onBack={() => setSelectedOrg(null)} />
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/AdminDashboard.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/AdminDashboard.jsx src/pages/AdminDashboard.test.jsx
git commit -m "feat: rebuild AdminDashboard as login -> org list -> org dashboard switcher"
```

---

### Task 15: `src/pages/Home.jsx` — 방 생성 시 소속 전달

**Files:**
- Modify: `src/pages/Home.jsx:34-38`
- Modify: `src/pages/Home.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/pages/Home.test.jsx`의 `describe('Home', ...)` 안에 아래 테스트 추가 (기존 `it('팀 생성 클릭 시 POST /api/rooms를 호출한다', ...)` 다음 위치):

```js
  it('팀 생성 시 URL의 affiliation을 요청 바디에 포함한다', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 'ABC123' }) })
    mockEmit.mockImplementation((_event, _data, cb) => cb?.({ ok: true }))
    render(
      <MemoryRouter initialEntries={['/team?affiliation=경영학과&name=철수&character=c1']}>
        <Home />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('팀 만들기'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ affiliation: '경영학과' }),
      }))
    )
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/Home.test.jsx`
Expected: FAIL — 현재 `POST /api/rooms`는 body 없이 호출됨.

- [ ] **Step 3: 구현 수정**

`src/pages/Home.jsx:34-38`을 아래로 교체:

```js
  async function handleCreate() {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliation }),
    })
    const { code } = await res.json()
    joinRoom(code, true)
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/Home.test.jsx`
Expected: PASS (모든 테스트)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Home.jsx src/pages/Home.test.jsx
git commit -m "feat: include affiliation when creating a room"
```

---

### Task 16: `src/pages/NameInput.jsx` — QR로 들어온 소속은 입력란 대신 잠금 표시

**Files:**
- Modify: `src/pages/NameInput.jsx`
- Modify: `src/pages/NameInput.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/pages/NameInput.test.jsx`의 `describe('NameInput', ...)` 안에 아래 두 테스트 추가:

```js
  it('URL에 affiliation이 있으면 소속 입력란 대신 읽기 전용 라벨을 보여준다', () => {
    render(<MemoryRouter initialEntries={['/name?affiliation=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC']}><NameInput /></MemoryRouter>)
    expect(screen.queryByPlaceholderText('예) 경영학과')).not.toBeInTheDocument()
    expect(screen.getByText('소속: 경영학과')).toBeInTheDocument()
  })

  it('URL에 affiliation이 있으면 이름만 입력해도 다음으로 진행하고 affiliation을 유지한다', () => {
    render(<MemoryRouter initialEntries={['/name?affiliation=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC']}><NameInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) 홍길동'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?affiliation=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC&name=%EC%B2%A0%EC%88%98')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/pages/NameInput.test.jsx`
Expected: FAIL — 현재는 `affiliation` 쿼리를 무시하고 항상 자유 입력란을 보여줌.

- [ ] **Step 3: 구현 수정**

`src/pages/NameInput.jsx` 전체를 아래로 교체:

```jsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lockedAffiliation = searchParams.get('affiliation') ?? ''
  const [affiliation, setAffiliation] = useState('')
  const [name, setName] = useState('')

  const code = searchParams.get('code') ?? ''

  function handleNext() {
    const finalAffiliation = lockedAffiliation || affiliation.trim()
    if (!finalAffiliation || !name.trim()) return
    const params = new URLSearchParams({ affiliation: finalAffiliation, name: name.trim() })
    if (code) params.set('code', code)
    navigate(`/select?${params}`)
  }

  return (
    <div className={styles.page}>
      <BackButton variant="intro" />
      <div className={styles.header}>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
      </div>
      <div className={styles.card}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>소속을 입력하세요</label>
          {lockedAffiliation ? (
            <p className={styles.lockedValue}>소속: {lockedAffiliation}</p>
          ) : (
            <input
              className={styles.input}
              placeholder="예) 경영학과"
              value={affiliation}
              onChange={e => setAffiliation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              maxLength={30}
            />
          )}
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>이름을 입력하세요</label>
          <input
            className={styles.input}
            placeholder="예) 홍길동"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={20}
          />
        </div>
        <button
          className={styles.gradBtn}
          onClick={handleNext}
          disabled={!(lockedAffiliation || affiliation.trim()) || !name.trim()}
        >
          다음 →
        </button>
      </div>
    </div>
  )
}
```

`src/pages/NameInput.module.css`에 `.lockedValue` 클래스가 없다면 `.input`과 비슷한 여백으로 추가:

```css
.lockedValue {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  padding: 12px 0;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/pages/NameInput.test.jsx`
Expected: PASS (기존 4개 + 신규 2개 = 6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/NameInput.jsx src/pages/NameInput.module.css src/pages/NameInput.test.jsx
git commit -m "feat: skip affiliation input when arriving via org QR link"
```

---

### Task 17: 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run`
Expected: 모든 테스트 PASS, 실패 없음.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 3: 수동 스모크 테스트**

```bash
npm run dev
```

브라우저에서 다음을 확인한다:
1. `/` 에서 톱니바퀴(관리자) 버튼 클릭 → 로그인 폼이 뜬다.
2. `admin` / `0000`으로 로그인 → 소속 목록 화면(처음엔 빈 목록)으로 전환된다.
3. "새 소속 이름"에 아무 이름 입력 후 "소속 생성하기" → 목록에 추가된다.
4. 생성한 소속의 QR 버튼 클릭 → QR 모달이 뜨고, 이미지의 데이터 URL이 비어있지 않다.
5. 그 QR이 가리키는 URL(`/join?affiliation=...`)을 직접 열어보면 소속 입력란 없이 "소속: OO" 라벨과 이름 입력란만 보인다.
6. 이름 입력 후 진행해 팀을 만들고, 관리자 화면으로 돌아가 해당 소속을 선택하면 방금 만든 팀이 보인다.
7. 로그아웃 후 다시 `admin`/`0000`으로 로그인하면 방금 만든 소속이 그대로 보인다(마스터 계정은 항상 전체 접근).

- [ ] **Step 4: 최종 커밋 (필요 시 스모크 테스트 중 발견한 수정 반영)**

```bash
git status
```

수정 사항이 있다면 커밋, 없다면 이 단계는 스킵한다.

---

## 범위 밖 (스펙과 동일)

- 관리자 계정 관리 UI (비밀번호 변경, 계정 삭제, 다른 admin 목록 조회)
- org 이름 변경/삭제, 이미 생성된 방의 소속 재배정
- 토큰 자동 갱신(refresh token), 로그아웃 후 서버측 토큰 무효화
- 회원가입 시 이메일 인증, 비밀번호 규칙 등 추가 검증
