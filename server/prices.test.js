// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sanitizePrices, withSanitizedPrices, DEFAULT_PLAYER_PRICES } from './prices.js'

describe('sanitizePrices', () => {
  it('정상 값은 그대로 둔다', () => {
    const prices = {
      stocks: { semiconductor: 5000, finance: 0, bio: 1000000 },
      realEstate: { gaon: 30000, dami: 10000, chorong: 10000 },
    }
    expect(sanitizePrices(prices)).toEqual(prices)
  })

  it('모르는 키는 버리고, 빠진 키는 기본값으로 채운다', () => {
    expect(sanitizePrices({ stocks: { semiconductor: 3000, hack: 1 }, realEstate: {} })).toEqual({
      stocks: { semiconductor: 3000, finance: 2000, bio: 2000 },
      realEstate: DEFAULT_PLAYER_PRICES.realEstate,
    })
  })

  it('음수·소수·최대값 초과·문자열은 기본값으로 바꾼다', () => {
    expect(sanitizePrices({
      stocks: { semiconductor: -1, finance: 1.5, bio: 1000001 },
      realEstate: { gaon: '5000', dami: null, chorong: 20000 },
    })).toEqual({
      stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 20000 },
    })
  })

  it('객체가 아니면 undefined를 돌려준다', () => {
    expect(sanitizePrices(undefined)).toBeUndefined()
    expect(sanitizePrices(null)).toBeUndefined()
    expect(sanitizePrices('x')).toBeUndefined()
    expect(sanitizePrices([])).toBeUndefined()
  })
})

describe('withSanitizedPrices', () => {
  it('prices 키가 없으면 그대로 돌려준다', () => {
    const gameState = { cash: 1 }
    expect(withSanitizedPrices(gameState)).toBe(gameState)
  })

  it('prices를 정리해서 넣는다', () => {
    expect(withSanitizedPrices({ cash: 1, prices: { stocks: { bio: -5 } } })).toEqual({
      cash: 1,
      prices: { stocks: DEFAULT_PLAYER_PRICES.stocks, realEstate: DEFAULT_PLAYER_PRICES.realEstate },
    })
  })

  it('prices가 잘못된 값이면 키를 지운다', () => {
    expect(withSanitizedPrices({ cash: 1, prices: 'bad' })).toEqual({ cash: 1 })
  })
})
