// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabaseSurvey.js', () => ({
  supabaseSurvey: { from: (...args) => mockFrom(...args) },
}))

import { listSurveyResponses } from './surveyResponses.js'

function makeBuilder(pages) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => Promise.resolve(pages.shift())),
  }
  return builder
}

beforeEach(() => mockFrom.mockReset())

describe('listSurveyResponses', () => {
  it('경제적 잠재력 테스트는 efti_test_responses를 최신순으로 읽는다', async () => {
    const builder = makeBuilder([{ data: [{ id: 'a' }], error: null }])
    mockFrom.mockReturnValue(builder)

    const rows = await listSurveyResponses('potential')

    expect(mockFrom).toHaveBeenCalledWith('efti_test_responses')
    expect(builder.order).toHaveBeenCalledWith('submitted_at', { ascending: false })
    expect(rows).toEqual([{ id: 'a' }])
  })

  it('1000행이 꽉 찬 페이지가 오면 다음 페이지까지 이어서 읽는다', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const builder = makeBuilder([{ data: full, error: null }, { data: [{ id: 'last' }], error: null }])
    mockFrom.mockReturnValue(builder)

    const rows = await listSurveyResponses('synergy')

    expect(mockFrom).toHaveBeenCalledWith('efti_synergy_responses')
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(rows).toHaveLength(1001)
  })

  it('알 수 없는 테스트 키는 거부한다', async () => {
    await expect(listSurveyResponses('nope')).rejects.toThrow()
  })

  it('조회 오류를 그대로 던진다', async () => {
    mockFrom.mockReturnValue(makeBuilder([{ data: null, error: new Error('boom') }]))
    await expect(listSurveyResponses('potential')).rejects.toThrow('boom')
  })
})
