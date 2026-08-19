// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
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
      classId: 'class-1',
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

    expect(mockSessionInsert).toHaveBeenCalledWith(expect.objectContaining({
      team_code: 'AB1234',
      class_id: 'class-1',
    }))
    expect(mockResultsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        player_uuid: 'p1',
        stock_value: 4000,
        real_estate_value: 10000,
        total_assets: 24000,
      }),
    ])
  })

  it('room.title이 있으면 game_sessions에 title로 저장한다', async () => {
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
      code: 'AB1234', prices: PRICES, classId: 'class-1', title: 'TEAM 1',
      players: [{
        playerUuid: 'p1', name: '홍길동', affiliation: '서울중', character: 'fox',
        gameState: {
          job: 'a', cash: 10000,
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [false, false, false, false, false, false],
        },
      }],
    }

    await saveGameResult(room)

    expect(mockSessionInsert).toHaveBeenCalledWith(expect.objectContaining({ title: 'TEAM 1' }))
  })
})

describe('getRankings', () => {
  it('category 없이 호출하면 total_assets 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({})

    expect(builder.order).toHaveBeenCalledWith('total_assets', { ascending: false })
  })

  it('category가 stock이면 stock_value 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ category: 'stock' })

    expect(builder.order).toHaveBeenCalledWith('stock_value', { ascending: false })
  })

  it('category가 cash이면 cash 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ category: 'cash' })

    expect(builder.order).toHaveBeenCalledWith('cash', { ascending: false })
  })

  it('category가 realEstate이면 real_estate_value 컬럼 기준으로 정렬 요청한다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ category: 'realEstate' })

    expect(builder.order).toHaveBeenCalledWith('real_estate_value', { ascending: false })
  })

  it('알 수 없는 category는 에러를 던진다', async () => {
    const { getRankings } = await import('./db.js')
    await expect(getRankings({ category: 'unknown' })).rejects.toThrow('Unknown ranking category: unknown')
  })

  it('classId가 있으면 game_sessions.class_id로 eq 필터링을 건다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ classId: 'class-1' })

    expect(builder.eq).toHaveBeenCalledWith('game_sessions.class_id', 'class-1')
  })

  it("classId가 'unassigned'면 game_sessions.class_id를 null로 필터링한다", async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ classId: 'unassigned' })

    expect(builder.is).toHaveBeenCalledWith('game_sessions.class_id', null)
  })

  it('classId와 category를 동시에 적용할 수 있다', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReset()
    mockFrom.mockReturnValue(builder)

    const { getRankings } = await import('./db.js')
    await getRankings({ classId: 'class-1', category: 'stock' })

    expect(builder.order).toHaveBeenCalledWith('stock_value', { ascending: false })
    expect(builder.eq).toHaveBeenCalledWith('game_sessions.class_id', 'class-1')
  })

  it('teamCode, className, stockValue, realEstateValue를 포함해 반환한다', async () => {
    const rows = [{
      player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
      total_assets: 200000, stock_value: 4000, real_estate_value: 10000,
      session_id: 's1',
      game_sessions: {
        team_code: 'AB1234', title: 'TEAM 1', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
        class_id: 'class-1', classes: { name: '1반' },
      },
    }]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getRankings } = await import('./db.js')
    const result = await getRankings({})

    expect(result).toEqual([{
      rank: 1, name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stockHoldings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstateHoldings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
      totalAssets: 200000, stockValue: 4000, realEstateValue: 10000,
      sessionId: 's1', playerUuid: 'p1', teamCode: 'AB1234', teamName: 'TEAM 1', className: '1반',
      stockPrices: PRICES.stocks, realEstatePrices: PRICES.realEstate,
    }])
  })

  it('팀 이름이 없으면 teamName이 team_code로 대체된다', async () => {
    const rows = [{
      player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
      total_assets: 0, stock_value: 0, real_estate_value: 0,
      session_id: 's3',
      game_sessions: {
        team_code: 'EF9012', title: null, stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
        class_id: 'class-1', classes: { name: '1반' },
      },
    }]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getRankings } = await import('./db.js')
    const result = await getRankings({})

    expect(result[0].teamName).toBe('EF9012')
  })

  it('수업 정보가 없으면 className이 미배정 수업으로 채워진다', async () => {
    const rows = [{
      player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
      total_assets: 0, stock_value: 0, real_estate_value: 0,
      session_id: 's2',
      game_sessions: {
        team_code: 'CD5678', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
        class_id: null, classes: null,
      },
    }]
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }))

    const { getRankings } = await import('./db.js')
    const result = await getRankings({})

    expect(result[0].className).toBe('미배정 수업')
  })
})

describe('getAllCompletedTeams', () => {
  it('세션과 결과를 팀 단위로 묶어 room 형태로 반환한다', async () => {
    const sessions = [{
      id: 'session-1', team_code: 'AB1234', created_at: '2026-01-01T00:00:00Z',
      stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate,
      class_id: 'class-1', title: 'TEAM 1',
    }]
    const results = [{
      session_id: 'session-1', player_uuid: 'p1', name: '김민준', affiliation: '서울중', character: 'lion',
      job: 'a', cash: 10000,
      stock_holdings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    }]

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return makeQueryBuilder({ data: sessions, error: null })
      if (table === 'game_results') return makeQueryBuilder({ data: results, error: null })
      throw new Error(`unexpected table: ${table}`)
    })

    const { getAllCompletedTeams } = await import('./db.js')
    const rooms = await getAllCompletedTeams()

    expect(rooms).toEqual([{
      code: 'AB1234',
      status: 'completed',
      registered: true,
      createdAt: '2026-01-01T00:00:00Z',
      classId: 'class-1',
      title: 'TEAM 1',
      prices: { stocks: PRICES.stocks, realEstate: PRICES.realEstate },
      players: [{
        playerUuid: 'p1', name: '김민준', character: 'lion', affiliation: '서울중',
        gameState: {
          cash: 10000, job: 'a',
          stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      }],
    }])
  })
})

describe('updateGameResult', () => {
  it('세션/현재 결과를 조회해 필드를 병합하고 재계산된 자산으로 UPDATE한다', async () => {
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', stock_prices: PRICES.stocks, real_estate_prices: PRICES.realEstate },
      error: null,
    })
    const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })

    const currentRow = {
      cash: 10000, job: 'a',
      stock_holdings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      real_estate_holdings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, true, false, false, false, false],
    }
    const mockCurrentSingle = vi.fn().mockResolvedValue({ data: currentRow, error: null })
    const mockCurrentEqEq = vi.fn().mockReturnValue({ single: mockCurrentSingle })
    const mockCurrentEq = vi.fn().mockReturnValue({ eq: mockCurrentEqEq })
    const mockCurrentSelect = vi.fn().mockReturnValue({ eq: mockCurrentEq })

    const updatedRow = {
      player_uuid: 'p1', name: '김민준', character: 'lion', affiliation: '서울중',
      cash: 20000, job: 'a',
      stock_holdings: currentRow.stock_holdings,
      real_estate_holdings: currentRow.real_estate_holdings,
      badges: currentRow.badges,
    }
    const mockUpdateSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null })
    const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle })
    const mockUpdateEqEq = vi.fn().mockReturnValue({ select: mockUpdateSelect })
    const mockUpdateEq = vi.fn().mockReturnValue({ eq: mockUpdateEqEq })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    let callCount = 0
    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { select: mockSessionSelect }
      if (table === 'game_results') {
        callCount += 1
        return callCount === 1 ? { select: mockCurrentSelect } : { update: mockUpdate }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const { updateGameResult } = await import('./db.js')
    const updated = await updateGameResult('AB1234', 'p1', { cash: 20000 })

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cash: 20000,
      total_assets: 34000,
      stock_value: 4000,
      real_estate_value: 10000,
    }))
    expect(updated.gameState.cash).toBe(20000)
    expect(updated.playerUuid).toBe('p1')
  })
})

describe('updateSessionTitle', () => {
  it('team_code로 세션을 찾아 title을 UPDATE한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReset()
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { updateSessionTitle } = await import('./db.js')
    const result = await updateSessionTitle('AB1234', 'TEAM A')

    expect(mockUpdate).toHaveBeenCalledWith({ title: 'TEAM A' })
    expect(mockEq).toHaveBeenCalledWith('team_code', 'AB1234')
    expect(result).toEqual({ id: 'session-1' })
  })

  it('세션을 찾지 못하면 에러를 던진다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReset()
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { updateSessionTitle } = await import('./db.js')

    await expect(updateSessionTitle('AB1234', 'TEAM A')).rejects.toEqual({ message: 'not found' })
  })
})

describe('getGameResult', () => {
  it('세션 조회 시 classes 이름을 함께 select한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', class_id: 'class-1', classes: { name: '1반' } },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { select: mockSelect }
      if (table === 'game_results') return makeQueryBuilder({ data: [], error: null })
      throw new Error(`unexpected table: ${table}`)
    })

    const { getGameResult } = await import('./db.js')
    const { session } = await getGameResult('session-1')

    expect(mockSelect).toHaveBeenCalledWith('*, classes(name)')
    expect(session.classes.name).toBe('1반')
  })
})

describe('deleteCompletedTeam', () => {
  it('세션을 조회한 뒤 결과와 세션을 순서대로 삭제한다', async () => {
    const mockSessionSingle = vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null })
    const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })

    const mockResultsEq = vi.fn().mockResolvedValue({ error: null })
    const mockResultsDelete = vi.fn().mockReturnValue({ eq: mockResultsEq })

    const mockSessionDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const mockSessionDelete = vi.fn().mockReturnValue({ eq: mockSessionDeleteEq })

    let resultsCall = 0
    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') {
        resultsCall += 1
        return resultsCall === 1 ? { select: mockSessionSelect } : { delete: mockSessionDelete }
      }
      if (table === 'game_results') return { delete: mockResultsDelete }
      throw new Error(`unexpected table: ${table}`)
    })

    const { deleteCompletedTeam } = await import('./db.js')
    await deleteCompletedTeam('AB1234')

    expect(mockSessionEq).toHaveBeenCalledWith('team_code', 'AB1234')
    expect(mockResultsEq).toHaveBeenCalledWith('session_id', 'session-1')
    expect(mockSessionDeleteEq).toHaveBeenCalledWith('id', 'session-1')
  })

  it('세션을 찾지 못하면 에러를 던진다', async () => {
    const mockSessionSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { select: mockSessionSelect }
      throw new Error(`unexpected table: ${table}`)
    })

    const { deleteCompletedTeam } = await import('./db.js')
    await expect(deleteCompletedTeam('XXXXXX')).rejects.toEqual({ message: 'not found' })
  })
})

describe('deleteCompletedTeamsByClassId', () => {
  it('해당 class_id의 세션들을 찾아 결과와 세션을 순서대로 삭제한다', async () => {
    const mockSessionsSelectEq = vi.fn().mockResolvedValue({
      data: [{ id: 'session-1' }, { id: 'session-2' }],
      error: null,
    })
    const mockSessionsSelect = vi.fn().mockReturnValue({ eq: mockSessionsSelectEq })

    const mockResultsIn = vi.fn().mockResolvedValue({ error: null })
    const mockResultsDelete = vi.fn().mockReturnValue({ in: mockResultsIn })

    const mockSessionsDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const mockSessionsDelete = vi.fn().mockReturnValue({ eq: mockSessionsDeleteEq })

    let sessionsCall = 0
    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') {
        sessionsCall += 1
        return sessionsCall === 1 ? { select: mockSessionsSelect } : { delete: mockSessionsDelete }
      }
      if (table === 'game_results') return { delete: mockResultsDelete }
      throw new Error(`unexpected table: ${table}`)
    })

    const { deleteCompletedTeamsByClassId } = await import('./db.js')
    await deleteCompletedTeamsByClassId('class-1')

    expect(mockSessionsSelectEq).toHaveBeenCalledWith('class_id', 'class-1')
    expect(mockResultsIn).toHaveBeenCalledWith('session_id', ['session-1', 'session-2'])
    expect(mockSessionsDeleteEq).toHaveBeenCalledWith('class_id', 'class-1')
  })

  it('해당 수업의 세션이 없으면 아무 것도 삭제하지 않는다', async () => {
    const mockSessionsSelectEq = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockSessionsSelect = vi.fn().mockReturnValue({ eq: mockSessionsSelectEq })
    const mockResultsDelete = vi.fn()

    mockFrom.mockReset()
    mockFrom.mockImplementation(table => {
      if (table === 'game_sessions') return { select: mockSessionsSelect }
      if (table === 'game_results') return { delete: mockResultsDelete }
      throw new Error(`unexpected table: ${table}`)
    })

    const { deleteCompletedTeamsByClassId } = await import('./db.js')
    await deleteCompletedTeamsByClassId('class-empty')

    expect(mockResultsDelete).not.toHaveBeenCalled()
  })
})
