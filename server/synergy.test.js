// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

function makeQueryBuilder(result) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return builder
}

const mockFrom = vi.fn()

vi.mock('./supabaseSurvey.js', () => ({
  supabaseSurvey: { from: (...args) => mockFrom(...args) },
}))

import { saveSynergyResult, getSynergyResult } from './synergy.js'

describe('saveSynergyResult', () => {
  it('efti_synergy_responses에 결과를 저장하고 id를 반환한다', async () => {
    const builder = makeQueryBuilder({ data: { id: 'synergy-1' }, error: null })
    mockFrom.mockReturnValue(builder)

    const id = await saveSynergyResult({
      myName: '민수',
      citizenName: '지우',
      citizenType: 'FASN',
      myType: 'FAEC',
      answers: {
        q_pocket_money: '앞으로의 일을 생각해 일부를 남겨 둔다.',
        q_investment: '안정적 결과를 얻을 수 있는 선택을 한다.',
        q_group_buying: '친구들이 원하는 물건을 먼저 들어본다.',
        q_price_compare: '기준을 비교해 보고 결정한다.',
      },
    })

    expect(id).toBe('synergy-1')
    expect(mockFrom).toHaveBeenCalledWith('efti_synergy_responses')
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      my_name: '민수',
      citizen_name: '지우',
      citizen_type: 'FASN',
      my_type: 'FAEC',
      q_pocket_money: '앞으로의 일을 생각해 일부를 남겨 둔다.',
      q_investment: '안정적 결과를 얻을 수 있는 선택을 한다.',
      q_group_buying: '친구들이 원하는 물건을 먼저 들어본다.',
      q_price_compare: '기준을 비교해 보고 결정한다.',
      source: 'app',
    }))
  })

  it('insert 에러가 나면 예외를 던진다', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('insert failed') })
    mockFrom.mockReturnValue(builder)

    await expect(saveSynergyResult({
      myName: '민수', citizenName: '지우', citizenType: 'FASN', myType: 'FAEC', answers: {},
    })).rejects.toThrow('insert failed')
  })
})

describe('getSynergyResult', () => {
  it('id로 결과를 조회한다', async () => {
    const row = { id: 'synergy-1', my_name: '민수', my_type: 'FAEC', citizen_type: 'FASN' }
    const builder = makeQueryBuilder({ data: row, error: null })
    mockFrom.mockReturnValue(builder)

    const result = await getSynergyResult('synergy-1')

    expect(result).toEqual(row)
    expect(mockFrom).toHaveBeenCalledWith('efti_synergy_responses')
    expect(builder.eq).toHaveBeenCalledWith('id', 'synergy-1')
  })

  it('조회 에러가 나면 예외를 던진다', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('not found') })
    mockFrom.mockReturnValue(builder)

    await expect(getSynergyResult('missing')).rejects.toThrow('not found')
  })
})
