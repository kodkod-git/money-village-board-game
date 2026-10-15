import { describe, it, expect } from 'vitest'
import { calcEconomicPotential, calcInvestment } from './economicPotential'

const STOCK_PRICES = { semiconductor: 10000, finance: 10000, bio: 10000 }
const ESTATE_PRICES = { gaon: 10000, dami: 10000, chorong: 10000 }

function player(cash, stockHoldings, realEstateHoldings, prices = {}) {
  return {
    cash, stockHoldings, realEstateHoldings,
    stockPrices: prices.stock ?? STOCK_PRICES,
    realEstatePrices: prices.estate ?? ESTATE_PRICES,
  }
}

describe('calcInvestment', () => {
  it('그 게임의 가격으로 투자 금액·투자 비율·한 종목 최대 비중을 계산한다', () => {
    expect(calcInvestment(player(30000, { semiconductor: 1 }, { dami: 6 }))).toEqual({
      invested: 70000, netWorth: 100000, investRatio: 0.7, topAssetRatio: 60000 / 70000,
    })
  })

  it('팀마다 다른 가격을 각자의 가격으로 계산한다', () => {
    expect(calcInvestment(player(0, { bio: 1 }, {}, { stock: { bio: 100 } })).invested).toBe(100)
  })

  it('보유 정보나 가격이 없으면 0으로 계산한다', () => {
    expect(calcInvestment({})).toEqual({ invested: 0, netWorth: 0, investRatio: 0, topAssetRatio: 0 })
  })
})

describe('calcEconomicPotential', () => {
  it('투자 비율이 70%를 넘고 한 종목이 투자 금액의 절반 이상이면 미래·위험(Blue)', () => {
    expect(calcEconomicPotential(player(20000, { semiconductor: 6, finance: 2 }, {})).group).toBe('Blue Group')
  })

  it('투자 비율이 70%를 넘고 한 종목이 절반 미만이면 미래·안전(Orange)', () => {
    expect(calcEconomicPotential(player(20000, { semiconductor: 3, finance: 3, bio: 2 }, {})).group).toBe('Orange Group')
  })

  it('투자 비율이 70% 이하이고 한 종목이 절반 이상이면 현재·위험(Red)', () => {
    expect(calcEconomicPotential(player(80000, {}, { chorong: 2 })).group).toBe('Red Group')
  })

  it('투자 비율이 70% 이하이고 한 종목이 절반 미만이면 현재·안전(Green)', () => {
    expect(calcEconomicPotential(player(70000, { semiconductor: 1, finance: 1 }, { gaon: 1 })).group).toBe('Green Group')
  })

  it('바이오·빌라가 아니어도 한 종목에 몰아서 투자했으면 위험형이다', () => {
    expect(calcEconomicPotential(player(0, { finance: 5, bio: 1 }, { dami: 1 })).risk).toBe('risky')
  })

  it('비중은 개수가 아니라 금액으로 본다', () => {
    // 개수는 반도체 3 : 빌라 1이지만 금액은 빌라가 90,000 / 120,000
    const me = player(0, { semiconductor: 3 }, { dami: 1 }, { estate: { dami: 90000 } })
    expect(calcEconomicPotential(me).risk).toBe('risky')
  })

  it('투자 비율이 정확히 70%면 현재형, 한 종목이 정확히 절반이면 위험형', () => {
    // 투자 70,000 / 순자산 100,000, 바이오 35,000 / 투자 70,000
    const result = calcEconomicPotential(player(30000, { bio: 1, finance: 1 }, {}, { stock: { bio: 35000, finance: 35000 } }))
    expect(result.investment.investRatio).toBe(0.7)
    expect(result.horizon).toBe('present')
    expect(result.risk).toBe('risky')
  })

  it('아무것도 보유하지 않으면 현재·안전', () => {
    expect(calcEconomicPotential(player(100000, {}, {})).group).toBe('Green Group')
  })
})
