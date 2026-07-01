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
