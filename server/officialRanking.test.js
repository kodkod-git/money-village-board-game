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
