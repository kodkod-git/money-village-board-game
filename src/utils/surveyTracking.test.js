import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getVisitorId, trackSurveyEvent, markSurveyStart, takeSurveyDuration } from './surveyTracking'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true }))
})

afterEach(() => vi.useRealTimers())

describe('surveyTracking', () => {
  it('브라우저마다 익명 방문자 ID를 한 번 만들어 계속 같은 값을 쓴다', () => {
    const id = getVisitorId()
    expect(id).toMatch(UUID)
    expect(getVisitorId()).toBe(id)
    expect(localStorage.getItem('survey.visitorId')).toBe(id)
  })

  it('이벤트를 방문자 ID와 함께 /api/survey/events로 보낸다', () => {
    trackSurveyEvent('synergy', 'share_click', { target: 'kakao', resultId: 'r1' })
    expect(fetch).toHaveBeenCalledWith('/api/survey/events', expect.objectContaining({ method: 'POST', keepalive: true }))
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      test: 'synergy', event: 'share_click', visitorId: getVisitorId(), target: 'kakao', durationMs: null, resultId: 'r1',
    })
  })

  it('전송이 실패해도 오류를 밖으로 내지 않는다', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    expect(() => trackSurveyEvent('potential', 'visit')).not.toThrow()
    await Promise.resolve()
  })

  it('시작 시각부터 걸린 시간을 한 번만 돌려준다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T10:00:00Z'))
    markSurveyStart('potential')
    vi.setSystemTime(new Date('2026-10-19T10:01:30Z'))
    expect(takeSurveyDuration('potential')).toBe(90000)
    expect(takeSurveyDuration('potential')).toBeNull()
  })
})
