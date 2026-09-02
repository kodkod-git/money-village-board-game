import { describe, it, expect } from 'vitest'
import { toAdminPlayer, toAdminPrices } from './adminPlayerAdapters'

describe('toAdminPlayer', () => {
  it('랭킹 행을 관리자 플레이어 형태로 변환한다', () => {
    const row = {
      playerUuid: 'p1', name: '김민준', character: 'lion', affiliation: '서울중',
      job: 'a', cash: 1000, stockHoldings: { semiconductor: 2 }, realEstateHoldings: { gaon: 1 },
      badges: [true, false, false, false, false, false],
    }
    const p = toAdminPlayer(row)
    expect(p.name).toBe('김민준')
    expect(p.gameState.job).toBe('a')
    expect(p.gameState.isCompleted).toBe(true)
  })

  it('게임 종료 데이터이므로 job이 null이어도 무직으로 해석되도록 jobVisited: true를 붙인다', () => {
    const p = toAdminPlayer({ playerUuid: 'p1', name: 'x', character: 'lion', job: null })
    expect(p.gameState.job).toBeNull()
    expect(p.gameState.jobVisited).toBe(true)
  })
})

describe('toAdminPrices', () => {
  it('가격 정보를 관리자 형태로 변환한다', () => {
    const prices = toAdminPrices({ stockPrices: { semiconductor: 3000 }, realEstatePrices: { gaon: 20000 } })
    expect(prices.stocks.semiconductor).toBe(3000)
    expect(prices.realEstate.gaon).toBe(20000)
  })
})
