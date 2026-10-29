// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildClanRecap } from './clanRecap.js'

const row = (resultId, values = {}) => ({
  resultId, cash: 0, stockValue: 0, realEstateValue: 0, totalAssets: 0, ...values,
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
    expect(recap).toEqual({
      teamCount: 2,
      memberCount: 3,
      teams: [
        { id: 'k1', name: '팀 1', memberCount: 2, cash: 150, stockValue: 200, realEstateValue: 310, totalAssets: 760 },
        { id: 'k3', name: '팀 3', memberCount: 1, cash: 1, stockValue: 0, realEstateValue: 0, totalAssets: 0 },
      ],
    })
  })

  it('클랜이 없으면 0개', () => {
    expect(buildClanRecap([row('r1')], [])).toEqual({ teamCount: 0, memberCount: 0, teams: [] })
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
})
