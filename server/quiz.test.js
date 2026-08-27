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

import { saveQuizResult, getQuizResult } from './quiz.js'

describe('saveQuizResult', () => {
  it('efti_test_responses에 결과를 저장하고 id를 반환한다', async () => {
    const builder = makeQueryBuilder({ data: { id: 'result-1' }, error: null })
    mockFrom.mockReturnValue(builder)

    const id = await saveQuizResult({
      childName: '철수',
      childGender: 'male',
      childAge: 7,
      answers: {
        q_pocket_money: '바로 쓰며 기뻐하는 편이에요.',
        q_new_activity: '익숙한 방법이 편한 편이에요.',
        q_want_something: '빨리 갖고 싶어 하는 편이에요.',
        q_hard_task: '잘할 수 있는 방법을 먼저 고르는 편이에요.',
        q_choosing_item: '지금 마음에 드는 것을 고르는 편이에요.',
        q_problem_solving: '실수 없는 방법을 고르는 편이에요.',
      },
      axisTodayTomorrow: 'today',
      axisSafetyAdventure: 'safety',
      resultGroup: 'Green Group',
    })

    expect(id).toBe('result-1')
    expect(mockFrom).toHaveBeenCalledWith('efti_test_responses')
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      child_name: '철수',
      child_gender: 'male',
      child_age: 7,
      q_pocket_money: '바로 쓰며 기뻐하는 편이에요.',
      axis_today_tomorrow: 'today',
      axis_safety_adventure: 'safety',
      result_group: 'Green Group',
      source: 'app',
    }))
  })

  it('insert 에러가 나면 예외를 던진다', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('insert failed') })
    mockFrom.mockReturnValue(builder)

    await expect(saveQuizResult({
      childName: '철수', childAge: 7, answers: {}, axisTodayTomorrow: 'today',
      axisSafetyAdventure: 'safety', resultGroup: 'Green Group',
    })).rejects.toThrow('insert failed')
  })
})

describe('getQuizResult', () => {
  it('id로 결과를 조회한다', async () => {
    const row = { id: 'result-1', child_name: '철수', result_group: 'Green Group' }
    const builder = makeQueryBuilder({ data: row, error: null })
    mockFrom.mockReturnValue(builder)

    const result = await getQuizResult('result-1')

    expect(result).toEqual(row)
    expect(builder.eq).toHaveBeenCalledWith('id', 'result-1')
  })

  it('조회 에러가 나면 예외를 던진다', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('not found') })
    mockFrom.mockReturnValue(builder)

    await expect(getQuizResult('missing')).rejects.toThrow('not found')
  })
})
