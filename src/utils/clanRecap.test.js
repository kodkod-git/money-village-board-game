import { describe, it, expect } from 'vitest'
import { topTeams, formatWon, withSubjectParticle, buildPriceComparison } from './clanRecap'

const T = [
  { id: 'a', name: 'A', cash: 100 },
  { id: 'b', name: 'B', cash: 300 },
  { id: 'c', name: 'C', cash: 300 },
  { id: 'd', name: 'D', cash: 0 },
]

const game = (n, stockPrices, realEstatePrices = null) => ({
  id: `s${n}`, name: `게임 ${n}`, stockPrices, realEstatePrices, players: [],
})

describe('clanRecap utils', () => {
  it('topTeams: 1위 값과 같은 팀 모두, 빈 배열이면 []', () => {
    expect(topTeams(T, 'cash').map(t => t.id)).toEqual(['b', 'c'])
    expect(topTeams([], 'cash')).toEqual([])
  })

  it('formatWon: 천 단위 쉼표 + 원', () => {
    expect(formatWon(1234567)).toBe('1,234,567원')
    expect(formatWon(0)).toBe('0원')
  })

  it('withSubjectParticle: 받침과 숫자 소리에 맞춰 이/가를 붙인다', () => {
    expect(withSubjectParticle('금융')).toBe('금융이')
    expect(withSubjectParticle('바이오')).toBe('바이오가')
    expect(withSubjectParticle('팀 1')).toBe('팀 1이')
    expect(withSubjectParticle('팀 2')).toBe('팀 2가')
    expect(withSubjectParticle('Tigers')).toBe('Tigers가')
  })
})

describe('buildPriceComparison', () => {
  const A = { bio: 5000, semiconductor: 3000, finance: 1000 }
  const B = { bio: 2000, semiconductor: 7000, finance: 1000 }
  const C = { bio: 1000, semiconductor: 1000, finance: 9000 }

  it('게임 두 개의 1위 종목이 다르면 "~는데," 문장을 만든다', () => {
    expect(buildPriceComparison([game(1, A), game(2, B)], 'stock').title)
      .toBe('주식의 경우 게임 1에서는 바이오가 가장 비쌌는데, 게임 2에서는 반도체가 가장 비쌌네요!')
  })

  it('1위 종목이 같으면 "모두" 문장을 만든다', () => {
    expect(buildPriceComparison([game(1, A), game(2, { ...A, bio: 8000 })], 'stock').title)
      .toBe('주식의 경우 게임 1, 게임 2 모두 바이오가 가장 비쌌네요!')
  })

  it('게임이 셋 이상이면 나열하고 마지막 종목에만 조사를 붙인다', () => {
    expect(buildPriceComparison([game(1, A), game(2, B), game(3, C)], 'stock').title)
      .toBe('주식의 경우 게임 1에서는 바이오, 게임 2에서는 반도체, 게임 3에서는 금융이 가장 비쌌네요!')
  })

  it('게임이 5개 이상이면 문장을 요약한다', () => {
    expect(buildPriceComparison([game(1, A), game(2, B), game(3, C), game(4, A), game(5, B)], 'stock').title)
      .toBe('주식의 경우 게임마다 가장 비싼 종목이 달랐네요!')
    const sameTop = [1, 2, 3, 4, 5].map(n => game(n, { ...A, bio: 5000 + n }))
    expect(buildPriceComparison(sameTop, 'stock').title).toBe('주식의 경우 모든 게임에서 바이오가 가장 비쌌네요!')
  })

  it('한 게임에서 동률이면 함께 적는다', () => {
    const tied = { bio: 5000, semiconductor: 1000, finance: 5000 }
    expect(buildPriceComparison([game(1, tied), game(2, B)], 'stock').title)
      .toBe('주식의 경우 게임 1에서는 바이오·금융이 가장 비쌌는데, 게임 2에서는 반도체가 가장 비쌌네요!')
  })

  it('차트는 바이오·반도체·금융 순서로 3개이고, 공통 최댓값과 게임별 막대를 갖는다', () => {
    const result = buildPriceComparison([game(1, A), game(2, B)], 'stock')
    expect(result.maxPrice).toBe(7000)
    expect(result.charts.map(c => c.label)).toEqual(['바이오', '반도체', '금융'])
    expect(result.charts[0].image).toBe('/badges/stock/바이오헬스케어.png')
    expect(result.charts[0].bars).toEqual([
      { gameId: 's1', gameName: '게임 1', colorIndex: 0, price: 5000, isTop: true },
      { gameId: 's2', gameName: '게임 2', colorIndex: 1, price: 2000, isTop: false },
    ])
  })

  it('부동산도 같은 구성으로 만든다', () => {
    const result = buildPriceComparison([
      game(1, null, { gaon: 90000, chorong: 10000, dami: 10000 }),
      game(2, null, { gaon: 10000, chorong: 90000, dami: 10000 }),
    ], 'estate')
    expect(result.title).toBe('부동산의 경우 게임 1에서는 단독주택이 가장 비쌌는데, 게임 2에서는 아파트가 가장 비쌌네요!')
    expect(result.charts.map(c => c.label)).toEqual(['단독주택', '아파트', '빌라'])
  })

  it('가격 기록이 없는 옛 게임은 빼되 색은 게임 순서를 유지한다', () => {
    const result = buildPriceComparison([game(1, null), game(2, A), game(3, B)], 'stock')
    expect(result.charts[0].bars.map(b => [b.gameName, b.colorIndex])).toEqual([['게임 2', 1], ['게임 3', 2]])
  })

  it('저장되지 않은 종목은 시작 가격으로 본다', () => {
    const result = buildPriceComparison([game(1, { bio: 5000 }), game(2, { bio: 1000 })], 'stock')
    expect(result.charts[1].bars[0].price).toBe(2000)
  })

  it('비교할 게임이 둘 미만이거나 모든 가격이 같으면 null', () => {
    expect(buildPriceComparison([game(1, A)], 'stock')).toBeNull()
    expect(buildPriceComparison([game(1, A), game(2, null)], 'stock')).toBeNull()
    expect(buildPriceComparison([game(1, A), game(2, { ...A })], 'stock')).toBeNull()
  })
})
