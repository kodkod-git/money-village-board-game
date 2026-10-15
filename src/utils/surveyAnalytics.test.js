import { describe, it, expect } from 'vitest'
import { buildColumns, countByAnswer, countByDay, countByGroup, countByType, formatCell, formatDateParts, funnelSteps } from './surveyAnalytics'

describe('buildColumns', () => {
  it('알려진 컬럼 뒤에 DB에만 있는 컬럼을 붙이고 id는 숨긴다', () => {
    const cols = buildColumns('potential', [{ id: 'x', child_name: '지호', smore_token: 'abc' }])
    const keys = cols.map(c => c.key)
    expect(keys[0]).toBe('submitted_at')
    expect(keys).toContain('q_pocket_money')
    expect(keys.at(-1)).toBe('smore_token')
    expect(keys).not.toContain('id')
  })

  it('문항 헤더의 {name}을 "우리 아이"로 바꾼다', () => {
    const col = buildColumns('potential', []).find(c => c.key === 'q_pocket_money')
    expect(col.label).toBe('우리 아이는 용돈을 받으면 어떤 편인가요?')
  })
})

describe('formatCell', () => {
  it('성별·축·출처 코드를 한글로 바꾸고 빈 값은 -로 표시한다', () => {
    const cols = buildColumns('potential', [])
    const byKey = k => cols.find(c => c.key === k)
    expect(formatCell(byKey('child_gender'), 'female')).toBe('여자아이')
    expect(formatCell(byKey('axis_today_tomorrow'), 'tomorrow')).toBe('내일 꿈꾸기')
    expect(formatCell(byKey('source'), 'smore_import')).toBe('스모어 이관')
    expect(formatCell(byKey('child_age'), null)).toBe('-')
  })
})

describe('formatDateParts', () => {
  it('날짜와 시간을 나눈다', () => {
    const { date, time } = formatDateParts('2026-10-10T12:21:00')
    expect(date).toBe('2026-10-10')
    expect(time).toBe('12:21')
  })
})

describe('countByGroup', () => {
  it('4개 그룹을 고정 순서로 세고 비율을 계산한다', () => {
    const rows = [{ result_group: 'Blue Group' }, { result_group: 'Blue Group' }, { result_group: 'Green Group' }, { result_group: null }]
    const groups = countByGroup(rows)
    expect(groups.map(g => g.group)).toEqual(['Green Group', 'Red Group', 'Orange Group', 'Blue Group'])
    expect(groups.find(g => g.group === 'Blue Group')).toMatchObject({ count: 2, ratio: 2 / 3 })
  })
})

describe('countByType', () => {
  it('16개 유형을 모두 포함하고 그룹 색을 붙인다', () => {
    const types = countByType([{ my_type: 'FASN' }, { my_type: 'FASN' }, { my_type: 'PTSN' }])
    expect(types).toHaveLength(16)
    expect(types.find(t => t.type === 'FASN')).toMatchObject({ count: 2, group: 'Orange Group' })
    expect(types.find(t => t.type === 'FTEC').count).toBe(0)
  })
})

describe('countByDay', () => {
  const today = new Date(2026, 9, 14)
  const rows = [
    { submitted_at: '2026-10-10T12:00:00' },
    { submitted_at: '2026-10-10T18:00:00' },
    { submitted_at: '2026-10-12T09:00:00' },
    { submitted_at: '2026-09-01T09:00:00' },
  ]

  it('최근 N일을 오늘까지 빈 날 없이 0으로 채운다', () => {
    const days = countByDay(rows, 7, today)
    expect(days).toHaveLength(7)
    expect(days[0].date).toBe('2026-10-08')
    expect(days.at(-1).date).toBe('2026-10-14')
    expect(days.find(d => d.date === '2026-10-10').completed).toBe(2)
    expect(days.find(d => d.date === '2026-10-11').completed).toBe(0)
  })

  it('전체 기간은 첫 응답일부터 시작하고 월 경계를 넘는다', () => {
    const days = countByDay(rows, null, today)
    expect(days[0]).toEqual({ date: '2026-09-01', completed: 1 })
    expect(days).toHaveLength(44)
    expect(days.reduce((s, d) => s + d.completed, 0)).toBe(4)
  })

  it('응답이 없으면 오늘 하루만 0으로 돌려준다', () => {
    expect(countByDay([], null, today)).toEqual([{ date: '2026-10-14', completed: 0 }])
  })
})

describe('countByAnswer', () => {
  const question = { key: 'q', options: ['A', 'B'] }

  it('선택지별 수와 비율을 세고, 미응답은 비율에서 빼고 따로 센다', () => {
    const result = countByAnswer([{ q: 'A' }, { q: 'A' }, { q: 'B' }, { q: null }], question)
    expect(result.slices.map(s => [s.label, s.count])).toEqual([['A', 2], ['B', 1]])
    expect(result.slices[0].ratio).toBeCloseTo(2 / 3)
    expect(result).toMatchObject({ answered: 3, unanswered: 1 })
  })

  it('선택지 문구와 다른 값은 기타로 묶는다', () => {
    const result = countByAnswer([{ q: 'A' }, { q: '깨진 글자' }], question)
    expect(result.slices.at(-1)).toMatchObject({ label: '기타', count: 1, ratio: 0.5 })
  })
})

describe('funnelSteps', () => {
  it('경제적 잠재력 테스트는 이름·성별·나이와 질문 6개를 화면 순서대로 돌려준다', () => {
    const steps = funnelSteps('potential')
    expect(steps).toHaveLength(9)
    expect(steps.slice(0, 3).map(s => s.kind)).toEqual(['text', 'choice', 'number'])
  })

  it('시너지 테스트는 닉네임 2개와 질문 4개다', () => {
    expect(funnelSteps('synergy')).toHaveLength(6)
  })
})
