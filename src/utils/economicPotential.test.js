import { describe, it, expect } from 'vitest'
import { calcEconomicPotential, countHoldings } from './economicPotential'

function player(stockHoldings, realEstateHoldings) {
  return { stockHoldings, realEstateHoldings }
}

const low = player({ semiconductor: 1 }, {})
const mid = player({ finance: 2 }, { gaon: 1 })

describe('countHoldings', () => {
  it('주식·부동산 보유 수와 빌라·바이오 보유 수를 센다', () => {
    expect(countHoldings(player({ semiconductor: 2, bio: 3 }, { dami: 1, chorong: 1 })))
      .toEqual({ stocks: 5, realEstate: 2, total: 7, risky: 4 })
  })

  it('보유 정보가 없으면 0으로 센다', () => {
    expect(countHoldings({})).toEqual({ stocks: 0, realEstate: 0, total: 0, risky: 0 })
  })
})

describe('calcEconomicPotential', () => {
  it('평균보다 많이 보유하고 빌라·바이오 비중이 높으면 미래·위험(Blue)', () => {
    const me = player({ bio: 4 }, { dami: 1, gaon: 1 })
    expect(calcEconomicPotential(me, [me, low, mid]).group).toBe('Blue Group')
  })

  it('평균보다 많이 보유하고 빌라·바이오 비중이 낮으면 미래·안전(Orange)', () => {
    const me = player({ semiconductor: 4, bio: 1 }, { chorong: 1 })
    expect(calcEconomicPotential(me, [me, low, mid]).group).toBe('Orange Group')
  })

  it('평균보다 적게 보유하고 빌라·바이오 비중이 높으면 현재·위험(Red)', () => {
    const me = player({ bio: 1 }, {})
    const rich = player({ semiconductor: 9 }, {})
    expect(calcEconomicPotential(me, [me, rich]).group).toBe('Red Group')
  })

  it('평균보다 적게 보유하고 빌라·바이오 비중이 낮으면 현재·안전(Green)', () => {
    const rich = player({ semiconductor: 9 }, {})
    expect(calcEconomicPotential(low, [low, rich]).group).toBe('Green Group')
  })

  it('평균과 같으면 현재형, 빌라·바이오가 정확히 절반이면 안전형', () => {
    const me = player({ bio: 1, finance: 1 }, {})
    const result = calcEconomicPotential(me, [me, player({ finance: 2 }, {})])
    expect(result.horizon).toBe('present')
    expect(result.risk).toBe('safe')
  })

  it('아무것도 보유하지 않으면 현재·안전', () => {
    const me = player({}, {})
    expect(calcEconomicPotential(me, [me]).group).toBe('Green Group')
  })
})
