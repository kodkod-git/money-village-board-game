// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabaseSurvey.js', () => ({
  supabaseSurvey: { from: (...args) => mockFrom(...args) },
}))

import {
  parseSurveyEvent, saveSurveyEvent, listSurveyEvents, summarizeSurveyEvents, MAX_SESSION_MS,
} from './surveyEvents.js'

const VISITOR_A = '11111111-1111-4111-8111-111111111111'
const VISITOR_B = '22222222-2222-4222-8222-222222222222'
const VISITOR_C = '44444444-4444-4444-8444-444444444444'
const RESULT_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => mockFrom.mockReset())

describe('parseSurveyEvent', () => {
  it('형식이 맞는 이벤트를 DB 컬럼 이름으로 바꾼다', () => {
    expect(parseSurveyEvent({
      test: 'potential', event: 'complete', visitorId: VISITOR_A, durationMs: 95000, resultId: RESULT_ID,
    })).toEqual({
      test: 'potential', event: 'complete', visitor_id: VISITOR_A, target: null, duration_ms: 95000, result_id: RESULT_ID,
    })
    expect(parseSurveyEvent({ test: 'synergy', event: 'share_click', visitorId: VISITOR_A, target: 'kakao' }))
      .toMatchObject({ event: 'share_click', target: 'kakao' })
  })

  it.each([
    ['알 수 없는 테스트', { test: 'nope', event: 'visit', visitorId: VISITOR_A }],
    ['알 수 없는 이벤트', { test: 'potential', event: 'scroll', visitorId: VISITOR_A }],
    ['visitorId가 UUID가 아님', { test: 'potential', event: 'visit', visitorId: 'abc' }],
    ['target 형식 오류', { test: 'potential', event: 'link_click', visitorId: VISITOR_A, target: 'https://evil' }],
    ['resultId 형식 오류', { test: 'potential', event: 'complete', visitorId: VISITOR_A, resultId: '../etc' }],
    ['durationMs 음수', { test: 'potential', event: 'complete', visitorId: VISITOR_A, durationMs: -1 }],
    ['durationMs 소수', { test: 'potential', event: 'complete', visitorId: VISITOR_A, durationMs: 1.5 }],
    ['본문 없음', undefined],
  ])('%s이면 null', (_, body) => {
    expect(parseSurveyEvent(body)).toBeNull()
  })
})

describe('saveSurveyEvent / listSurveyEvents', () => {
  it('survey_events에 한 행을 넣는다', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    mockFrom.mockReturnValue({ insert })
    await saveSurveyEvent({ test: 'potential', event: 'visit' })
    expect(mockFrom).toHaveBeenCalledWith('survey_events')
    expect(insert).toHaveBeenCalledWith({ test: 'potential', event: 'visit' })
  })

  it('테스트별 이벤트를 오래된 순으로 페이지를 넘겨 가며 모두 읽는다', async () => {
    const pages = [
      { data: Array.from({ length: 1000 }, () => ({ event: 'visit' })), error: null },
      { data: [{ event: 'complete' }], error: null },
    ]
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => Promise.resolve(pages.shift())),
    }
    mockFrom.mockReturnValue(builder)

    const rows = await listSurveyEvents('synergy')

    expect(builder.eq).toHaveBeenCalledWith('test', 'synergy')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(rows).toHaveLength(1001)
  })
})

describe('summarizeSurveyEvents', () => {
  it('이벤트별 전체 횟수와 유니크(방문자 중복 제거) 수, 평균 세션시간을 계산한다', () => {
    const events = [
      { event: 'visit', visitor_id: VISITOR_A, created_at: '2026-10-19T01:00:00Z' },
      { event: 'visit', visitor_id: VISITOR_A, created_at: '2026-10-19T01:05:00Z' },
      { event: 'visit', visitor_id: VISITOR_B, created_at: '2026-10-19T02:00:00Z' },
      { event: 'complete', visitor_id: VISITOR_A, duration_ms: 60000 },
      { event: 'complete', visitor_id: VISITOR_A, duration_ms: 120000 },
      // 1시간이 넘는 세션은 평균에서 뺀다
      { event: 'complete', visitor_id: VISITOR_B, duration_ms: MAX_SESSION_MS + 1 },
      { event: 'link_click', visitor_id: VISITOR_A },
      { event: 'link_click', visitor_id: VISITOR_A },
      { event: 'link_click', visitor_id: VISITOR_A },
      // 공유받은 결과 화면에서 누른 클릭(참여 기록 없음) — 링크 클릭 수에는 들어가지만 CTR 분자에서는 빠진다
      { event: 'link_click', visitor_id: VISITOR_C },
      { event: 'share_click', visitor_id: VISITOR_B },
    ]
    expect(summarizeSurveyEvents(events)).toEqual({
      since: '2026-10-19T01:00:00Z',
      visit: { total: 3, unique: 2 },
      complete: { total: 3, unique: 2 },
      linkClick: { total: 4, unique: 2, participants: 1 },
      shareClick: { total: 1, unique: 1 },
      avgDurationMs: 90000,
    })
  })

  it('이벤트가 없으면 0과 null을 돌려준다', () => {
    expect(summarizeSurveyEvents([])).toEqual({
      since: null,
      visit: { total: 0, unique: 0 },
      complete: { total: 0, unique: 0 },
      linkClick: { total: 0, unique: 0, participants: 0 },
      shareClick: { total: 0, unique: 0 },
      avgDurationMs: null,
    })
  })
})
