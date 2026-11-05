// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildClanRecap } from './clanRecap.js'

const row = (resultId, values = {}) => ({
  resultId, name: resultId, character: 'Innovator-사자', sessionId: 's1', teamName: '1조',
  stockPrices: null, realEstatePrices: null,
  cash: 0, stockValue: 0, realEstateValue: 0, totalAssets: 0, ...values,
})

describe('buildClanRecap', () => {
  it('클랜별 합계를 내고, 빈 클랜과 사라진 결과는 빼며, null은 0으로 센다', () => {
    const recap = buildClanRecap(
      [
        row('r1', { cash: 100, stockValue: 200, realEstateValue: 300, totalAssets: 700 }),
        row('r2', { cash: 50, stockValue: null, realEstateValue: 10, totalAssets: 60 }),
        row('r3', { cash: 1 }),
      ],
      [
        { id: 'k1', name: '팀 1', memberIds: ['r1', 'r2'] },
        { id: 'k2', name: '팀 2', memberIds: [] },
        { id: 'k3', name: '팀 3', memberIds: ['gone', 'r3'] },
      ],
    )
    expect(recap.teamCount).toBe(2)
    expect(recap.memberCount).toBe(3)
    expect(recap.teams).toEqual([
      {
        id: 'k1', name: '팀 1', memberCount: 2, cash: 150, stockValue: 200, realEstateValue: 310, totalAssets: 760,
        members: [
          { id: 'r1', name: 'r1', character: 'Innovator-사자', totalAssets: 700 },
          { id: 'r2', name: 'r2', character: 'Innovator-사자', totalAssets: 60 },
        ],
      },
      {
        id: 'k3', name: '팀 3', memberCount: 1, cash: 1, stockValue: 0, realEstateValue: 0, totalAssets: 0,
        members: [{ id: 'r3', name: 'r3', character: 'Innovator-사자', totalAssets: 0 }],
      },
    ])
  })

  it('클랜이 없으면 0개', () => {
    expect(buildClanRecap([row('r1')], [])).toEqual({ teamCount: 0, memberCount: 0, teams: [], games: [] })
  })

  it('음수 값은 0으로 센다', () => {
    const recap = buildClanRecap(
      [row('r1', { cash: -50, totalAssets: 10 }), row('r2', { cash: 30, totalAssets: 20 })],
      [{ id: 'k1', name: '팀 1', memberIds: ['r1', 'r2'] }],
    )
    expect(recap.teams[0].cash).toBe(30)
    expect(recap.teams[0].totalAssets).toBe(30)
  })

  it('소수 합계는 반올림한다', () => {
    const recap = buildClanRecap(
      [row('r1', { totalAssets: 100.4 }), row('r2', { totalAssets: 0.4 })],
      [{ id: 'k1', name: '팀 1', memberIds: ['r1', 'r2'] }],
    )
    expect(recap.teams[0].totalAssets).toBe(101)
  })

  it('세션별로 게임을 묶어 이름 숫자 순으로 번호를 매기고, 참여자는 총 자산 순으로 둔다', () => {
    const prices = { bio: 3000 }
    const recap = buildClanRecap(
      [
        row('r1', { sessionId: 's10', teamName: '10조', totalAssets: 100 }),
        row('r2', { sessionId: 's2', teamName: '2조', totalAssets: 100, stockPrices: prices }),
        row('r3', { sessionId: 's2', teamName: '2조', totalAssets: 900, stockPrices: prices }),
      ],
      [
        { id: 'k1', name: '팀 1', memberIds: ['r1', 'r2'] },
        { id: 'k2', name: '팀 2', memberIds: ['r3'] },
      ],
    )
    expect(recap.games.map(g => [g.id, g.name])).toEqual([['s2', '게임 1'], ['s10', '게임 2']])
    expect(recap.games[0].players.map(p => p.id)).toEqual(['r3', 'r2'])
    expect(recap.games[0].stockPrices).toEqual(prices)
    expect(recap.games[1].stockPrices).toBeNull()
  })

  it('클랜에 배정되지 않은 참여자는 게임 결과에서도 뺀다', () => {
    const recap = buildClanRecap(
      [row('r1'), row('r2', { sessionId: 's2' })],
      [{ id: 'k1', name: '팀 1', memberIds: ['r1'] }],
    )
    expect(recap.games).toHaveLength(1)
    expect(recap.games[0].players.map(p => p.id)).toEqual(['r1'])
  })
})
