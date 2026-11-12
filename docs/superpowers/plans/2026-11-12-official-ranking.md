# 공식전 랭킹 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "대회"(`classes.kind = 'official'`)로 진행한 게임만 모아 테이블 내 순위 포인트로 집계하는 공식 랭킹을 추가한다.

**Architecture:** DB는 `classes.kind`, `official_players`, `game_results.official_player_id`를 추가한다. 포인트는 저장하지 않고, 조회할 때 순수 함수 모듈 `server/officialRanking.js`가 계산한다. 공식 참가자는 이름 입력 단계에서 `resolve` API로 생성하거나 찾는다. 그 id를 `join-room`으로 방에 실어 결과 등록 때 함께 저장한다. 프론트는 새 페이지 `OfficialRankingPage`를 추가하고, `RankingTable`/`RankingPodium`에 하위 호환 prop을 더해 재사용한다.

**Tech Stack:** Node 20, Express 5, socket.io, Supabase(PostgREST, `boardgame` 스키마), React 18, react-router 7, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-11-12-official-ranking-design.md`

**Branch:** `feat/official-ranking` (이미 생성됨)

**Spec과 다른 점:** 공식 참가자는 대회 하나에만 속한다. 그래서 "최고 자산을 기록한 대회"는 항상 그 참가자의 대회(`contestName`)와 같다. spec의 `bestAssetsContestName` 필드는 따로 두지 않고 `contestName`을 쓴다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/2026-11-12-add-official-ranking.sql` (신규) | 컬럼과 테이블 추가 |
| `supabase/schema.sql` | 스키마 스냅샷 갱신 |
| `server/officialRanking.js` (신규) | 테이블 포인트 계산, 참가자 집계, 정렬 (순수 함수) |
| `server/officialPlayers.js` (신규) | 공식 참가자 조회, 생성, resolve |
| `server/classes.js` | `kind` 저장과 조회, `getClassInfo`, `listOfficialContests` |
| `server/db.js` | `official_player_id` 저장, 일반 랭킹에서 대회 제외, 공식 결과 조회 |
| `server/rooms.js` | `room.isOfficial`, 공식 참가자 입장 검증 |
| `server/index.js` | API 연결, `join-room`/수동 추가 검증 |
| `src/utils/officialPlayer.js` (신규) | 입장 종류 조회, resolve 호출, localStorage 기억 |
| `src/hooks/useOfficialNameResolve.js` (신규) | 실명 확인 흐름 상태 (NameInput과 관리자 모달이 공유) |
| `src/components/AlertModal.jsx` | 선택적 취소 버튼 |
| `src/pages/NameInput.jsx` | 대회 분기 UI |
| `src/pages/CharacterSelect.jsx`, `Lobby.jsx`, `Team.jsx`, `IndividualPage.jsx` | `officialPlayerId` 전달 |
| `src/pages/AdminClassList.jsx` + css, `src/components/admin/adminNavItems.js` | 게임 목록, two-column, 공식 뱃지 |
| `src/pages/AdminDashboard.jsx`, `AdminClassDashboard.jsx`, `src/components/admin/AdminGridCard.jsx` | 대회 뱃지, 1인 집계 제외 표시 |
| `src/components/admin/AdminAddPlayerModal.jsx`, `AdminSpectateModal.jsx` | 수동 추가할 때 실명 확인 |
| `src/components/RankingTable.jsx`, `RankingPodium.jsx` | `formatValue`/`getRowKey`/`highlightKey` prop |
| `src/pages/OfficialRankingPage.jsx` + css (신규), `src/App.jsx` | 공식 랭킹 페이지와 라우트 |
| `src/pages/RankingPage.jsx` + css | 공식 랭킹 버튼, "대회" 범위 이동, 공식 id 기억 |

테스트 명령은 모두 `npx vitest run <파일>`이다. 전체 테스트는 `npx vitest run`이다.

---

### Task 1: DB 마이그레이션

**Files:**
- Create: `supabase/migrations/2026-11-12-add-official-ranking.sql`
- Modify: `supabase/schema.sql` (파일 끝에 추가)

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 공식전(대회) 랭킹. 대회는 classes 행 중 kind = 'official'인 것이다.
-- 예전에 삭제한 classes.mode(경쟁 모드)와 헷갈리지 않도록 컬럼 이름을 kind로 한다.
-- 배포 순서: 이 마이그레이션 실행 → 코드 배포. 새 컬럼은 기본값이 있거나 null을 허용하므로
-- 기존 코드가 먼저 돌아도 문제없다.
ALTER TABLE boardgame.classes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'class'
  CHECK (kind IN ('class', 'official'));

-- 공식 참가자. 식별 기준은 "실명 + 대회"다. 기기 단위인 player_uuid로는 다른 기기에서 한
-- 게임을 묶을 수 없어서 따로 둔다. real_name은 서버가 앞뒤 공백을 제거해서 저장한다.
CREATE TABLE IF NOT EXISTS boardgame.official_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES boardgame.classes(id) ON DELETE CASCADE,
  real_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, real_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON boardgame.official_players TO service_role;
ALTER TABLE boardgame.official_players ENABLE ROW LEVEL SECURITY;

-- 공식전 결과와 공식 참가자를 연결한다. 일반 게임은 null.
ALTER TABLE boardgame.game_results
  ADD COLUMN IF NOT EXISTS official_player_id uuid
  REFERENCES boardgame.official_players(id) ON DELETE SET NULL;
```

- [ ] **Step 2: `supabase/schema.sql` 끝에 같은 내용 추가**

위 SQL 블록 전체를 `supabase/schema.sql` 맨 끝에 `-- 2026-11-12 공식전 랭킹` 주석과 함께 붙인다.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-11-12-add-official-ranking.sql supabase/schema.sql
git commit -m "feat: add official ranking tables and columns"
```

> 운영 DB 적용은 사용자가 Supabase SQL Editor에서 직접 실행한다. 구현자는 실행하지 않는다.

---

### Task 2: 순위 포인트 계산 모듈

**Files:**
- Create: `server/officialRanking.js`
- Test: `server/officialRanking.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tablePoints, buildOfficialRankings } from './officialRanking.js'

function r(officialPlayerId, totalAssets) {
  return { officialPlayerId, totalAssets }
}

describe('tablePoints', () => {
  it('4명 테이블은 10/6/3/1점을 준다', () => {
    const awards = tablePoints([r('a', 100), r('b', 400), r('c', 300), r('d', 200)])
    expect(awards.get('b')).toEqual({ points: 10, isFirst: true })
    expect(awards.get('c')).toEqual({ points: 6, isFirst: false })
    expect(awards.get('d')).toEqual({ points: 3, isFirst: false })
    expect(awards.get('a')).toEqual({ points: 1, isFirst: false })
  })

  it('3명 테이블은 10/6/3점, 2명 테이블은 10/6점을 준다', () => {
    const three = tablePoints([r('a', 3), r('b', 2), r('c', 1)])
    expect([three.get('a').points, three.get('b').points, three.get('c').points]).toEqual([10, 6, 3])
    const two = tablePoints([r('a', 1), r('b', 2)])
    expect([two.get('b').points, two.get('a').points]).toEqual([10, 6])
  })

  it('1명 테이블은 집계하지 않는다', () => {
    expect(tablePoints([r('a', 999)]).size).toBe(0)
  })

  it('공동 1위 2명은 (10+6)/2점씩 받고 둘 다 1위로 센다. 다음 사람은 3위 포인트를 받는다', () => {
    const awards = tablePoints([r('a', 500), r('b', 500), r('c', 300), r('d', 100)])
    expect(awards.get('a')).toEqual({ points: 8, isFirst: true })
    expect(awards.get('b')).toEqual({ points: 8, isFirst: true })
    expect(awards.get('c')).toEqual({ points: 3, isFirst: false })
    expect(awards.get('d')).toEqual({ points: 1, isFirst: false })
  })

  it('공동 2위 3명은 (6+3+1)/3점씩 받는다', () => {
    const awards = tablePoints([r('a', 900), r('b', 100), r('c', 100), r('d', 100)])
    expect(awards.get('b').points).toBeCloseTo(10 / 3)
    expect(awards.get('b').isFirst).toBe(false)
  })

  it('전원 동점이면 모두 (10+6+3+1)/4점이고 모두 1위로 센다', () => {
    const awards = tablePoints([r('a', 1), r('b', 1), r('c', 1), r('d', 1)])
    for (const id of ['a', 'b', 'c', 'd']) expect(awards.get(id)).toEqual({ points: 5, isFirst: true })
  })

  it('officialPlayerId가 없는 행은 인원과 순위에는 포함하지만 포인트는 주지 않는다', () => {
    const awards = tablePoints([r(null, 900), r('b', 500), r('c', 100)])
    expect(awards.size).toBe(2)
    expect(awards.get('b')).toEqual({ points: 6, isFirst: false })
    expect(awards.get('c')).toEqual({ points: 3, isFirst: false })
  })
})

function row(overrides) {
  return {
    sessionId: 's1', contestId: 'c1', contestName: '2026 시즌1',
    officialPlayerId: 'p1', realName: '박병윤', character: 'fox',
    totalAssets: 100, createdAt: '2026-11-12T01:00:00.000Z',
    ...overrides,
  }
}

describe('buildOfficialRankings', () => {
  it('참가자별로 포인트, 게임 수, 1위 횟수, 최고 자산을 합산한다', () => {
    const rows = [
      row({ sessionId: 's1', officialPlayerId: 'p1', totalAssets: 500 }),
      row({ sessionId: 's1', officialPlayerId: 'p2', realName: '김철수', totalAssets: 300 }),
      row({ sessionId: 's2', officialPlayerId: 'p1', totalAssets: 200 }),
      row({ sessionId: 's2', officialPlayerId: 'p2', realName: '김철수', totalAssets: 900 }),
    ]
    const { points } = buildOfficialRankings(rows)
    expect(points).toEqual([
      expect.objectContaining({ rank: 1, officialPlayerId: 'p2', points: 16, games: 2, wins: 1, bestAssets: 900 }),
      expect.objectContaining({ rank: 2, officialPlayerId: 'p1', points: 16, games: 2, wins: 1, bestAssets: 500 }),
    ])
  })

  it('포인트가 같으면 최고 자산이 높은 사람이 위다. 둘 다 같으면 같은 등수를 준다', () => {
    const rows = [
      row({ sessionId: 's1', officialPlayerId: 'p1', totalAssets: 500 }),
      row({ sessionId: 's1', officialPlayerId: 'p2', totalAssets: 500 }),
      row({ sessionId: 's1', officialPlayerId: 'p3', totalAssets: 100 }),
    ]
    const { points } = buildOfficialRankings(rows)
    expect(points.map(p => [p.officialPlayerId, p.rank])).toEqual([['p1', 1], ['p2', 1], ['p3', 3]])
  })

  it('최고 자산 순위는 최고 자산 내림차순이다', () => {
    const rows = [
      row({ sessionId: 's1', officialPlayerId: 'p1', totalAssets: 500 }),
      row({ sessionId: 's1', officialPlayerId: 'p2', totalAssets: 100 }),
      row({ sessionId: 's2', officialPlayerId: 'p2', totalAssets: 800 }),
      row({ sessionId: 's2', officialPlayerId: 'p3', totalAssets: 700 }),
    ]
    const { bestAssets } = buildOfficialRankings(rows)
    expect(bestAssets.map(p => [p.officialPlayerId, p.bestAssets, p.rank])).toEqual([
      ['p2', 800, 1], ['p3', 700, 2], ['p1', 500, 3],
    ])
  })

  it('캐릭터는 가장 최근 게임의 캐릭터를 쓴다', () => {
    const rows = [
      row({ sessionId: 's2', officialPlayerId: 'p1', character: 'bear', createdAt: '2026-11-12T03:00:00.000Z' }),
      row({ sessionId: 's2', officialPlayerId: 'p2', createdAt: '2026-11-12T03:00:00.000Z' }),
      row({ sessionId: 's1', officialPlayerId: 'p1', character: 'fox', createdAt: '2026-11-12T01:00:00.000Z' }),
      row({ sessionId: 's1', officialPlayerId: 'p2', createdAt: '2026-11-12T01:00:00.000Z' }),
    ]
    const p1 = buildOfficialRankings(rows).points.find(p => p.officialPlayerId === 'p1')
    expect(p1.character).toBe('bear')
  })

  it('1명 테이블 기록은 포인트와 최고 자산 모두에서 빠진다', () => {
    const rows = [row({ sessionId: 's1', officialPlayerId: 'p1', totalAssets: 999999 })]
    expect(buildOfficialRankings(rows)).toEqual({ points: [], bestAssets: [] })
  })

  it('다른 대회의 같은 실명은 별도 참가자다', () => {
    const rows = [
      row({ sessionId: 's1', contestId: 'c1', contestName: '시즌1', officialPlayerId: 'p1', totalAssets: 2 }),
      row({ sessionId: 's1', contestId: 'c1', contestName: '시즌1', officialPlayerId: 'p9', realName: '다른사람', totalAssets: 1 }),
      row({ sessionId: 's2', contestId: 'c2', contestName: '시즌2', officialPlayerId: 'p2', totalAssets: 2 }),
      row({ sessionId: 's2', contestId: 'c2', contestName: '시즌2', officialPlayerId: 'p8', realName: '다른사람', totalAssets: 1 }),
    ]
    const names = buildOfficialRankings(rows).points.filter(p => p.realName === '박병윤').map(p => p.contestName)
    expect(names.sort()).toEqual(['시즌1', '시즌2'])
  })

  it('3명 공동 같은 소수점 포인트도 합계가 같으면 같은 등수다', () => {
    const rows = [
      row({ sessionId: 's1', officialPlayerId: 'p0', totalAssets: 9 }),
      row({ sessionId: 's1', officialPlayerId: 'p1', totalAssets: 1 }),
      row({ sessionId: 's1', officialPlayerId: 'p2', totalAssets: 1 }),
      row({ sessionId: 's1', officialPlayerId: 'p3', totalAssets: 1 }),
    ]
    const { points } = buildOfficialRankings(rows)
    expect(points.slice(1).map(p => p.rank)).toEqual([2, 2, 2])
    expect(points[1].points).toBe(3.33)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/officialRanking.test.js`
Expected: FAIL (`Failed to resolve import "./officialRanking.js"`)

- [ ] **Step 3: 구현**

```js
// 공식전(대회) 랭킹 계산. DB에 포인트를 저장하지 않고 조회할 때마다 계산한다.
// 그래서 관리자가 결과를 수정하거나 팀을 지워도 다음 조회부터 바로 반영된다.

// 테이블 순위별 포인트. 인원이 n명이면 앞에서 n개를 쓴다(3명: 10/6/3, 2명: 10/6).
export const POINTS = [10, 6, 3, 1]

// 한 테이블(세션)의 결과 → Map<officialPlayerId, { points, isFirst }>.
// 총자산이 같으면 공동 순위로 보고, 그 순위들이 차지하는 포인트를 평균 내서 나눠 준다.
// 1명 테이블은 경쟁 상대가 없어 집계하지 않는다. officialPlayerId가 없는 행은 인원과
// 순위 계산에만 쓰고 포인트는 주지 않는다.
export function tablePoints(results) {
  const awards = new Map()
  if (results.length < 2) return awards

  const sorted = [...results].sort((a, b) => b.totalAssets - a.totalAssets)
  let start = 0
  while (start < sorted.length) {
    let end = start
    while (end + 1 < sorted.length && sorted[end + 1].totalAssets === sorted[start].totalAssets) end++

    let sum = 0
    for (let k = start; k <= end; k++) sum += POINTS[k] ?? 0
    const points = sum / (end - start + 1)

    for (let k = start; k <= end; k++) {
      const id = sorted[k].officialPlayerId
      if (id) awards.set(id, { points, isFirst: start === 0 })
    }
    start = end + 1
  }
  return awards
}

// 앞 사람과 key가 같으면 같은 등수를 준다(1, 1, 3 방식).
function withRanks(sorted, keyOf) {
  let prevKey = null
  let prevRank = 0
  return sorted.map((p, i) => {
    const key = keyOf(p)
    const rank = i > 0 && key === prevKey ? prevRank : i + 1
    prevKey = key
    prevRank = rank
    return { ...p, rank }
  })
}

// rows: { sessionId, contestId, contestName, officialPlayerId, realName, character, totalAssets, createdAt }
// → { points: Row[], bestAssets: Row[] }
export function buildOfficialRankings(rows) {
  const bySession = new Map()
  for (const r of rows) {
    if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, [])
    bySession.get(r.sessionId).push(r)
  }

  const players = new Map()
  for (const tableRows of bySession.values()) {
    const awards = tablePoints(tableRows)
    for (const r of tableRows) {
      const award = awards.get(r.officialPlayerId)
      if (!award) continue

      let p = players.get(r.officialPlayerId)
      if (!p) {
        p = {
          officialPlayerId: r.officialPlayerId,
          realName: r.realName,
          contestId: r.contestId,
          contestName: r.contestName,
          character: r.character,
          points: 0,
          games: 0,
          wins: 0,
          bestAssets: r.totalAssets,
          lastPlayedAt: r.createdAt,
        }
        players.set(r.officialPlayerId, p)
      }
      p.points += award.points
      p.games += 1
      if (award.isFirst) p.wins += 1
      if (r.totalAssets > p.bestAssets) p.bestAssets = r.totalAssets
      if (Date.parse(r.createdAt) > Date.parse(p.lastPlayedAt)) {
        p.character = r.character
        p.lastPlayedAt = r.createdAt
      }
    }
  }

  // 평균 포인트(예: 10/3)를 더하면 부동소수점 오차로 같은 합계가 다르게 비교될 수 있어
  // 소수 둘째 자리에서 반올림한 값으로 정렬하고 보여 준다.
  const list = [...players.values()].map(({ lastPlayedAt, ...p }) => ({
    ...p,
    points: Math.round(p.points * 100) / 100,
  }))

  const byPoints = [...list].sort((a, b) => (b.points - a.points) || (b.bestAssets - a.bestAssets))
  const byBest = [...list].sort((a, b) => b.bestAssets - a.bestAssets)

  return {
    points: withRanks(byPoints, p => `${p.points}|${p.bestAssets}`),
    bestAssets: withRanks(byBest, p => p.bestAssets),
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/officialRanking.test.js`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add server/officialRanking.js server/officialRanking.test.js
git commit -m "feat: compute official ranking points per table"
```

---

### Task 3: classes.js에 `kind` 추가

**Files:**
- Modify: `server/classes.js`
- Test: `server/classes.test.js`

- [ ] **Step 1: 기존 테스트 기대값 수정과 새 테스트 추가**

`server/classes.test.js`에서 다음을 바꾼다.

1. import 줄을 다음으로 바꾼다.
```js
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, getClassInfo, listOfficialContests, UNASSIGNED_CLASS } from './classes.js'
```
2. `createClass` 테스트의 insert 기대값을 다음으로 바꾼다.
```js
    expect(mockClassInsert).toHaveBeenCalledWith({ name: '3학년 2반', created_by: 'admin-1', kind: 'class' })
```
3. `listClassesForAdmin` 두 테스트의 기대 배열에서, 실제 수업 항목과 미배정 항목 모두에 `kind: 'class'`를 추가한다. 예:
```js
    expect(classes).toEqual([
      { id: 'class-1', name: '3학년 2반', kind: 'class', createdAt: '2026-07-27T00:00:00.000Z' },
      { id: 'unassigned', name: UNASSIGNED_CLASS, kind: 'class' },
    ])
```
   일반 관리자 테스트의 기대값에도 각 항목에 `kind: 'class'`를 추가한다.

4. 파일 끝에 다음을 추가한다.
```js
describe('createClass kind', () => {
  function mockInsert() {
    const mockClassSingle = vi.fn().mockResolvedValue({ data: { id: 'c', name: 'n', kind: 'official' }, error: null })
    const mockClassInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockClassSingle }) })
    mockFrom.mockImplementation(table => {
      if (table === 'classes') return { insert: mockClassInsert }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })
    return mockClassInsert
  }

  it("kind가 'official'이면 그대로 저장한다", async () => {
    const insert = mockInsert()
    await createClass('2026 시즌1', 'admin-1', 'official')
    expect(insert).toHaveBeenCalledWith({ name: '2026 시즌1', created_by: 'admin-1', kind: 'official' })
  })

  it("알 수 없는 kind는 'class'로 저장한다", async () => {
    const insert = mockInsert()
    await createClass('x', 'admin-1', 'weird')
    expect(insert).toHaveBeenCalledWith({ name: 'x', created_by: 'admin-1', kind: 'class' })
  })
})

describe('getClassInfo', () => {
  function mockLookup(result) {
    const maybeSingle = vi.fn().mockResolvedValue(result)
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })
    return eq
  }

  it('대회면 kind와 이름을 돌려준다', async () => {
    const eq = mockLookup({ data: { name: '2026 시즌1', kind: 'official' }, error: null })
    expect(await getClassInfo('class-1')).toEqual({ kind: 'official', name: '2026 시즌1' })
    expect(eq).toHaveBeenCalledWith('id', 'class-1')
  })

  it('미배정이거나 classId가 없으면 DB를 보지 않고 일반 수업으로 본다', async () => {
    expect(await getClassInfo('unassigned')).toEqual({ kind: 'class', name: null })
    expect(await getClassInfo(null)).toEqual({ kind: 'class', name: null })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('없는 수업이나 uuid 형식이 아닌 id(22P02)는 일반 수업으로 본다', async () => {
    mockLookup({ data: null, error: null })
    expect(await getClassInfo('missing')).toEqual({ kind: 'class', name: null })
    mockLookup({ data: null, error: { code: '22P02' } })
    expect(await getClassInfo('not-a-uuid')).toEqual({ kind: 'class', name: null })
  })
})

describe('listOfficialContests', () => {
  it('대회만 최신순으로 돌려준다', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'c2', name: '시즌2', created_at: '2026-11-02T00:00:00.000Z' }],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })

    expect(await listOfficialContests()).toEqual([{ id: 'c2', name: '시즌2', createdAt: '2026-11-02T00:00:00.000Z' }])
    expect(eq).toHaveBeenCalledWith('kind', 'official')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/classes.test.js`
Expected: FAIL (`getClassInfo is not a function` 및 kind 기대값 불일치)

- [ ] **Step 3: 구현**

`server/classes.js` 전체를 다음으로 바꾼다(기존 `hasClassAccess`, `updateClassName`, `deleteClass`는 그대로 둔다).

```js
import { supabase } from './supabase.js'

export const UNASSIGNED_CLASS = '미배정 수업'

// classes.kind: 'class'(일반 수업) | 'official'(공식전 대회).
export const CLASS_KINDS = ['class', 'official']

function toKind(kind) {
  return CLASS_KINDS.includes(kind) ? kind : 'class'
}

export async function createClass(name, adminId, kind = 'class') {
  const trimmed = name.trim()
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({ name: trimmed, created_by: adminId, kind: toKind(kind) })
    .select('id, name, kind')
    .single()
  if (error) throw error

  const { error: accessError } = await supabase
    .from('admin_class_access')
    .insert({ admin_id: adminId, class_id: cls.id })
  if (accessError) throw accessError

  return cls
}

function toClassItem(cls) {
  return { id: cls.id, name: cls.name, kind: toKind(cls.kind), createdAt: cls.created_at }
}

export async function listClassesForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, kind, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return [
      ...data.map(toClassItem),
      { id: 'unassigned', name: UNASSIGNED_CLASS, kind: 'class' },
    ]
  }

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('classes(id, name, kind, created_at)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data
    .map(row => toClassItem(row.classes))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// 입장 화면과 서버 검증이 "이 수업이 대회인지" 확인할 때 쓴다.
// 미배정·없는 수업·잘못된 id는 일반 수업으로 본다.
export async function getClassInfo(classId) {
  const fallback = { kind: 'class', name: null }
  if (!classId || classId === 'unassigned') return fallback

  const { data, error } = await supabase
    .from('classes')
    .select('name, kind')
    .eq('id', classId)
    .maybeSingle()
  if (error) {
    if (error.code === '22P02') return fallback
    throw error
  }
  if (!data) return fallback
  return { kind: toKind(data.kind), name: data.name }
}

// 공식 랭킹 페이지의 대회 드롭다운용.
export async function listOfficialContests() {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, created_at')
    .eq('kind', 'official')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(cls => ({ id: cls.id, name: cls.name, createdAt: cls.created_at }))
}
```

그 뒤에 기존 `hasClassAccess`, `updateClassName`, `deleteClass`를 그대로 이어 붙인다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/classes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/classes.js server/classes.test.js
git commit -m "feat: store class kind and look up official contests"
```

---

### Task 4: 공식 참가자 모듈

**Files:**
- Create: `server/officialPlayers.js`
- Test: `server/officialPlayers.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { normalizeRealName, createOfficialPlayer, resolveOfficialPlayer, getOfficialPlayer } from './officialPlayers.js'

// select().eq().eq().maybeSingle() 체인과 insert().select().single() 체인을 흉내 낸다.
function mockTable({ found = null, insertResult = { data: { id: 'new-id' }, error: null } } = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: found, error: null })
  const eq2 = vi.fn().mockReturnValue({ maybeSingle })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, maybeSingle })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  const insertSingle = vi.fn().mockResolvedValue(insertResult)
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: insertSingle }) })
  mockFrom.mockImplementation(table => {
    if (table !== 'official_players') throw new Error(`unexpected table: ${table}`)
    return { select, insert }
  })
  return { select, insert, eq1, eq2, maybeSingle }
}

beforeEach(() => mockFrom.mockReset())

describe('normalizeRealName', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeRealName('  박병윤 ')).toBe('박병윤')
    expect(normalizeRealName(undefined)).toBe('')
  })
})

describe('resolveOfficialPlayer', () => {
  it('같은 이름이 없으면 새로 만들고 id를 돌려준다', async () => {
    const { insert } = mockTable({ found: null })
    const result = await resolveOfficialPlayer({ classId: 'c1', contestName: '2026 시즌1', realName: ' 박병윤 ' })
    expect(insert).toHaveBeenCalledWith({ class_id: 'c1', real_name: '박병윤' })
    expect(result).toEqual({ officialPlayerId: 'new-id' })
  })

  it('같은 이름이 있고 confirm이 없으면 확인 문구만 돌려주고 만들지 않는다', async () => {
    const { insert } = mockTable({ found: { id: 'old-id', class_id: 'c1', real_name: '박병윤' } })
    const result = await resolveOfficialPlayer({ classId: 'c1', contestName: '2026 시즌1', realName: '박병윤' })
    expect(result).toEqual({ exists: true, label: '박병윤 (2026 시즌1)' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('같은 이름이 있고 confirm이면 기존 id를 돌려준다', async () => {
    mockTable({ found: { id: 'old-id', class_id: 'c1', real_name: '박병윤' } })
    const result = await resolveOfficialPlayer({ classId: 'c1', contestName: '2026 시즌1', realName: '박병윤', confirm: true })
    expect(result).toEqual({ officialPlayerId: 'old-id' })
  })

  it('이름이 비어 있으면 에러를 던진다', async () => {
    await expect(resolveOfficialPlayer({ classId: 'c1', contestName: 'x', realName: '  ' })).rejects.toThrow('realName is required')
  })
})

describe('createOfficialPlayer', () => {
  it('동시에 만들어져 unique 위반(23505)이 나면 기존 행을 다시 찾아 돌려준다', async () => {
    const { maybeSingle } = mockTable({ insertResult: { data: null, error: { code: '23505' } } })
    maybeSingle.mockResolvedValueOnce({ data: { id: 'raced-id' }, error: null })
    expect(await createOfficialPlayer('c1', '박병윤')).toEqual({ id: 'raced-id' })
  })
})

describe('getOfficialPlayer', () => {
  it('id로 조회한다', async () => {
    const { eq1, maybeSingle } = mockTable()
    maybeSingle.mockResolvedValueOnce({ data: { id: 'p1', class_id: 'c1', real_name: '박병윤' }, error: null })
    expect(await getOfficialPlayer('p1')).toEqual({ id: 'p1', class_id: 'c1', real_name: '박병윤' })
    expect(eq1).toHaveBeenCalledWith('id', 'p1')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/officialPlayers.test.js`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```js
import { supabase } from './supabase.js'

const COLUMNS = 'id, class_id, real_name'

export function normalizeRealName(name) {
  return String(name ?? '').trim()
}

export async function findOfficialPlayer(classId, realName) {
  const { data, error } = await supabase
    .from('official_players')
    .select(COLUMNS)
    .eq('class_id', classId)
    .eq('real_name', realName)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createOfficialPlayer(classId, realName) {
  const { data, error } = await supabase
    .from('official_players')
    .insert({ class_id: classId, real_name: realName })
    .select(COLUMNS)
    .single()
  if (error) {
    // 같은 이름으로 거의 동시에 두 번 만들면 (class_id, real_name) unique에 걸린다.
    // 그때는 먼저 만들어진 행을 그대로 쓴다.
    if (error.code === '23505') {
      const existing = await findOfficialPlayer(classId, realName)
      if (existing) return existing
    }
    throw error
  }
  return data
}

// join-room과 관리자 수동 추가가 "이 id가 이 대회 소속인지" 확인할 때 쓴다.
// uuid 형식이 아닌 id(22P02)는 없는 것으로 본다.
export async function getOfficialPlayer(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('official_players')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === '22P02') return null
    throw error
  }
  return data
}

// 실명 입력 단계의 처리:
// - 같은 이름 없음 → 새로 만들고 { officialPlayerId }
// - 같은 이름 있음 + confirm 없음 → { exists, label } (만들지 않음, 화면이 "님이 맞나요?"를 묻는다)
// - 같은 이름 있음 + confirm → 기존 { officialPlayerId }
export async function resolveOfficialPlayer({ classId, contestName, realName, confirm = false }) {
  const name = normalizeRealName(realName)
  if (!name) throw new Error('realName is required')

  const existing = await findOfficialPlayer(classId, name)
  if (existing) {
    if (!confirm) return { exists: true, label: `${name} (${contestName})` }
    return { officialPlayerId: existing.id }
  }
  const created = await createOfficialPlayer(classId, name)
  return { officialPlayerId: created.id }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/officialPlayers.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/officialPlayers.js server/officialPlayers.test.js
git commit -m "feat: add official player lookup and resolve"
```

---

### Task 5: db.js — 결과 저장, 일반 랭킹 제외, 공식 결과 조회

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`server/db.test.js` 파일 끝에 다음을 추가한다(`makeQueryBuilder`, `mockFrom`, `PRICES`는 파일 상단의 것을 쓴다).

```js
describe('공식전', () => {
  it('saveGameResult는 플레이어의 officialPlayerId를 official_player_id로 저장한다(없으면 null)', async () => {
    const mockSessionInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null }) }),
    })
    const mockResultsInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReset()
    mockFrom.mockImplementation(table => (table === 'game_sessions' ? { insert: mockSessionInsert } : { insert: mockResultsInsert }))

    const { saveGameResult } = await import('./db.js')
    const gameState = {
      job: 'a', cash: 0,
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
    }
    await saveGameResult({
      code: 'AB1234', prices: PRICES, classId: 'c1',
      players: [
        { playerUuid: 'p1', name: '박병윤', character: 'fox', officialPlayerId: 'op1', gameState },
        { playerUuid: 'p2', name: '김철수', character: 'bear', gameState },
      ],
    })

    expect(mockResultsInsert).toHaveBeenCalledWith([
      expect.objectContaining({ player_uuid: 'p1', official_player_id: 'op1' }),
      expect.objectContaining({ player_uuid: 'p2', official_player_id: null }),
    ])
  })

  it('getRankings 전체 범위는 대회 결과를 뺀다. 미배정 결과는 남긴다', async () => {
    const builder = makeQueryBuilder({
      data: [
        { id: 'r1', name: '일반', total_assets: 300, game_sessions: { class_id: 'c1', classes: { name: '1반', kind: 'class' } } },
        { id: 'r2', name: '대회', total_assets: 200, game_sessions: { class_id: 'c2', classes: { name: '시즌1', kind: 'official' } } },
        { id: 'r3', name: '미배정', total_assets: 100, game_sessions: { class_id: null, classes: null } },
      ],
      error: null,
    })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    const rows = await getRankings({})
    expect(rows.map(r => r.name)).toEqual(['일반', '미배정'])
  })

  it('getRankings에 classId를 주면 대회 결과도 그대로 보여 준다(관리자 대회 화면)', async () => {
    const builder = makeQueryBuilder({
      data: [{ id: 'r2', name: '대회', total_assets: 200, game_sessions: { class_id: 'c2', classes: { name: '시즌1', kind: 'official' } } }],
      error: null,
    })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    const rows = await getRankings({ classId: 'c2' })
    expect(rows.map(r => r.name)).toEqual(['대회'])
  })

  it('getOfficialResultRows는 대회 결과만 계산용 형태로 돌려주고 classId로 거른다', async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          session_id: 's1', official_player_id: 'op1', character: 'fox', total_assets: '1200', created_at: '2026-11-12T01:00:00.000Z',
          official_players: { real_name: '박병윤' },
          game_sessions: { class_id: 'c2', classes: { name: '2026 시즌1', kind: 'official' } },
        },
        {
          session_id: 's9', official_player_id: null, character: 'bear', total_assets: '10', created_at: '2026-11-12T01:00:00.000Z',
          official_players: null,
          game_sessions: { class_id: 'c1', classes: { name: '1반', kind: 'class' } },
        },
      ],
      error: null,
    })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getOfficialResultRows } = await import('./db.js')
    const rows = await getOfficialResultRows({ classId: 'c2' })

    expect(builder.eq).toHaveBeenCalledWith('game_sessions.class_id', 'c2')
    expect(rows).toEqual([{
      sessionId: 's1', contestId: 'c2', contestName: '2026 시즌1',
      officialPlayerId: 'op1', realName: '박병윤', character: 'fox',
      totalAssets: 1200, createdAt: '2026-11-12T01:00:00.000Z',
    }])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/db.test.js`
Expected: FAIL (official_player_id 없음, 대회 결과가 걸러지지 않음, `getOfficialResultRows` 없음)

- [ ] **Step 3: 구현**

`server/db.js`를 다음처럼 수정한다.

(a) `saveGameResult`의 `rows` 매핑에서 `real_estate_value` 다음 줄에 추가:
```js
      // 공식전(대회) 결과를 공식 참가자와 연결한다. 일반 게임은 null.
      official_player_id: player.officialPlayerId ?? null,
```

(b) `getGameResult`의 세션 select를 `'*, classes(name, kind)'`로 바꾼다.

(c) `RANKING_SELECT`의 `classes(name)`를 `classes(name, kind)`로 바꾼다.

(d) `getRankings`에서 `const { data, error } = await query` / `if (error) throw error` 바로 다음에 추가하고, 이후 코드의 `data`를 `visible`로 바꾼다.
```js
  // 전체 범위(일반 랭킹)에서는 공식전(대회) 결과를 뺀다. 공식전은 테이블마다 가격이 달라
  // 총자산 비교가 불공정하므로 공식 랭킹에서만 순위 포인트로 보여 준다.
  // 대회를 직접 고른 경우(classId)는 관리자 화면이 수업과 똑같이 보여 줘야 해서 그대로 둔다.
  const visible = classId
    ? data
    : data.filter(r => r.game_sessions?.classes?.kind !== 'official')
```
즉 `sorted` 계산이 다음처럼 된다.
```js
  const sorted = isNetWorth
    ? [...visible].sort((a, b) => netWorthOf(b) - netWorthOf(a))
    : visible
```

(e) 파일 끝에 추가:
```js
const OFFICIAL_SELECT = 'session_id, official_player_id, character, total_assets, created_at, official_players(real_name), game_sessions!inner(class_id, classes!inner(name, kind))'

// 공식 랭킹 계산(server/officialRanking.js)의 입력 형태로 대회 결과를 가져온다.
// classId가 없으면 모든 대회(누적), 있으면 그 대회만 가져온다.
export async function getOfficialResultRows({ classId = null } = {}) {
  let query = supabase
    .from('game_results')
    .select(OFFICIAL_SELECT)
    .eq('game_sessions.classes.kind', 'official')
  if (classId) query = query.eq('game_sessions.class_id', classId)

  const { data, error } = await query
  if (error) throw error

  // 중첩 필터가 적용되지 않는 환경에서도 대회 결과만 남도록 한 번 더 거른다.
  return data
    .filter(r => r.game_sessions?.classes?.kind === 'official')
    .map(r => ({
      sessionId: r.session_id,
      contestId: r.game_sessions.class_id,
      contestName: r.game_sessions.classes.name,
      officialPlayerId: r.official_player_id,
      realName: r.official_players?.real_name ?? null,
      character: r.character,
      totalAssets: Number(r.total_assets),
      createdAt: r.created_at,
    }))
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/db.test.js`
Expected: PASS (기존 getRankings 테스트 포함)

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: save official player on results and keep contests out of general ranking"
```

---

### Task 6: rooms.js — 대회 방과 입장 검증

**Files:**
- Modify: `server/rooms.js` (`createRoom`, `addPlayer`, `addManualPlayer`)
- Test: `server/rooms.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`server/rooms.test.js` 끝에 추가:

```js
describe('대회 방', () => {
  const gameState = {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    jobVisited: true, stocksVisited: true, realEstateVisited: true, isCompleted: true,
  }

  it('isOfficial을 저장한다(기본 false)', () => {
    expect(createRoom().isOfficial).toBe(false)
    expect(createRoom({ classId: 'c1', isOfficial: true }).isOfficial).toBe(true)
  })

  it('대회 방은 officialPlayerId 없이 들어올 수 없다', () => {
    const { code } = createRoom({ classId: 'c1', isOfficial: true })
    expect(() => addPlayer(code, { socketId: 's1', name: '박병윤', character: 'fox', playerUuid: 'u1' }))
      .toThrow('Official player required')
  })

  it('대회 방에 들어오면 officialPlayerId를 플레이어에 저장한다', () => {
    const { code } = createRoom({ classId: 'c1', isOfficial: true })
    addPlayer(code, { socketId: 's1', name: '박병윤', character: 'fox', playerUuid: 'u1', officialPlayerId: 'op1' })
    expect(getRoom(code).players[0].officialPlayerId).toBe('op1')
  })

  it('같은 공식 참가자가 다른 기기로 같은 방에 또 들어오면 거절한다', () => {
    const { code } = createRoom({ classId: 'c1', isOfficial: true })
    addPlayer(code, { socketId: 's1', name: '박병윤', character: 'fox', playerUuid: 'u1', officialPlayerId: 'op1' })
    expect(() => addPlayer(code, { socketId: 's2', name: '박병윤', character: 'bear', playerUuid: 'u2', officialPlayerId: 'op1' }))
      .toThrow('Official player already in room')
  })

  it('같은 playerUuid의 재접속은 officialPlayerId 없이도 허용한다', () => {
    const { code } = createRoom({ classId: 'c1', isOfficial: true })
    addPlayer(code, { socketId: 's1', name: '박병윤', character: 'fox', playerUuid: 'u1', officialPlayerId: 'op1' })
    addPlayer(code, { socketId: 's9', name: '박병윤', character: 'fox', playerUuid: 'u1' })
    const players = getRoom(code).players
    expect(players).toHaveLength(1)
    expect(players[0]).toMatchObject({ socketId: 's9', officialPlayerId: 'op1' })
  })

  it('일반 방은 officialPlayerId를 무시하고 null로 둔다', () => {
    const { code } = createRoom({ classId: 'c1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'fox', playerUuid: 'u1', officialPlayerId: 'op1' })
    expect(getRoom(code).players[0].officialPlayerId).toBeNull()
  })

  it('수동 추가도 대회 방이면 officialPlayerId가 필요하고 중복을 막는다', () => {
    const { code } = createRoom({ classId: 'c1', isOfficial: true })
    expect(() => addManualPlayer(code, { name: '박병윤', character: 'fox', gameState })).toThrow('Official player required')
    addManualPlayer(code, { name: '박병윤', character: 'fox', gameState, officialPlayerId: 'op1' })
    expect(getRoom(code).players[0].officialPlayerId).toBe('op1')
    expect(() => addManualPlayer(code, { name: '박병윤', character: 'bear', gameState, officialPlayerId: 'op1' }))
      .toThrow('Official player already in room')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: FAIL (`isOfficial` undefined 등)

- [ ] **Step 3: 구현**

(a) `createRoom`을 다음으로 바꾼다.
```js
// isOfficial: 공식전(대회) 방. 방을 만들 때 수업 종류를 한 번 조회해 저장해 두고,
// 입장 검증 때마다 DB를 다시 보지 않는다.
export function createRoom({ classId = null, title = null, isOfficial = false } = {}) {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const now = new Date()
  const room = { code, createdAt: now, updatedAt: now, players: [], prices: defaultPrices(), classId, title, isOfficial: Boolean(isOfficial) }
  rooms.set(code, room)
  return room
}
```

(b) `rooms.js`의 `createRoom` 위에 헬퍼를 추가한다.
```js
// 대회 방의 새 참가자 검증. 공식 참가자 없이는 들어올 수 없고, 한 사람이 같은 테이블에
// 두 자리를 차지할 수 없다(결과가 같은 사람 기록으로 두 번 누적되므로).
function assertOfficialSeat(room, officialPlayerId) {
  if (!room.isOfficial) return
  if (!officialPlayerId) throw new Error('Official player required')
  if (room.players.some(p => p.officialPlayerId === officialPlayerId)) {
    throw new Error('Official player already in room')
  }
}
```

(c) `addPlayer` 시그니처에 `officialPlayerId = null`을 추가한다.
```js
export function addPlayer(code, { socketId, name, character, isHost, playerUuid, affiliation = '', officialPlayerId = null }) {
```
재접속 분기(`if (existing) { ... return room }`)는 그대로 두고, 그 뒤의 `if (room.players.length >= MAX_PLAYERS) throw ...` 줄을 다음으로 바꾼다.
```js
  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')
  assertOfficialSeat(room, officialPlayerId)
  room.players.push({
    socketId, name, character, isHost, playerUuid, affiliation, connected: true, gameState: defaultGameState(),
    officialPlayerId: room.isOfficial ? officialPlayerId : null,
  })
```

(d) `addManualPlayer`를 다음으로 바꾼다.
```js
export function addManualPlayer(code, { name, character, gameState, officialPlayerId = null }) {
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')
  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')
  assertOfficialSeat(room, officialPlayerId)

  const playerUuid = crypto.randomUUID()
  room.players.push({
    socketId: null, name, character, isHost: false, playerUuid, affiliation: '', connected: true, gameState,
    officialPlayerId: room.isOfficial ? officialPlayerId : null,
  })
  room.updatedAt = new Date()
  return room
}
```

> 기존 `addManualPlayer` 테스트가 `toMatchObject`라서 새 필드 `officialPlayerId: null`이 있어도 통과한다. 기존 테스트 중 `room.players[0]`를 `toEqual`로 비교하는 것이 있으면 `officialPlayerId: null`을 기대값에 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/rooms.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/rooms.js server/rooms.test.js
git commit -m "feat: require official player to join contest rooms"
```

---

### Task 7: index.js API 연결

`server/index.js`는 테스트 파일이 없다. 로직은 Task 2~6 모듈에서 테스트했으므로, 여기서는 연결만 하고 Step 4에서 실제 서버로 확인한다.

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: import 수정**

```js
import { saveGameResult, getGameResult, getRankings, getAllCompletedTeams, updateGameResult, updateSessionTitle, deleteCompletedTeam, deleteCompletedTeamsByClassId, getSessionIdByTeamCode, getSessionCreatedAtsByClassId, getOfficialResultRows } from './db.js'
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, getClassInfo, listOfficialContests, UNASSIGNED_CLASS } from './classes.js'
import { resolveOfficialPlayer, getOfficialPlayer } from './officialPlayers.js'
import { buildOfficialRankings } from './officialRanking.js'
```

- [ ] **Step 2: 방 생성 두 곳에 `isOfficial` 반영**

`app.post('/api/rooms', ...)`를 다음으로 바꾼다.
```js
app.post('/api/rooms', async (req, res) => {
  const classId = req.body?.classId ?? null
  try {
    const { kind } = await getClassInfo(classId)
    const room = createRoom({ classId, isOfficial: kind === 'official' })
    broadcastClassRooms(room.classId)
    res.json({ code: room.code })
  } catch (err) {
    console.error('room create error:', err)
    res.status(500).json({ error: 'Failed to create room' })
  }
})
```

`app.post('/api/admin/rooms', ...)`의 `const room = createRoom({ classId: resolvedClassId, title })`를 다음으로 바꾼다.
```js
    const { kind } = await getClassInfo(resolvedClassId)
    const room = createRoom({ classId: resolvedClassId, title, isOfficial: kind === 'official' })
```

- [ ] **Step 3: 새 API와 기존 API 수정**

(a) `app.post('/api/rooms', ...)` 바로 아래에 추가:
```js
// 입장 화면(NameInput)이 대회인지 판별할 때 쓴다.
app.get('/api/classes/:classId/kind', async (req, res) => {
  try {
    res.json(await getClassInfo(req.params.classId))
  } catch (err) {
    console.error('class kind error:', err)
    res.status(500).json({ error: 'Failed to fetch class kind' })
  }
})

// 팀 QR이나 팀 코드로 들어온 경우의 판별. 방이 속한 수업의 종류를 돌려준다.
app.get('/api/rooms/:code/kind', async (req, res) => {
  const room = getRoom(req.params.code.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Room not found' })
  try {
    const info = await getClassInfo(room.classId)
    res.json({ ...info, classId: room.classId })
  } catch (err) {
    console.error('room kind error:', err)
    res.status(500).json({ error: 'Failed to fetch room kind' })
  }
})

// 실명 입력 단계: 같은 대회에 같은 실명이 있는지 확인하고 공식 참가자를 찾거나 만든다.
app.post('/api/contests/:classId/players/resolve', async (req, res) => {
  const { classId } = req.params
  const { realName, confirm } = req.body ?? {}
  if (!String(realName ?? '').trim()) return res.status(400).json({ error: 'realName이 필요합니다' })
  try {
    const info = await getClassInfo(classId)
    if (info.kind !== 'official') return res.status(400).json({ error: '대회가 아닙니다' })
    res.json(await resolveOfficialPlayer({ classId, contestName: info.name, realName, confirm: Boolean(confirm) }))
  } catch (err) {
    console.error('resolve official player error:', err)
    res.status(500).json({ error: 'Failed to resolve official player' })
  }
})

app.get('/api/official-rankings', async (req, res) => {
  const classId = req.query.classId || null
  try {
    const [contests, rows] = await Promise.all([
      listOfficialContests(),
      getOfficialResultRows({ classId }),
    ])
    res.json({ contests, ...buildOfficialRankings(rows) })
  } catch (err) {
    console.error('official rankings error:', err)
    res.status(500).json({ error: 'Failed to fetch official rankings' })
  }
})
```

(b) `app.post('/api/admin/classes', ...)`에서 다음 두 줄을 바꾼다.
```js
  const { name, kind } = req.body
```
```js
    const cls = await createClass(name, req.admin.adminId, kind)
```

(c) `/api/admin/rooms` 목록의 `liveRooms` 매핑에서 `title: room.title,` 다음에 `isOfficial: room.isOfficial,`를 추가한다.

(d) `/api/admin/rooms/:code/players`(수동 추가)를 수정한다. body 구조분해에 `officialPlayerId`를 추가한다.
```js
  const { name, character, job, badges, stocks, realEstate, cash, officialPlayerId } = req.body ?? {}
```
`try {` 바로 안, `addManualPlayer` 호출 전에 추가:
```js
    const target = getRoom(code)
    if (target?.isOfficial) {
      const official = await getOfficialPlayer(officialPlayerId)
      if (!official || official.class_id !== target.classId) {
        return res.status(400).json({ error: '대회 참가자를 확인할 수 없어요' })
      }
    }
```
호출을 바꾼다.
```js
    const room = addManualPlayer(code, { name: name.trim(), character, gameState, officialPlayerId: officialPlayerId ?? null })
```

(e) `/api/results/:sessionId` 응답에서 `className,` 다음에 `classKind: session.classes?.kind ?? 'class',`를 추가하고, 각 플레이어 매핑의 `playerUuid: r.player_uuid,` 다음에 `officialPlayerId: r.official_player_id ?? null,`를 추가한다.

(f) `socket.on('join-room', ...)`을 다음으로 바꾼다.
```js
  socket.on('join-room', async ({ code, name, character, isHost, playerUuid, affiliation, officialPlayerId }, callback) => {
    const upper = code.toUpperCase()
    try {
      // 대회 방의 새 참가자는 공식 참가자 id가 이 대회 소속이어야 한다.
      // 같은 playerUuid의 재접속은 이미 검증된 자리라 건너뛴다.
      const target = getRoom(upper)
      const isRejoin = target?.players.some(p => p.playerUuid && p.playerUuid === playerUuid)
      if (target?.isOfficial && !isRejoin && officialPlayerId) {
        const official = await getOfficialPlayer(officialPlayerId)
        if (!official || official.class_id !== target.classId) throw new Error('Official player not in contest')
      }

      const room = addPlayer(upper, {
        socketId: socket.id, name, character, isHost: !!isHost, playerUuid, affiliation, officialPlayerId: officialPlayerId ?? null,
      })
      socket.join(upper)
      io.to(upper).emit('room-updated', { players: room.players })
      broadcastClassRooms(room.classId)
      callback?.({ ok: true })
    } catch (err) {
      callback?.({ ok: false, error: err.message })
    }
  })
```

- [ ] **Step 4: 실행 확인**

Run: `node --check server/index.js`
Expected: 출력 없음(문법 오류 없음)

Run: `npx vitest run server`
Expected: PASS

마이그레이션이 적용된 DB가 있으면 `npm run dev`로 띄운 뒤 다음을 확인한다.
- `curl -s localhost:3001/api/official-rankings`가 `{"contests":[...],"points":[],"bestAssets":[]}` 형태를 돌려주는지 확인한다.
- `curl -s localhost:3001/api/classes/unassigned/kind`가 `{"kind":"class","name":null}`를 돌려주는지 확인한다.

DB가 준비되지 않았으면 이 확인은 Task 17에서 한다.

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat: wire official ranking and contest entry APIs"
```

---

### Task 8: 프론트 유틸 — 입장 종류, resolve, 공식 id 기억

**Files:**
- Create: `src/utils/officialPlayer.js`
- Test: `src/utils/officialPlayer.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchEntryKind, resolveOfficialPlayer, rememberOfficialPlayer, getRememberedOfficialPlayers } from './officialPlayer'

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn()
})

describe('fetchEntryKind', () => {
  it('classId가 있으면 수업 종류 API를 부른다', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ kind: 'official', name: '2026 시즌1' }) })
    expect(await fetchEntryKind({ classId: 'c1' })).toEqual({ kind: 'official', name: '2026 시즌1', classId: 'c1' })
    expect(global.fetch).toHaveBeenCalledWith('/api/classes/c1/kind')
  })

  it('code만 있으면 방 종류 API를 부른다', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ kind: 'official', name: '시즌1', classId: 'c9' }) })
    expect(await fetchEntryKind({ code: 'AB12CD' })).toEqual({ kind: 'official', name: '시즌1', classId: 'c9' })
    expect(global.fetch).toHaveBeenCalledWith('/api/rooms/AB12CD/kind')
  })

  it('실패하거나 둘 다 없으면 일반으로 본다', async () => {
    global.fetch.mockRejectedValue(new Error('down'))
    expect(await fetchEntryKind({ classId: 'c1' })).toEqual({ kind: 'class', name: null, classId: 'c1' })
    expect(await fetchEntryKind({})).toEqual({ kind: 'class', name: null, classId: null })
  })
})

describe('resolveOfficialPlayer', () => {
  it('실명과 confirm을 POST하고 응답을 돌려준다', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ officialPlayerId: 'op1' }) })
    expect(await resolveOfficialPlayer('c1', '박병윤', true)).toEqual({ officialPlayerId: 'op1' })
    expect(global.fetch).toHaveBeenCalledWith('/api/contests/c1/players/resolve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ realName: '박병윤', confirm: true }),
    }))
  })

  it('응답이 실패면 에러를 던진다', async () => {
    global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'x' }) })
    await expect(resolveOfficialPlayer('c1', '박병윤')).rejects.toThrow()
  })
})

describe('공식 id 기억', () => {
  it('대회별로 저장하고 읽는다', () => {
    rememberOfficialPlayer('c1', 'op1')
    rememberOfficialPlayer('c2', 'op2')
    expect(getRememberedOfficialPlayers()).toEqual({ c1: 'op1', c2: 'op2' })
  })

  it('저장값이 깨져 있으면 빈 객체를 돌려준다', () => {
    localStorage.setItem('official_player_ids', '{broken')
    expect(getRememberedOfficialPlayers()).toEqual({})
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/utils/officialPlayer.test.js`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```js
const STORAGE_KEY = 'official_player_ids'

// 입장 화면이 대회인지 판별한다. 실패하면 일반 흐름으로 진행한다
// (대회 방이면 서버 join-room이 공식 참가자 없는 입장을 다시 막는다).
export async function fetchEntryKind({ classId, code } = {}) {
  const fallback = { kind: 'class', name: null, classId: classId || null }
  const url = classId
    ? `/api/classes/${encodeURIComponent(classId)}/kind`
    : code ? `/api/rooms/${encodeURIComponent(code.toUpperCase())}/kind` : null
  if (!url) return fallback
  try {
    const res = await fetch(url)
    if (!res.ok) return fallback
    const data = await res.json()
    return { kind: data.kind ?? 'class', name: data.name ?? null, classId: data.classId ?? classId ?? null }
  } catch {
    return fallback
  }
}

export async function resolveOfficialPlayer(classId, realName, confirm = false) {
  const res = await fetch(`/api/contests/${encodeURIComponent(classId)}/players/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ realName, confirm }),
  })
  if (!res.ok) throw new Error('resolve failed')
  return res.json()
}

// 공식 랭킹의 "내 기록"은 기기 단위로 찾는다. 결과 화면에서 내 공식 참가자 id를 대회별로 기억한다.
export function getRememberedOfficialPlayers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function rememberOfficialPlayer(classId, officialPlayerId) {
  if (!classId || !officialPlayerId) return
  try {
    const next = { ...getRememberedOfficialPlayers(), [classId]: officialPlayerId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 "내 기록" 고정만 빠진다.
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/utils/officialPlayer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/officialPlayer.js src/utils/officialPlayer.test.js
git commit -m "feat: add client helpers for official entry"
```

---

### Task 9: 실명 확인 훅과 AlertModal 취소 버튼

**Files:**
- Create: `src/hooks/useOfficialNameResolve.js`
- Modify: `src/components/AlertModal.jsx`, `src/components/AlertModal.module.css`
- Test: `src/components/AlertModal.test.jsx`, `src/hooks/useOfficialNameResolve.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/AlertModal.test.jsx` 끝에 추가:
```jsx
describe('AlertModal 취소 버튼', () => {
  it('onCancel을 주면 취소 버튼을 보여 주고 누르면 호출한다', async () => {
    const onCancel = vi.fn()
    render(<AlertModal message="맞나요?" confirmLabel="네, 맞아요" cancelLabel="아니요" onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: '아니요' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('onCancel이 없으면 버튼은 하나다', () => {
    render(<AlertModal message="안내" onConfirm={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
```
(이 파일은 이미 `render`, `screen`, `userEvent`, `vi`를 import한다.)

`src/hooks/useOfficialNameResolve.test.jsx`:
```jsx
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import useOfficialNameResolve from './useOfficialNameResolve'

beforeEach(() => { global.fetch = vi.fn() })

function reply(body) {
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) })
}

describe('useOfficialNameResolve', () => {
  it('같은 이름이 없으면 submit이 id를 돌려준다', async () => {
    reply({ officialPlayerId: 'op1' })
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    let id
    await act(async () => { id = await result.current.submit('박병윤') })
    expect(id).toBe('op1')
    expect(result.current.confirmLabel).toBeNull()
  })

  it('같은 이름이 있으면 확인 문구를 세우고, confirm하면 id를 돌려준다', async () => {
    reply({ exists: true, label: '박병윤 (2026 시즌1)' })
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    await act(async () => { await result.current.submit('박병윤') })
    expect(result.current.confirmLabel).toBe('박병윤 (2026 시즌1)')

    reply({ officialPlayerId: 'op-old' })
    let id
    await act(async () => { id = await result.current.confirm() })
    expect(id).toBe('op-old')
    expect(global.fetch).toHaveBeenLastCalledWith('/api/contests/c1/players/resolve', expect.objectContaining({
      body: JSON.stringify({ realName: '박병윤', confirm: true }),
    }))
  })

  it('reject하면 확인 문구를 닫고 중복 안내를 켠다', async () => {
    reply({ exists: true, label: '박병윤 (2026 시즌1)' })
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    await act(async () => { await result.current.submit('박병윤') })
    act(() => result.current.reject())
    expect(result.current.confirmLabel).toBeNull()
    expect(result.current.duplicateNotice).toBe(true)
  })

  it('요청이 실패하면 오류 문구를 세우고 null을 돌려준다', async () => {
    global.fetch.mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    let id
    await act(async () => { id = await result.current.submit('박병윤') })
    expect(id).toBeNull()
    expect(result.current.error).toBe('참가자 확인 중 오류가 발생했어요. 다시 시도해 주세요.')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/AlertModal.test.jsx src/hooks/useOfficialNameResolve.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/components/AlertModal.jsx`:
```jsx
import styles from './AlertModal.module.css'

// 확인 버튼 하나짜리 안내 모달. 사용자가 반드시 인지해야 하고 화면이
// 크게 바뀌는 상황(방 삭제, 강퇴 등)에 쓴다. 단순 정보는 toast()를 쓸 것.
// onCancel을 주면 취소 버튼이 함께 나와 예/아니요 확인에도 쓸 수 있다.
export default function AlertModal({ title, message, confirmLabel = '확인', onConfirm, cancelLabel = '취소', onCancel }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="alertdialog" aria-modal="true">
        {title && <div className={styles.title}>{title}</div>}
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {onCancel && (
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`src/components/AlertModal.module.css` 끝에 추가:
```css
.actions {
  display: flex;
  gap: clamp(8px, calc(10px * min(var(--sx, 1), var(--sy, 1))), 10px);
}

.actions > button {
  flex: 1;
}

.cancelBtn {
  height: clamp(40px, calc(48px * min(var(--sx, 1), var(--sy, 1))), 48px);
  border-radius: clamp(12px, calc(16px * min(var(--sx, 1), var(--sy, 1))), 16px);
  background: var(--white);
  border: 2px solid var(--line);
  color: var(--ink-2);
  font-size: clamp(14px, calc(16px * min(var(--sx, 1), var(--sy, 1))), 16px);
  font-weight: 700;
}
```

`src/hooks/useOfficialNameResolve.js`:
```js
import { useState } from 'react'
import { resolveOfficialPlayer } from '../utils/officialPlayer'

const ERROR_MESSAGE = '참가자 확인 중 오류가 발생했어요. 다시 시도해 주세요.'

// 대회 실명 확인 흐름. 참가자 이름 입력(NameInput)과 관리자 수동 추가 모달이 함께 쓴다.
// submit/confirm은 공식 참가자 id가 정해지면 그 id를, 아니면(확인 대기·오류) null을 돌려준다.
export default function useOfficialNameResolve(classId) {
  const [pendingName, setPendingName] = useState(null)
  const [confirmLabel, setConfirmLabel] = useState(null)
  const [duplicateNotice, setDuplicateNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(name, confirm) {
    setBusy(true)
    setError('')
    try {
      const data = await resolveOfficialPlayer(classId, name, confirm)
      if (data.exists) {
        setPendingName(name)
        setConfirmLabel(data.label)
        return null
      }
      setPendingName(null)
      setConfirmLabel(null)
      setDuplicateNotice(false)
      return data.officialPlayerId
    } catch {
      setError(ERROR_MESSAGE)
      return null
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    error,
    confirmLabel,
    duplicateNotice,
    submit: name => {
      setDuplicateNotice(false)
      return run(name, false)
    },
    confirm: () => run(pendingName, true),
    reject: () => {
      setPendingName(null)
      setConfirmLabel(null)
      setDuplicateNotice(true)
    },
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/AlertModal.test.jsx src/hooks/useOfficialNameResolve.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AlertModal.jsx src/components/AlertModal.module.css src/components/AlertModal.test.jsx src/hooks/useOfficialNameResolve.js src/hooks/useOfficialNameResolve.test.jsx
git commit -m "feat: add official name confirm flow hook"
```

---

### Task 10: NameInput 대회 분기

**Files:**
- Modify: `src/pages/NameInput.jsx`, `src/pages/NameInput.module.css`
- Test: `src/pages/NameInput.test.jsx`

- [ ] **Step 1: 테스트 수정과 추가**

`src/pages/NameInput.test.jsx` 전체를 다음으로 바꾼다. 기존 4개 테스트는 대회 판별을 기다리도록 고치고, 대회 테스트를 추가한다.

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import NameInput from './NameInput'

function mockApi({ kind = 'class', name = null, classId = null, resolve = [] } = {}) {
  const resolveQueue = [...resolve]
  global.fetch = vi.fn(url => {
    if (url.endsWith('/kind')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ kind, name, classId }) })
    }
    if (url.includes('/players/resolve')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(resolveQueue.shift()) })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

async function renderAt(path) {
  render(<MemoryRouter initialEntries={[path]}><NameInput /></MemoryRouter>)
  const input = screen.getByRole('textbox')
  await waitFor(() => expect(input).not.toBeDisabled())
  return input
}

describe('NameInput', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockApi()
  })

  it('이름 입력 필드와 다음 버튼을 렌더링한다', async () => {
    await renderAt('/name?code=ABC123')
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
    expect(screen.getByText('다음 →')).toBeInTheDocument()
  })

  it('소속 입력란은 더 이상 렌더링하지 않는다', async () => {
    await renderAt('/name')
    expect(screen.queryByPlaceholderText('예) 경영학과')).not.toBeInTheDocument()
  })

  it('이름 입력 후 /select로 이동한다', async () => {
    const input = await renderAt('/name?code=ABC123')
    fireEvent.change(input, { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?name=%EC%B2%A0%EC%88%98&code=ABC123')
  })

  it('이름이 비어있으면 이동하지 않는다', async () => {
    await renderAt('/name?code=ABC123')
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('NameInput 대회', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('대회 QR로 들어오면 대회 이름과 실명 안내를 보여 준다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1' })
    await renderAt('/join?classId=c1')
    expect(screen.getByText('2026 시즌1')).toBeInTheDocument()
    expect(screen.getByText('실명을 입력하세요')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('예) 홍길동 (실명)')).toBeInTheDocument()
  })

  it('같은 이름이 없으면 officialPlayerId를 붙여 /select로 간다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1', resolve: [{ officialPlayerId: 'op1' }] })
    const input = await renderAt('/join?classId=c1')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/select?name=${encodeURIComponent('박병윤')}&classId=c1&officialPlayerId=op1`,
    ))
  })

  it('같은 이름이 있으면 확인 팝업을 띄우고 [네, 맞아요]로 기존 참가자로 간다', async () => {
    mockApi({
      kind: 'official', name: '2026 시즌1', classId: 'c1',
      resolve: [{ exists: true, label: '박병윤 (2026 시즌1)' }, { officialPlayerId: 'op-old' }],
    })
    const input = await renderAt('/join?classId=c1')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(await screen.findByText('박병윤 (2026 시즌1) 님이 맞나요?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '네, 맞아요' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/select?name=${encodeURIComponent('박병윤')}&classId=c1&officialPlayerId=op-old`,
    ))
  })

  it('[아니요]를 누르면 팝업을 닫고 이름을 바꾸라고 안내한다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1', resolve: [{ exists: true, label: '박병윤 (2026 시즌1)' }] })
    const input = await renderAt('/join?classId=c1')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    fireEvent.click(await screen.findByRole('button', { name: '아니요' }))
    expect(screen.queryByText('박병윤 (2026 시즌1) 님이 맞나요?')).not.toBeInTheDocument()
    expect(screen.getByText('같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: 박병윤B)')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('팀 코드로 들어와도 방이 대회면 그 대회 기준으로 확인한다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1', resolve: [{ officialPlayerId: 'op1' }] })
    const input = await renderAt('/join?code=AB12CD')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/select?name=${encodeURIComponent('박병윤')}&code=AB12CD&officialPlayerId=op1`,
    ))
    expect(global.fetch).toHaveBeenCalledWith('/api/contests/c1/players/resolve', expect.anything())
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/NameInput.test.jsx`
Expected: FAIL (대회 UI 없음)

- [ ] **Step 3: 구현**

`src/pages/NameInput.jsx` 전체:
```jsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import AlertModal from '../components/AlertModal'
import useBodyClass from '../hooks/useBodyClass'
import useOfficialNameResolve from '../hooks/useOfficialNameResolve'
import { fetchEntryKind } from '../utils/officialPlayer'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  useBodyClass('onboarding-mode')

  const code = searchParams.get('code') ?? ''
  const classId = searchParams.get('classId') ?? ''

  // 대회(공식전)인지 판별이 끝나기 전에는 입력을 막아 일반 → 대회 화면 전환이 깜빡이지 않게 한다.
  const [entry, setEntry] = useState(null)
  const checking = entry === null && Boolean(code || classId)
  useEffect(() => {
    if (!code && !classId) return
    let cancelled = false
    fetchEntryKind({ classId, code }).then(info => { if (!cancelled) setEntry(info) })
    return () => { cancelled = true }
  }, [code, classId])

  const isOfficial = entry?.kind === 'official'
  const resolver = useOfficialNameResolve(entry?.classId ?? classId)

  function goNext(officialPlayerId) {
    const params = new URLSearchParams({ name: name.trim() })
    if (code) params.set('code', code)
    if (classId) params.set('classId', classId)
    if (officialPlayerId) params.set('officialPlayerId', officialPlayerId)
    navigate(`/select?${params}`)
  }

  async function handleNext() {
    if (!name.trim() || checking || resolver.busy) return
    if (!isOfficial) { goNext(); return }
    const officialPlayerId = await resolver.submit(name.trim())
    if (officialPlayerId) goNext(officialPlayerId)
  }

  async function handleConfirmYes() {
    const officialPlayerId = await resolver.confirm()
    if (officialPlayerId) goNext(officialPlayerId)
  }

  function handleConfirmNo() {
    resolver.reject()
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
      </div>
      <div className={styles.card}>
        {isOfficial && entry.name && (
          <div className={styles.contestBadge}>
            <span aria-hidden="true">🏆</span>
            <span>{entry.name}</span>
          </div>
        )}
        <div className={styles.inputGroup}>
          <label className={styles.label}>{isOfficial ? '실명을 입력하세요' : '이름을 입력하세요'}</label>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder={isOfficial ? '예) 홍길동 (실명)' : '예) 홍길동'}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={20}
            disabled={checking}
          />
          {resolver.duplicateNotice && (
            <p className={styles.notice}>같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: {name.trim()}B)</p>
          )}
          {resolver.error && <p className={styles.notice}>{resolver.error}</p>}
        </div>
        <button className={styles.gradBtn} onClick={handleNext} disabled={!name.trim() || checking || resolver.busy}>
          다음 →
        </button>
      </div>

      {resolver.confirmLabel && (
        <AlertModal
          message={`${resolver.confirmLabel} 님이 맞나요?`}
          confirmLabel="네, 맞아요"
          cancelLabel="아니요"
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      )}
    </div>
  )
}
```

`src/pages/NameInput.module.css` 끝에 추가:
```css
.contestBadge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: var(--r-pill);
  background: var(--blue-10);
  color: var(--blue-100);
  font-weight: 900;
  font-size: clamp(13px, calc(15px * min(var(--sx, 1), var(--sy, 1))), 15px);
}

.notice {
  margin-top: 8px;
  color: var(--red, #e5484d);
  font-size: clamp(12px, calc(13px * min(var(--sx, 1), var(--sy, 1))), 13px);
  line-height: 1.5;
}
```

> `--blue-10`, `--blue-100`, `--r-pill`은 `RankingPage.module.css`가 이미 쓰는 전역 토큰이다. `--red`가 없으면 fallback 색이 적용된다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/NameInput.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/NameInput.jsx src/pages/NameInput.module.css src/pages/NameInput.test.jsx
git commit -m "feat: ask for real name and confirm duplicates when joining a contest"
```

---

### Task 11: officialPlayerId 전달 (CharacterSelect, Lobby, Team, IndividualPage)

**Files:**
- Modify: `src/pages/CharacterSelect.jsx`, `src/pages/Lobby.jsx`, `src/pages/Team.jsx`, `src/pages/IndividualPage.jsx`
- Test: `src/pages/CharacterSelect.test.jsx`, `src/pages/Lobby.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/pages/CharacterSelect.test.jsx`의 `describe('CharacterSelect', ...)` 안에 추가:

```jsx
  it('URL에 officialPlayerId가 있으면 다음 화면으로 그대로 전달한다', () => {
    render(
      <MemoryRouter initialEntries={['/select?name=박병윤&classId=c1&officialPlayerId=op1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('officialPlayerId=op1'))
  })
```

`src/pages/Lobby.test.jsx`의 `describe` 안, 기존 테스트 `'classId 없이 code로 진입하면 클릭 없이 자동으로 참가한다'` 다음에 추가:
```jsx
  it('officialPlayerId를 join-room과 player_profile에 담는다', () => {
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby('/lobby?name=박병윤&character=c1&code=abc123&officialPlayerId=op1')

    expect(socket.emit).toHaveBeenCalledWith(
      'join-room',
      expect.objectContaining({ code: 'ABC123', officialPlayerId: 'op1' }),
      expect.any(Function)
    )
    expect(JSON.parse(sessionStorage.getItem('player_profile'))).toMatchObject({ officialPlayerId: 'op1' })
  })

  it('대회 입장 거절 사유를 한글로 안내한다', async () => {
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: false, error: 'Official player already in room' }))
    renderLobby('/lobby?name=박병윤&character=c1&code=abc123&officialPlayerId=op1')
    expect(await screen.findByText('이미 이 테이블에 참가 중이에요.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/CharacterSelect.test.jsx src/pages/Lobby.test.jsx`
Expected: FAIL (officialPlayerId가 전달되지 않음)

- [ ] **Step 3: 구현**

`src/pages/CharacterSelect.jsx`:
```jsx
  const officialPlayerId = searchParams.get('officialPlayerId') ?? ''
```
를 `const code = ...` 다음에 추가한다. `handleSubmit`의 `if (classId) params.set('classId', classId)` 다음에 추가한다.
```jsx
    if (officialPlayerId) params.set('officialPlayerId', officialPlayerId)
```

`src/pages/Lobby.jsx`:
1. `JOIN_ERROR_MESSAGES`에 추가한다.
```js
  'Official player required': '대회 QR로 다시 들어와 주세요.',
  'Official player not in contest': '대회 QR로 다시 들어와 주세요.',
  'Official player already in room': '이미 이 테이블에 참가 중이에요.',
```
2. `const character = ...` 다음에 추가한다.
```js
  const officialPlayerId = searchParams.get('officialPlayerId') || null
```
3. `joinRoom`의 emit과 저장을 바꾼다.
```js
    socket.emit('join-room', { code, name, affiliation, character, isHost, playerUuid, officialPlayerId }, ({ ok, error }) => {
      if (ok) {
        sessionStorage.setItem('player_profile', JSON.stringify({ name, affiliation, character, code, isHost, classId, officialPlayerId }))
```

`src/pages/Team.jsx`: `join-room` emit 두 곳의 객체에서 `playerUuid,` 다음 줄에 추가한다.
```js
      officialPlayerId: stored.officialPlayerId ?? null,
```

`src/pages/IndividualPage.jsx` 45행 근처의 emit 객체에서 `character: stored.character, isHost: false, playerUuid,` 다음에 추가한다.
```js
            officialPlayerId: stored.officialPlayerId ?? null,
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/CharacterSelect.test.jsx src/pages/Lobby.test.jsx src/pages/Team.test.jsx src/pages/IndividualPage.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/CharacterSelect.jsx src/pages/CharacterSelect.test.jsx src/pages/Lobby.jsx src/pages/Lobby.test.jsx src/pages/Team.jsx src/pages/IndividualPage.jsx
git commit -m "feat: carry official player id through join and rejoin"
```

---

### Task 12: 관리자 게임 목록 (탭 이름, two-column, 공식 뱃지)

**Files:**
- Modify: `src/components/admin/adminNavItems.js`, `src/pages/AdminClassList.jsx`, `src/pages/AdminClassList.module.css`
- Test: `src/pages/AdminClassList.test.jsx`, `src/components/admin/AdminBottomNav.test.jsx`

- [ ] **Step 1: 테스트 수정과 추가**

`src/components/admin/AdminBottomNav.test.jsx` 9행의 기대값을 바꾼다.
```js
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['게임 목록', '팀 현황', '랭킹 보기', '설정'])
```

`src/pages/AdminClassList.test.jsx`:
- `CLASSES`를 다음으로 바꾼다.
```js
const CLASSES = [
  { id: 'class-1', name: '3학년 2반', kind: 'class', createdAt: '2026-07-27T00:00:00.000Z' },
  { id: 'contest-1', name: '2026 시즌1', kind: 'official', createdAt: '2026-11-12T00:00:00.000Z' },
  { id: 'unassigned', name: '미배정 수업', kind: 'class' },
]
```
- 테스트 `'제목은 수업 목록이다'`를 `'제목은 게임 목록이다'`로 바꾸고 `getByText('게임 목록')`로 바꾼다.
- 42행 기대값을 `{ id: 'class-1', name: '3학년 2반', kind: 'class' }`로 바꾼다.
- 파일 끝 `describe` 안에 다음을 추가한다.
```jsx
  it('대회에는 공식 뱃지를 붙인다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('2026 시즌1')
    expect(screen.getAllByText('공식')).toHaveLength(1)
  })

  it('대회 생성하기는 kind official로 생성한다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('새 대회 이름'), '2026 시즌2')
    await userEvent.click(screen.getByRole('button', { name: '대회 생성하기' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '2026 시즌2', kind: 'official' }),
      })),
    )
  })

  it('대회를 고르면 kind를 함께 넘긴다', async () => {
    const onSelectClass = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={onSelectClass} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('2026 시즌1'))
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'contest-1', name: '2026 시즌1', kind: 'official' })
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/AdminClassList.test.jsx src/components/admin/AdminBottomNav.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/components/admin/adminNavItems.js`의 첫 항목 label을 `'게임 목록'`으로 바꾼다.

`src/pages/AdminClassList.jsx`:
1. state를 추가한다.
```jsx
  const [newContestName, setNewContestName] = useState('')
```
2. `handleCreateClass`를 종류별로 쓰는 함수로 바꾼다.
```jsx
  async function createEntry(kind, rawName, reset) {
    if (!rawName.trim()) {
      setShowEmptyNameWarning(kind)
      return
    }
    setError('')
    const body = kind === 'official' ? { name: rawName.trim(), kind } : { name: rawName.trim() }
    const res = await adminFetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    reset('')
    loadClasses()
  }

  function handleCreateClass(e) {
    e.preventDefault()
    createEntry('class', newClassName, setNewClassName)
  }

  function handleCreateContest(e) {
    e.preventDefault()
    createEntry('official', newContestName, setNewContestName)
  }
```
3. 제목을 `<h1 className={styles.title}>게임 목록</h1>`로 바꾼다.
4. 기존 `<form className={styles.createForm} ...>...</form>`을 다음으로 바꾼다.
```jsx
      <div className={styles.createGrid}>
        <form className={styles.createColumn} onSubmit={handleCreateClass}>
          <span className={styles.createLabel}>수업</span>
          <div className={styles.createForm}>
            <input
              className={styles.createInput}
              placeholder="새 수업 이름"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
            />
            <button type="submit" className={styles.createBtn}>수업 생성하기</button>
          </div>
        </form>
        <form className={styles.createColumn} onSubmit={handleCreateContest}>
          <span className={styles.createLabel}>대회 (공식전)</span>
          <div className={styles.createForm}>
            <input
              className={styles.createInput}
              placeholder="새 대회 이름"
              value={newContestName}
              onChange={e => setNewContestName(e.target.value)}
            />
            <button type="submit" className={styles.createBtn}>대회 생성하기</button>
          </div>
        </form>
      </div>
```
5. 목록 항목 버튼을 바꾼다.
```jsx
            <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name, kind: cls.kind ?? 'class' })}>
              <span className={styles.itemName}>
                {cls.name}
                {cls.kind === 'official' && <span className={styles.officialBadge}>공식</span>}
              </span>
```
6. 이름 비어 있음 경고의 description을 종류별로 바꾼다.
```jsx
          description={showEmptyNameWarning === 'official' ? '대회 이름을 입력해주세요' : '수업 이름을 입력해주세요'}
```
7. 삭제 확인 문구를 종류별로 바꾼다.
```jsx
          title={deleteTarget.kind === 'official' ? '대회 삭제' : '수업 삭제'}
          description={<>'{deleteTarget.name}' {deleteTarget.kind === 'official' ? '대회' : '수업'}를 삭제하면 관련된 모든 팀 기록도 함께 삭제되며 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
```

`src/pages/AdminClassList.module.css`:
- 17행 `.createForm`을 다음으로 바꾼다.
```css
.createGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; max-width: 1040px; }
.createColumn { display: flex; flex-direction: column; gap: 6px; }
.createLabel { font-size: 12px; font-weight: 700; color: var(--admin-text-2); }
.createForm { display: flex; gap: 8px; }
.officialBadge {
  display: inline-block; margin-left: 8px; padding: 2px 8px; vertical-align: middle;
  border-radius: 999px; background: var(--admin-primary, #3b5bfd); color: #fff;
  font-size: 11px; font-weight: 700;
}
```
- `@media (max-width: 767px)` 블록의 `.createForm { flex-direction: column; max-width: none; }` 다음 줄에 추가한다.
```css
  .createGrid { grid-template-columns: 1fr; max-width: none; }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/AdminClassList.test.jsx src/components/admin/AdminBottomNav.test.jsx src/pages/AdminDashboard.test.jsx`
Expected: PASS. `AdminDashboard.test.jsx`가 `'수업 목록'` 텍스트를 찾으면 `'게임 목록'`으로 고친다(테스트 이름 문자열은 그대로 둬도 된다).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/adminNavItems.js src/pages/AdminClassList.jsx src/pages/AdminClassList.module.css src/pages/AdminClassList.test.jsx src/components/admin/AdminBottomNav.test.jsx src/pages/AdminDashboard.test.jsx
git commit -m "feat: rename class list to game list and add contest creation"
```

---

### Task 13: 대회 대시보드 뱃지와 1인 집계 제외 표시

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`, `src/pages/AdminClassDashboard.jsx`, `src/pages/AdminClassDashboard.module.css`, `src/components/admin/AdminGridCard.jsx`, `src/components/admin/AdminGridCard.module.css`
- Test: `src/components/admin/AdminGridCard.test.jsx`, `src/pages/AdminClassDashboard.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/components/admin/AdminGridCard.test.jsx`에 추가한다. 파일의 `makeRoom()` fixture는 기본 플레이어가 1명이다.
```jsx
describe('AdminGridCard 대회', () => {
  it('대회의 1인 등록 팀에는 공식 집계 제외 표시를 붙인다', () => {
    render(<AdminGridCard room={makeRoom({ registered: true, status: 'completed' })} isOfficial onSpectate={vi.fn()} />)
    expect(screen.getByText('공식 집계 제외(1인)')).toBeInTheDocument()
  })

  it('일반 수업이거나 2명 이상이면 표시하지 않는다', () => {
    const { unmount } = render(<AdminGridCard room={makeRoom({ registered: true, status: 'completed' })} onSpectate={vi.fn()} />)
    expect(screen.queryByText('공식 집계 제외(1인)')).not.toBeInTheDocument()
    unmount()
    const two = makeRoom({
      registered: true, status: 'completed',
      players: [{ character: 'Adventurer-강아지', name: '김민준' }, { character: 'Adventurer-고양이', name: '이서연' }],
    })
    render(<AdminGridCard room={two} isOfficial onSpectate={vi.fn()} />)
    expect(screen.queryByText('공식 집계 제외(1인)')).not.toBeInTheDocument()
  })
})
```

`src/pages/AdminClassDashboard.test.jsx`에 추가한다. 기존 렌더링 헬퍼와 fetch mock을 그대로 쓴다.
```jsx
  it('대회면 제목 옆에 공식 뱃지를 보여 준다', async () => {
    render(<AdminClassDashboard classId="contest-1" initialName="2026 시즌1" kind="official" />)
    expect(await screen.findByText('공식')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/AdminGridCard.test.jsx src/pages/AdminClassDashboard.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/pages/AdminDashboard.jsx`의 `<AdminClassDashboard ... />`에 `kind={selectedClass.kind ?? 'class'}` prop을 추가한다.

`src/pages/AdminClassDashboard.jsx`:
- 시그니처를 `export default function AdminClassDashboard({ classId, initialName, kind = 'class' })`로 바꾸고, `const isOfficial = kind === 'official'`을 추가한다.
- `titleRow`의 `<input ... />` 다음(닫는 `</div>` 전)에 추가한다.
```jsx
      {isOfficial && <span className={styles.officialBadge}>공식</span>}
```
- 파일 안의 모든 `<AdminGridCard ... />` 사용처에 `isOfficial={isOfficial}`을 추가한다(`grep -n "<AdminGridCard" src/pages/AdminClassDashboard.jsx`로 찾는다).

`src/pages/AdminClassDashboard.module.css` 끝에 추가:
```css
.officialBadge {
  flex-shrink: 0; padding: 2px 8px; border-radius: 999px;
  background: var(--admin-primary, #3b5bfd); color: #fff; font-size: 11px; font-weight: 700;
}
```

`src/components/admin/AdminGridCard.jsx`:
- 시그니처를 `export default function AdminGridCard({ room, index = 0, onSpectate, onRoomChanged, isOfficial = false })`로 바꾼다.
- `등록 완료` 뱃지 바로 아래에 추가한다.
```jsx
        {tab === 'lobby' && room.registered && isOfficial && room.players.length === 1 && (
          <span className={styles.officialExcluded}>공식 집계 제외(1인)</span>
        )}
```

`src/components/admin/AdminGridCard.module.css` 끝에 추가:
```css
.officialExcluded {
  position: absolute; left: 8px; bottom: 8px;
  padding: 2px 8px; border-radius: 999px;
  background: var(--admin-bg); border: 1px solid var(--admin-border);
  color: var(--admin-text-3); font-size: 11px; font-weight: 700;
}
```
> `.card`가 `position: relative`가 아니면 `.officialExcluded`의 `position: absolute`를 빼고 일반 흐름으로 둔다(`.badge`의 위치 방식을 확인해서 맞춘다).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/admin/AdminGridCard.test.jsx src/pages/AdminClassDashboard.test.jsx src/pages/AdminClassDashboard.mobile.test.jsx src/pages/AdminDashboard.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminDashboard.jsx src/pages/AdminClassDashboard.jsx src/pages/AdminClassDashboard.module.css src/components/admin/AdminGridCard.jsx src/components/admin/AdminGridCard.module.css src/components/admin/AdminGridCard.test.jsx src/pages/AdminClassDashboard.test.jsx
git commit -m "feat: mark contests and single-player contest teams on the dashboard"
```

---

### Task 14: 관리자 수동 추가의 실명 확인

**Files:**
- Modify: `src/components/admin/AdminAddPlayerModal.jsx`, `src/components/admin/AdminSpectateModal.jsx`
- Test: `src/components/admin/AdminAddPlayerModal.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/components/admin/AdminAddPlayerModal.test.jsx` 끝에 추가한다(`renderModal`, `PRICES`, `CHARACTERS`는 파일 상단의 것을 쓴다).
```jsx
describe('AdminAddPlayerModal 대회', () => {
  it('대회 방이면 실명 라벨을 쓰고, 같은 이름이면 확인한 뒤 캐릭터 단계로 간다', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: true, label: '박병윤 (2026 시즌1)' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ officialPlayerId: 'op-old' }) })

    renderModal({ official: { classId: 'c1' } })
    await user.type(screen.getByLabelText('실명을 입력하세요'), '박병윤')
    await user.click(screen.getByText('다음 →'))
    expect(await screen.findByText('박병윤 (2026 시즌1) 님이 맞나요?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '네, 맞아요' }))
    expect(await screen.findByText('캐릭터 선택')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/contests/c1/players/resolve', expect.objectContaining({
      body: JSON.stringify({ realName: '박병윤', confirm: true }),
    }))
  })

  it('[아니요]를 누르면 이름 단계에 머물고 이름을 바꾸라고 안내한다', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: true, label: '박병윤 (2026 시즌1)' }) })

    renderModal({ official: { classId: 'c1' } })
    await user.type(screen.getByLabelText('실명을 입력하세요'), '박병윤')
    await user.click(screen.getByText('다음 →'))
    await user.click(await screen.findByRole('button', { name: '아니요' }))
    expect(screen.getByText('같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: 박병윤B)')).toBeInTheDocument()
    expect(screen.queryByText('캐릭터 선택')).not.toBeInTheDocument()
  })

  it('완료할 때 officialPlayerId를 함께 보낸다', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ officialPlayerId: 'op1' }) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ playerUuid: 'new-1' }) })

    renderModal({ official: { classId: 'c1' } })
    await user.type(screen.getByLabelText('실명을 입력하세요'), '박병윤')
    await user.click(screen.getByText('다음 →'))
    await user.click(await screen.findByAltText(CHARACTERS[0]))
    await user.click(screen.getByText('다음'))
    for (let i = 0; i < 4; i++) await user.click(screen.getByText('다음'))
    await user.click(screen.getByText('완료'))

    expect(global.fetch).toHaveBeenLastCalledWith('/api/admin/rooms/AB1234/players', expect.objectContaining({
      body: expect.stringContaining('"officialPlayerId":"op1"'),
    }))
  })
})
```
> 기존 "완료" 테스트는 body를 `JSON.stringify({...})`로 정확히 비교한다. 일반 방에서는 `officialPlayerId: undefined`가 직렬화에서 빠지므로 그대로 통과한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/admin/AdminAddPlayerModal.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/components/admin/AdminAddPlayerModal.jsx`:
1. import에 추가한다.
```jsx
import useOfficialNameResolve from '../../hooks/useOfficialNameResolve'
```
2. 시그니처를 `export default function AdminAddPlayerModal({ code, prices, official = null, onSaved, onClose })`로 바꾼다. `official`은 대회 방일 때 `{ classId }`다.
3. 상태와 훅을 추가한다.
```jsx
  const [officialPlayerId, setOfficialPlayerId] = useState(null)
  const resolver = useOfficialNameResolve(official?.classId)
```
4. `handleFinish`의 body에 추가한다.
```jsx
        officialPlayerId: official ? officialPlayerId : undefined,
```
5. `handleNext`의 이름 단계 처리를 바꾼다.
```jsx
  async function handleNext() {
    if (step === STEP_NAME) {
      if (!draft.name.trim()) return
      if (official) {
        if (resolver.busy) return
        const id = await resolver.submit(draft.name.trim())
        if (!id) return
        setOfficialPlayerId(id)
      }
      setStep(STEP_CHARACTER)
      return
    }
    if (step === STEP_CHARACTER && !draft.character) return
    if (step === LAST_STEP) { handleFinish(); return }
    if (assetStep >= 0) setCompletedUpTo(prev => Math.max(prev, assetStep))
    setStep(step + 1)
  }

  async function handleOfficialConfirm() {
    const id = await resolver.confirm()
    if (!id) return
    setOfficialPlayerId(id)
    setStep(STEP_CHARACTER)
  }
```
6. 이름 단계의 라벨과 placeholder를 대회에 맞게 바꾸고, 안내 문구를 추가한다.
```jsx
                <label className={nameStyles.label} htmlFor="admin-add-player-name">{official ? '실명을 입력하세요' : '이름을 입력하세요'}</label>
                <input
                  id="admin-add-player-name"
                  className={nameStyles.input}
                  placeholder={official ? '예) 홍길동 (실명)' : '예) 홍길동'}
                  value={draft.name}
                  onChange={e => { setOfficialPlayerId(null); setDraft(prev => ({ ...prev, name: e.target.value })) }}
                  onKeyDown={e => e.key === 'Enter' && handleNext()}
                  maxLength={20}
                />
                {resolver.duplicateNotice && (
                  <p className={nameStyles.notice}>같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: {draft.name.trim()}B)</p>
                )}
                {resolver.error && <p className={nameStyles.notice}>{resolver.error}</p>}
```
   다음 버튼의 `disabled`를 `!draft.name.trim() || resolver.busy`로 바꾼다.
7. `confirmCancel` 다이얼로그 위에 추가한다.
```jsx
      {resolver.confirmLabel && (
        <ConfirmDialog
          tone="primary"
          title="참가자 확인"
          description={`${resolver.confirmLabel} 님이 맞나요?`}
          confirmLabel="네, 맞아요"
          cancelLabel="아니요"
          onCancel={resolver.reject}
          onConfirm={handleOfficialConfirm}
        />
      )}
```

`src/components/admin/AdminSpectateModal.jsx`의 `<AdminAddPlayerModal ... />`에 prop을 추가한다.
```jsx
          official={room.isOfficial ? { classId: room.classId } : null}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/admin/AdminAddPlayerModal.test.jsx src/components/admin/AdminSpectateModal.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminAddPlayerModal.jsx src/components/admin/AdminAddPlayerModal.test.jsx src/components/admin/AdminSpectateModal.jsx
git commit -m "feat: confirm real name when admin adds a contest player"
```

---

### Task 15: RankingTable / RankingPodium 확장

**Files:**
- Modify: `src/components/RankingTable.jsx`, `src/components/RankingPodium.jsx`
- Test: `src/components/RankingTable.test.jsx`, `src/components/RankingPodium.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/components/RankingTable.test.jsx` 끝에 추가:
```jsx
describe('RankingTable 공식 랭킹용 prop', () => {
  const rows = [
    { rank: 1, officialPlayerId: 'op1', name: '박병윤', character: 'fox', points: 24.5, games: 5, wins: 2 },
    { rank: 2, officialPlayerId: 'op2', name: '김철수', character: 'bear', points: 10, games: 2, wins: 0 },
  ]

  it('formatValue와 getSub로 값과 둘째 줄을 바꾼다', () => {
    render(
      <RankingTable
        rows={rows}
        valueKey="points"
        formatValue={row => `${row.points}점`}
        getSub={row => `${row.games}게임 · 1위 ${row.wins}회`}
        getRowKey={row => row.officialPlayerId}
      />,
    )
    expect(screen.getByText('24.5점')).toBeInTheDocument()
    expect(screen.getByText('5게임 · 1위 2회')).toBeInTheDocument()
  })

  it('highlightKey와 getHighlightId로 내 행을 고정하고 둘째 줄도 getSub를 따른다', () => {
    render(
      <RankingTable
        rows={rows}
        highlightKey="op2"
        getHighlightId={row => row.officialPlayerId}
        formatValue={row => `${row.points}점`}
        getSub={row => `${row.games}게임`}
      />,
    )
    const pinned = screen.getByTestId('pinned-row')
    expect(within(pinned).getByText('김철수')).toBeInTheDocument()
    expect(within(pinned).getByText('2게임')).toBeInTheDocument()
  })
})
```
(파일 상단 import에 `within`이 없으면 `@testing-library/react`에서 추가한다.)

`src/components/RankingPodium.test.jsx` 끝에 추가:
```jsx
describe('RankingPodium formatValue', () => {
  it('formatValue로 값 표시를 바꾼다', () => {
    const rows = [
      { rank: 1, officialPlayerId: 'a', name: 'A', character: 'fox', points: 30 },
      { rank: 2, officialPlayerId: 'b', name: 'B', character: 'fox', points: 20 },
      { rank: 3, officialPlayerId: 'c', name: 'C', character: 'fox', points: 10 },
    ]
    render(<RankingPodium rows={rows} valueKey="points" formatValue={row => `${row.points}점`} getRowKey={row => row.officialPlayerId} />)
    expect(screen.getByText('30점')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/RankingTable.test.jsx src/components/RankingPodium.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/components/RankingTable.jsx` 상단을 다음으로 바꾼다(JSX 본문은 아래 두 곳만 고친다).
```jsx
import styles from './RankingTable.module.css'

function defaultFormatValue(row, valueKey) {
  const value = row[valueKey]
  return value == null ? '-원' : `${value.toLocaleString()}원`
}

function defaultRowKey(row) {
  return `${row.sessionId ?? ''}-${row.playerUuid ?? `${row.rank}-${row.name}`}`
}

// formatValue/getRowKey/highlightKey+getHighlightId는 공식 랭킹(포인트, officialPlayerId 기준)용.
// 기본값은 기존 일반 랭킹 동작(원 단위, playerUuid 기준)과 같다.
export default function RankingTable({
  rows, highlightPlayerUuid, onRowClick, valueKey = 'totalAssets', podium,
  getSub = row => row.className,
  formatValue: formatValueProp,
  getRowKey = defaultRowKey,
  highlightKey,
  getHighlightId = row => row.playerUuid,
}) {
  const targetId = highlightKey ?? highlightPlayerUuid
  const pinnedRow = targetId ? rows.find(r => getHighlightId(r) === targetId) : null

  function formatValue(row) {
    return formatValueProp ? formatValueProp(row) : defaultFormatValue(row, valueKey)
  }
```
본문에서:
- 행 `key={...}`를 `key={getRowKey(row)}`로 바꾼다.
- 고정 행의 `<span className={styles.pinnedAffiliation}>{pinnedRow.className}</span>`을 `<span className={styles.pinnedAffiliation}>{getSub(pinnedRow)}</span>`으로 바꾼다.

`src/components/RankingPodium.jsx`:
```jsx
import styles from './RankingPodium.module.css'

const PODIUM_ORDER = [1, 0, 2]

function defaultFormatValue(value) {
  return value == null ? '-원' : `${value.toLocaleString()}원`
}

export default function RankingPodium({
  rows, valueKey = 'totalAssets', onRowClick,
  formatValue = row => defaultFormatValue(row[valueKey]),
  getRowKey = row => row.playerUuid,
}) {
  if (rows.length === 0) return null

  const podiumRows = PODIUM_ORDER.map(i => rows[i]).filter(Boolean)

  return (
    <div className={styles.podium}>
      {podiumRows.map(row => (
        <div
          key={getRowKey(row)}
          className={`${styles.slot} ${
            row.rank === 1 ? styles.first : row.rank === 2 ? styles.second : styles.third
          }`}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          <img src={`/characters/${row.character}.png`} alt={row.character} className={styles.avatar} />
          <span className={styles.name}>{row.name}</span>
          <div className={styles.box}>
            <span className={styles.rank}>{row.rank}위</span>
            <span className={styles.value}>{formatValue(row)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

> 공동 순위(같은 rank)가 있으면 시상대 슬롯 색이 같은 등수로 표시된다. 의도한 동작이다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/RankingTable.test.jsx src/components/RankingPodium.test.jsx src/pages/RankingPage.test.jsx src/pages/AdminRankingView.test.jsx`
Expected: PASS (기존 호출부 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add src/components/RankingTable.jsx src/components/RankingPodium.jsx src/components/RankingTable.test.jsx src/components/RankingPodium.test.jsx
git commit -m "feat: let ranking table and podium format values and keys"
```

---

### Task 16: 공식 랭킹 페이지

**Files:**
- Create: `src/pages/OfficialRankingPage.jsx`, `src/pages/OfficialRankingPage.module.css`
- Modify: `src/App.jsx`
- Test: `src/pages/OfficialRankingPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```jsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OfficialRankingPage from './OfficialRankingPage'

const CONTESTS = [
  { id: 'c2', name: '2026 시즌2', createdAt: '2026-11-10T00:00:00.000Z' },
  { id: 'c1', name: '2026 시즌1', createdAt: '2026-10-01T00:00:00.000Z' },
]

function player(id, realName, contestName, points, bestAssets, rank) {
  return { officialPlayerId: id, realName, contestId: contestName === '2026 시즌1' ? 'c1' : 'c2', contestName, character: 'fox', points, games: 3, wins: 1, bestAssets, rank }
}

const ALL = {
  contests: CONTESTS,
  points: [
    player('op1', '박병윤', '2026 시즌1', 24.5, 1200000, 1),
    player('op2', '김철수', '2026 시즌2', 20, 900000, 2),
    player('op3', '이영희', '2026 시즌1', 10, 1500000, 3),
    player('op4', '최민수', '2026 시즌2', 5, 100000, 4),
  ],
  bestAssets: [
    player('op3', '이영희', '2026 시즌1', 10, 1500000, 1),
    player('op1', '박병윤', '2026 시즌1', 24.5, 1200000, 2),
    player('op2', '김철수', '2026 시즌2', 20, 900000, 3),
    player('op4', '최민수', '2026 시즌2', 5, 100000, 4),
  ],
}

function renderAt(path = '/ranking/official') {
  return render(
    <MemoryRouter initialEntries={['/ranking', path]} initialIndex={1}>
      <Routes>
        <Route path="/ranking" element={<div>일반 랭킹 화면</div>} />
        <Route path="/ranking/official" element={<OfficialRankingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn(url => {
    if (url === '/api/official-rankings') return Promise.resolve({ ok: true, json: () => Promise.resolve(ALL) })
    if (url === '/api/official-rankings?classId=c1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ contests: CONTESTS, points: [], bestAssets: [] }) })
    }
    return Promise.reject(new Error(url))
  })
})

describe('OfficialRankingPage', () => {
  it('기본은 누적 범위의 포인트 순위다. 이름 옆에 대회 이름을 붙이고 점수와 게임 수를 보여 준다', async () => {
    renderAt()
    expect(await screen.findAllByText('박병윤 (2026 시즌1)')).not.toHaveLength(0)
    expect(screen.getAllByText('24.5점').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3게임 · 1위 1회').length).toBeGreaterThan(0)
    expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings')
  })

  it('최고 자산 탭은 원 단위와 참고용 안내를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.click(screen.getByRole('button', { name: '최고 자산' }))
    expect(screen.getByText('테이블마다 가격이 달라 참고용 기록이에요.')).toBeInTheDocument()
    expect(screen.getAllByText('1,500,000원').length).toBeGreaterThan(0)
  })

  it('대회를 고르면 그 대회만 조회하고, 비어 있으면 빈 상태 문구를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '대회 선택' }), 'c1')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings?classId=c1'))
    expect(await screen.findByText('아직 집계된 공식 게임이 없어요')).toBeInTheDocument()
  })

  it('쿼리 classId로 들어오면 그 대회로 시작한다', async () => {
    renderAt('/ranking/official?classId=c1')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings?classId=c1'))
  })

  it('기억된 공식 참가자 id가 있으면 내 행을 맨 아래에 고정한다', async () => {
    localStorage.setItem('official_player_ids', JSON.stringify({ c2: 'op4' }))
    renderAt()
    const pinned = await screen.findByTestId('pinned-row')
    expect(within(pinned).getByText('최민수 (2026 시즌2)')).toBeInTheDocument()
  })

  it('뒤로가기를 누르면 이전 랭킹 화면으로 돌아간다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.click(screen.getByRole('button', { name: /뒤로/ }))
    expect(await screen.findByText('일반 랭킹 화면')).toBeInTheDocument()
  })
})
```

> `BackButton`은 `to`가 없으면 aria-label이 "뒤로 가기"다. 테스트의 `MemoryRouter`는 `window.history`를 쓰지 않으므로 `handleBack`이 `/ranking`으로 이동하는 분기를 탄다. 실제 브라우저(`BrowserRouter`)에서는 `history.state.idx`가 있어 `navigate(-1)`로 돌아간다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/OfficialRankingPage.test.jsx`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`src/pages/OfficialRankingPage.jsx` (`BackButton`은 `onClick` prop을 지원한다):
```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import useBodyClass from '../hooks/useBodyClass'
import { getRememberedOfficialPlayers } from '../utils/officialPlayer'
import rankingStyles from './RankingPage.module.css'
import styles from './OfficialRankingPage.module.css'

const TABS = [
  { key: 'points', label: '포인트 순위' },
  { key: 'bestAssets', label: '최고 자산' },
]

function formatPoints(points) {
  return `${Number.isInteger(points) ? points : points.toFixed(1)}점`
}

function formatWon(value) {
  return `${value.toLocaleString()}원`
}

export default function OfficialRankingPage() {
  useBodyClass('onboarding-mode')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const contestId = searchParams.get('classId') || ''
  const [tab, setTab] = useState('points')
  const [data, setData] = useState({ contests: [], points: [], bestAssets: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = contestId ? `/api/official-rankings?classId=${encodeURIComponent(contestId)}` : '/api/official-rankings'
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(json => { setData(json); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [contestId])

  const isCumulative = !contestId
  // 누적 범위에서는 같은 실명이 대회마다 따로 오르므로 대회 이름을 붙여 구분한다.
  const rows = useMemo(() => (data[tab] ?? []).map(p => ({
    ...p,
    name: isCumulative ? `${p.realName} (${p.contestName})` : p.realName,
  })), [data, tab, isCumulative])

  // 내 기록: 결과 화면에서 기억해 둔 공식 참가자 id. 대회별 범위는 그 대회의 id,
  // 누적 범위는 기억한 id 중 순위에 있는 첫 번째를 쓴다.
  const myId = useMemo(() => {
    const remembered = getRememberedOfficialPlayers()
    if (contestId) return remembered[contestId] ?? null
    const ids = new Set(Object.values(remembered))
    return rows.find(r => ids.has(r.officialPlayerId))?.officialPlayerId ?? null
  }, [contestId, rows])

  const isPoints = tab === 'points'
  const formatValue = isPoints ? row => formatPoints(row.points) : row => formatWon(row.bestAssets)
  const getSub = isPoints ? row => `${row.games}게임 · 1위 ${row.wins}회` : row => row.contestName
  const getRowKey = row => row.officialPlayerId
  const podiumRows = rows.slice(0, 3)

  function handleBack() {
    // 이전 화면(일반 랭킹이나 결과 화면)으로 돌아간다. 공식 랭킹으로 바로 들어와 이전 기록이 없으면 일반 랭킹으로 간다.
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/ranking')
  }

  function handleContestChange(e) {
    const next = e.target.value
    setSearchParams(next ? { classId: next } : {}, { replace: true })
  }

  return (
    <div className={rankingStyles.page}>
      <BackButton onClick={handleBack} />
      <div className={rankingStyles.inner}>
        <div className={rankingStyles.header}>
          <h1 className={rankingStyles.title}>공식 랭킹</h1>
          <p className={rankingStyles.subtitle}>대회 테이블 순위로 받은 포인트를 합산해요</p>
        </div>

        <div className={styles.scopeRow}>
          <button
            type="button"
            className={`${styles.scopeBtn} ${isCumulative ? styles.scopeBtnActive : ''}`}
            onClick={() => setSearchParams({}, { replace: true })}
          >
            누적
          </button>
          <select
            aria-label="대회 선택"
            className={`${styles.contestSelect} ${!isCumulative ? styles.contestSelectActive : ''}`}
            value={contestId}
            onChange={handleContestChange}
          >
            <option value="">대회별 보기</option>
            {data.contests.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className={rankingStyles.topTabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`${rankingStyles.topTab} ${tab === t.key ? rankingStyles.topTabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!isPoints && <p className={styles.notice}>테이블마다 가격이 달라 참고용 기록이에요.</p>}

        <hr className={rankingStyles.divider} />

        {loading && <p className={rankingStyles.message}>불러오는 중...</p>}
        {error && <p className={rankingStyles.message}>{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className={rankingStyles.message}>아직 집계된 공식 게임이 없어요</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <RankingTable
            rows={rows}
            formatValue={formatValue}
            getSub={getSub}
            getRowKey={getRowKey}
            highlightKey={myId ?? undefined}
            getHighlightId={row => row.officialPlayerId}
            podium={podiumRows.length === 3
              ? <RankingPodium rows={podiumRows} formatValue={formatValue} getRowKey={getRowKey} />
              : null}
          />
        )}
      </div>
    </div>
  )
}
```
`src/pages/OfficialRankingPage.module.css`:
```css
.scopeRow {
  display: flex;
  gap: clamp(6px, calc(8px * var(--sx)), 8px);
  margin-bottom: clamp(10px, calc(16px * var(--sy)), 16px);
  flex-shrink: 0;
}

.scopeBtn,
.contestSelect {
  height: clamp(34px, calc(42px * var(--sy)), 42px);
  border-radius: var(--r-pill);
  border: 1px solid var(--blue-10);
  background: var(--white);
  color: var(--ink-2);
  font-size: clamp(12px, calc(14px * min(var(--sx), var(--sy))), 14px);
  font-weight: 700;
}

.scopeBtn {
  padding: 0 clamp(14px, calc(20px * var(--sx)), 20px);
  flex-shrink: 0;
}

.contestSelect {
  flex: 1;
  min-width: 0;
  padding: 0 12px;
}

.scopeBtnActive,
.contestSelectActive {
  background: var(--blue-100);
  border-color: var(--blue-100);
  color: var(--white);
}

.notice {
  margin-top: clamp(8px, calc(12px * var(--sy)), 12px);
  font-size: clamp(11px, calc(13px * min(var(--sx), var(--sy))), 13px);
  color: var(--ink-2);
  text-align: center;
}
```

`src/App.jsx`: import를 추가하고 라우트를 `/ranking` 라우트 바로 다음에 추가한다.
```jsx
import OfficialRankingPage from './pages/OfficialRankingPage'
```
```jsx
        <Route path="/ranking/official" element={<OfficialRankingPage />} />
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/OfficialRankingPage.test.jsx src/App.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/OfficialRankingPage.jsx src/pages/OfficialRankingPage.module.css src/pages/OfficialRankingPage.test.jsx src/App.jsx
git commit -m "feat: add official ranking page"
```

---

### Task 17: RankingPage 연결 (버튼, "대회" 범위, 공식 id 기억)

**Files:**
- Modify: `src/pages/RankingPage.jsx`, `src/pages/RankingPage.module.css`
- Test: `src/pages/RankingPage.test.jsx`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/pages/RankingPage.test.jsx`:
1. `renderAt`의 Routes에 다음을 추가한다.
```jsx
        <Route path="/ranking/official" element={<div>공식 랭킹 화면</div>} />
```
2. 파일 끝에 추가한다.
```jsx
describe('공식 랭킹 연결', () => {
  it('홈 랭킹에 공식 랭킹 보러가기 버튼이 있고 누르면 이동한다', async () => {
    renderAt('/ranking')
    await userEvent.click(await screen.findByRole('button', { name: '공식 랭킹 보러가기' }))
    expect(await screen.findByText('공식 랭킹 화면')).toBeInTheDocument()
  })

  it('대회 게임 결과 화면에서는 범위 탭이 "대회"이고 누르면 그 대회의 공식 랭킹으로 간다', async () => {
    const original = global.fetch
    global.fetch = vi.fn(url => {
      if (url.startsWith('/api/results/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          teamCode: 'AB1234', classId: 'contest-1', className: '2026 시즌1', classKind: 'official',
          players: [{ rank: 1, name: '박병윤', character: 'fox', totalAssets: 1, playerUuid: 'me', officialPlayerId: 'op1' }],
        }) })
      }
      return original(url)
    })
    sessionStorage.setItem('player_uuid', 'me')

    renderAt('/result/s1')
    await userEvent.click(await screen.findByRole('button', { name: '대회' }))
    expect(await screen.findByText('공식 랭킹 화면')).toBeInTheDocument()
  })

  it('결과 화면에서 내 officialPlayerId를 대회별로 기억한다', async () => {
    const original = global.fetch
    global.fetch = vi.fn(url => {
      if (url.startsWith('/api/results/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          teamCode: 'AB1234', classId: 'contest-1', className: '2026 시즌1', classKind: 'official',
          players: [{ rank: 1, name: '박병윤', character: 'fox', totalAssets: 1, playerUuid: 'me', officialPlayerId: 'op1' }],
        }) })
      }
      return original(url)
    })
    sessionStorage.setItem('player_uuid', 'me')
    localStorage.removeItem('official_player_ids')

    renderAt('/result/s1')
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('official_player_ids'))).toEqual({ 'contest-1': 'op1' }),
    )
  })
})
```
> `getPlayerUuid()`는 `sessionStorage`의 `player_uuid`를 읽는다(`src/utils/playerUuid.js`).

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/pages/RankingPage.jsx`:
1. import에 추가한다.
```jsx
import { rememberOfficialPlayer } from '../utils/officialPlayer'
```
2. state를 추가한다.
```jsx
  const [isOfficialSession, setIsOfficialSession] = useState(false)
```
3. V2 세션 조회 effect의 `.then(data => { ... })` 안을 다음으로 바꾼다.
```jsx
      .then(data => {
        setMyClassId(data.classId ?? 'unassigned')
        const me = (data.players ?? []).find(p => p.playerUuid === myPlayerUuid)
        setHasMyResult(Boolean(me))
        const official = data.classKind === 'official'
        setIsOfficialSession(official)
        // 공식 랭킹의 "내 기록" 고정에 쓴다(기기 단위).
        if (official && me?.officialPlayerId) rememberOfficialPlayer(data.classId, me.officialPlayerId)
      })
```
4. 범위 탭 렌더링을 바꾼다. 대회면 "수업" 탭 이름을 "대회"로 바꾸고, 누르면 공식 랭킹으로 이동한다.
```jsx
        {isV2 && (
          <div className={styles.tabs}>
            {SCOPE_TABS.map(tab => {
              const isContestTab = tab.key === 'class' && isOfficialSession
              return (
                <button
                  key={tab.key}
                  className={`${styles.tab} ${scope === tab.key ? styles.tabActive : ''}`}
                  onClick={() => {
                    // 대회의 총자산 순위는 불공정하므로 공식 랭킹(순위 포인트)으로 보낸다.
                    if (isContestTab) {
                      navigate(`/ranking/official?classId=${encodeURIComponent(myClassId)}`)
                      return
                    }
                    setRows([])
                    setScope(tab.key)
                  }}
                >
                  {isContestTab ? '대회' : tab.label}
                </button>
              )
            })}
          </div>
        )}
```
5. 공식 랭킹 버튼을 둔다. 기존 `{isV2 && (<div className={styles.shareActions}> ... </div>)}` 블록을 다음 구조로 바꾼다. 비V2에서는 버튼 하나만 있는 `shareActions`가 렌더링된다.
```jsx
      <div className={styles.shareActions}>
        {isV2 && (
          <>
            {/* 기존 카카오 공유, 링크 복사, 만족도 조사, 경제적 잠재력 유형 버튼 그대로 */}
          </>
        )}
        <button type="button" className={styles.surveyBtn} onClick={() => navigate('/ranking/official')}>
          공식 랭킹 보러가기
        </button>
      </div>
```
   (주석 자리에는 기존 버튼 JSX 네 개를 그대로 옮긴다.)

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/pages/RankingPage.test.jsx`
Expected: PASS (기존 테스트 포함)

- [ ] **Step 5: Commit**

```bash
git add src/pages/RankingPage.jsx src/pages/RankingPage.test.jsx
git commit -m "feat: link ranking page to official ranking"
```

---

### Task 18: 전체 검증

- [ ] **Step 1: 전체 테스트**

Run: `npx vitest run`
Expected: 모든 테스트 PASS. 실패가 있으면 해당 Task로 돌아가 고친다.

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 오류 없이 `dist/` 생성

- [ ] **Step 3: 수동 E2E** (마이그레이션이 적용된 DB 필요. 적용 전이면 사용자에게 Task 1 SQL 실행을 요청한다)

`npm run dev` 후 다음을 확인한다.
1. 관리자 → 게임 목록: 탭 이름, two-column 생성 영역(모바일 폭에서는 세로로 쌓임), "2026 테스트" 대회 생성, 공식 뱃지.
2. 대회 QR URL(`/join?classId=<id>`)로 4개 탭에서 입장한다.
   - 대회 이름과 "실명을 입력하세요"가 보이는지 확인한다.
   - 두 번째 탭에 같은 이름을 넣으면 확인 팝업이 뜨는지 확인한다. [아니요] → 안내가 나오고, "박병윤B"로 진행한다.
   - 같은 사람이 같은 테이블에 다른 탭으로 들어가면 "이미 이 테이블에 참가 중이에요"가 뜨는지 확인한다.
3. 4명이 결과를 입력하고 등록한 뒤 결과 화면에서 확인한다.
   - "대회" 탭 → 공식 랭킹으로 이동하는지
   - 포인트 10/6/3/1이 맞는지
   - 내 행이 고정되는지
4. 공식 랭킹에서 누적/대회별 전환과 최고 자산 탭을 확인한다. 뒤로가기로 이전 랭킹으로 돌아오는지 확인한다.
5. `/ranking`(일반 랭킹 전체)에 방금 대회 결과가 없는지 확인한다.
6. 관리자 → 대회 대시보드 → 팀 → 수동 추가에서 실명 확인 팝업을 확인한다. 2인 팀을 등록해서 공식 랭킹에 10/6점이 반영되는지 확인한다.

- [ ] **Step 4: 정리 커밋 (필요할 때만)**

E2E에서 고친 것이 있으면 커밋한다.
```bash
git add <고친 파일>
git commit -m "fix: <고친 내용>"
```
