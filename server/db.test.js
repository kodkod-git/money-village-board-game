// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase.js', () => ({ supabase: {} }))

import { calculateTotalAssets } from './db.js'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makeState(overrides = {}) {
  return {
    cash: 0,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    ...overrides,
  }
}

describe('calculateTotalAssets', () => {
  it('뱃지 0개이면 0원을 반환한다', () => {
    const state = makeState({ cash: 100000 })
    expect(calculateTotalAssets(state, PRICES)).toBe(0)
  })

  it('뱃지 2개이면 base × 1.0을 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, false, false, false, false] })
    expect(calculateTotalAssets(state, PRICES)).toBe(100000)
  })

  it('뱃지 3개이면 base × 1.5를 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, false, false, false] })
    expect(calculateTotalAssets(state, PRICES)).toBe(150000)
  })

  it('뱃지 6개이면 base × 3.0을 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, true, true] })
    expect(calculateTotalAssets(state, PRICES)).toBe(300000)
  })

  it('주식 보유량을 가격과 곱해 base에 포함한다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [true, true, false, false, false, false],
    })
    expect(calculateTotalAssets(state, PRICES)).toBe(20000)
  })

  it('부동산 보유량을 가격과 곱해 base에 포함한다', () => {
    const state = makeState({
      realEstate: { gaon: 3, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    expect(calculateTotalAssets(state, PRICES)).toBe(30000)
  })

  it('현금+주식+부동산을 합산한다', () => {
    const state = makeState({
      cash: 50000,
      stocks: { semiconductor: 5, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    expect(calculateTotalAssets(state, PRICES)).toBe(70000)
  })
})
