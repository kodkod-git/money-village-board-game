// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  }
  return builder
}

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { calculateAssetBreakdown } from './db.js'

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

describe('calculateAssetBreakdown', () => {
  it('뱃지 0개이면 총자산은 0원이다', () => {
    const state = makeState({ cash: 100000 })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(0)
  })

  it('뱃지 2개이면 base × 1.0을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, false, false, false, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(100000)
  })

  it('뱃지 3개이면 base × 1.5를 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, false, false, false] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(150000)
  })

  it('뱃지 6개이면 base × 3.0을 총자산으로 반환한다', () => {
    const state = makeState({ cash: 100000, badges: [true, true, true, true, true, true] })
    expect(calculateAssetBreakdown(state, PRICES).totalAssets).toBe(300000)
  })

  it('주식 보유량 × 가격을 stockValue로 반환하고 총자산에도 포함한다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(20000)
    expect(result.totalAssets).toBe(20000)
  })

  it('부동산 보유량 × 가격을 realEstateValue로 반환하고 총자산에도 포함한다', () => {
    const state = makeState({
      realEstate: { gaon: 3, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.realEstateValue).toBe(30000)
    expect(result.totalAssets).toBe(30000)
  })

  it('현금+주식+부동산을 합산해 총자산을 계산한다', () => {
    const state = makeState({
      cash: 50000,
      stocks: { semiconductor: 5, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.cash).toBe(50000)
    expect(result.stockValue).toBe(10000)
    expect(result.realEstateValue).toBe(10000)
    expect(result.totalAssets).toBe(70000)
  })

  it('stockValue와 realEstateValue에는 뱃지 배수가 적용되지 않는다', () => {
    const state = makeState({
      stocks: { semiconductor: 10, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      badges: [false, false, false, false, false, false],
    })
    const result = calculateAssetBreakdown(state, PRICES)
    expect(result.stockValue).toBe(20000)
    expect(result.totalAssets).toBe(0)
  })
})

describe('saveGameResult', () => {
  it('각 플레이어의 stock_value와 real_estate_value를 계산해 insert한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSessionInsert = vi.fn().mockReturnValue({ select: mockSelect })
    const mockResultsInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { insert: mockSessionInsert }
      if (table === 'game_results') return { insert: mockResultsInsert }
      throw new Error(`unexpected table: ${table}`)
    })

    const { saveGameResult } = await import('./db.js')

    const room = {
      code: 'AB1234',
      prices: PRICES,
      players: [
        {
          playerUuid: 'p1', name: '홍길동', affiliation: '서울중', character: 'fox',
          gameState: {
            job: 'a', cash: 10000,
            stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
            realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
            badges: [true, true, false, false, false, false],
          },
        },
      ],
    }

    await saveGameResult(room)

    expect(mockResultsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        player_uuid: 'p1',
        stock_value: 4000,
        real_estate_value: 10000,
        total_assets: 24000,
      }),
    ])
  })
})
