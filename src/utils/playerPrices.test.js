import { describe, it, expect } from 'vitest'
import { pricesForPlayer } from './playerPrices'

const RESULT = { stockPrices: { bio: 1 }, realEstatePrices: { gaon: 1 } }

describe('pricesForPlayer', () => {
  it('참여자 가격이 있으면 그 가격을 쓴다', () => {
    expect(pricesForPlayer({ stockPrices: { bio: 9 }, realEstatePrices: { gaon: 9 } }, RESULT))
      .toEqual({ stockPrices: { bio: 9 }, realEstatePrices: { gaon: 9 } })
  })

  it('참여자 가격이 없으면 결과(세션) 가격을 쓴다', () => {
    expect(pricesForPlayer({}, RESULT)).toEqual(RESULT)
    expect(pricesForPlayer({ stockPrices: null, realEstatePrices: null }, RESULT)).toEqual(RESULT)
  })
})
