import { describe, it, expect } from 'vitest'
import { buildParentGuide, formatManwon } from './parentGuide'

// 모든 가격을 1만원으로 두면 보유 수량 = 만원 단위 금액이 된다.
const PRICES = {
  stockPrices: { semiconductor: 10000, finance: 10000, bio: 10000 },
  realEstatePrices: { gaon: 10000, dami: 10000, chorong: 10000 },
}

// badges 배열 인덱스는 BADGE_NAMES 순서: communication(행운), global(부동산), idea(직업), money(노동), thinking(주식), trust(은행)
const ALL_KEYS = [true, true, true, true, true, true]

// example/머니빌리지_학부모안내문_6판_*.pdf 4장의 숫자를 그대로 재현한다.
const BLUE = { cash: 100000, stockHoldings: { semiconductor: 10, bio: 5 }, realEstateHoldings: { chorong: 25 }, badges: [true, true, false, true, true, true] }
const RED = { cash: 260000, stockHoldings: { semiconductor: 10, finance: 4 }, realEstateHoldings: {}, badges: [true, false, false, true, true, true] }
const GREEN = { cash: 350000, stockHoldings: { semiconductor: 3, finance: 3, bio: 3 }, realEstateHoldings: { gaon: 3, dami: 3 }, badges: ALL_KEYS }
const ORANGE = { cash: 120000, stockHoldings: { semiconductor: 8, finance: 8, bio: 7 }, realEstateHoldings: { dami: 6, chorong: 7 }, badges: [false, true, true, true, true, true] }

describe('formatManwon', () => {
  it('만원 단위로 보여준다', () => {
    expect(formatManwon(100000)).toBe('10만원')
    expect(formatManwon(1000000)).toBe('100만원')
    expect(formatManwon(125000)).toBe('12.5만원')
  })

  it('1만원 미만은 원 단위로 보여준다', () => {
    expect(formatManwon(0)).toBe('0원')
    expect(formatManwon(5000)).toBe('5,000원')
  })
})

describe('buildParentGuide', () => {
  it('Blue 예시: 자산·성공열쇠·최종자산을 PDF와 같게 계산한다', () => {
    const g = buildParentGuide(BLUE, PRICES)
    expect(g.cash).toBe(100000)
    expect(g.stockKinds).toBe(2)
    expect(g.stockValue).toBe(150000)
    expect(g.realEstateValue).toBe(250000)
    expect(g.baseAssets).toBe(500000)
    expect(g.keyCount).toBe(5)
    expect(g.multiplier).toBe(1.5)
    expect(g.bonus).toBe(250000)
    expect(g.finalAssets).toBe(750000)
    expect(g.split.map(s => s.pct)).toEqual([20, 30, 50])
    expect(g.keys.map(k => [k.label, k.on])).toEqual([
      ['노동', true], ['직업', false], ['은행', true], ['주식', true], ['부동산', true], ['행운', true],
    ])
    expect(g.group).toBe('Blue Group')
    expect(g.bullets).toEqual([
      '현금은 조금만 남기고 대부분을 미래를 위해 투자했어요.',
      '마음에 든 부동산 한 곳에 크게 투자했어요.',
      '가격이 오를 때까지 기다리며 길게 내다봤어요.',
    ])
  })

  it('Red 예시: 부동산이 없고 주식 한 종목에 몰아 투자했다', () => {
    const g = buildParentGuide(RED, PRICES)
    expect(g.realEstateValue).toBe(0)
    expect(g.finalAssets).toBe(480000)
    expect(g.bonus).toBe(80000)
    expect(g.split.map(s => s.pct)).toEqual([65, 35, 0])
    expect(g.group).toBe('Red Group')
    expect(g.bullets[1]).toBe('주식은 마음에 드는 한 종목에 크게 투자했어요.')
  })

  it('Green 예시: 성공열쇠 6개면 ×2, 나눠 담은 자산과 모은 열쇠를 문장에 넣는다', () => {
    const g = buildParentGuide(GREEN, PRICES)
    expect(g.finalAssets).toBe(1000000)
    expect(g.split.map(s => s.pct)).toEqual([70, 18, 12])
    expect(g.group).toBe('Green Group')
    expect(g.bullets).toEqual([
      '현금과 예금을 넉넉히 남겨, 지금 필요한 돈을 먼저 챙겼어요.',
      '주식 3종목과 부동산에 조금씩 나눠 담았어요.',
      '6개 부스를 모두 경험해 성공열쇠 6개를 모았어요.',
    ])
  })

  it('Orange 예시: 여러 곳에 나눠 투자한 미래형', () => {
    const g = buildParentGuide(ORANGE, PRICES)
    expect(g.finalAssets).toBe(720000)
    expect(g.split.map(s => s.pct)).toEqual([25, 48, 27])
    expect(g.group).toBe('Orange Group')
    expect(g.bullets[0]).toBe('현금은 조금만 남기고 주식·부동산에 투자했어요.')
    expect(g.bullets[1]).toBe('주식 3종목과 부동산에 나눠 담아, 한 곳에 몰지 않았어요.')
  })

  it('비율은 반올림해도 합이 항상 100이 된다', () => {
    const g = buildParentGuide({ cash: 10000, stockHoldings: { bio: 1 }, realEstateHoldings: { gaon: 1 }, badges: [] }, PRICES)
    expect(g.split.reduce((sum, s) => sum + s.pct, 0)).toBe(100)
  })

  it('한 곳에 몰아 넣은 미래형 투자가 주식이면 주식 문장을 쓴다', () => {
    const g = buildParentGuide({ cash: 10000, stockHoldings: { bio: 9 }, realEstateHoldings: {}, badges: [] }, PRICES)
    expect(g.group).toBe('Blue Group')
    expect(g.bullets[1]).toBe('마음에 든 주식 한 종목에 크게 투자했어요.')
  })

  it('투자 없이 현금만 가진 경우(Green)에도 문장을 만든다', () => {
    const g = buildParentGuide({ cash: 300000, stockHoldings: {}, realEstateHoldings: {}, badges: [] }, PRICES)
    expect(g.group).toBe('Green Group')
    expect(g.keyCount).toBe(0)
    expect(g.multiplier).toBe(1)
    expect(g.bonus).toBe(0)
    expect(g.bullets).toHaveLength(3)
    expect(g.bullets.join(' ')).not.toMatch(/0개|undefined/)
  })
})
