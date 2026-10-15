import { describe, it, expect } from 'vitest'
import { buildColumns, countByDay, countByGroup, countByType, formatCell, formatDateParts } from './surveyAnalytics'

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
