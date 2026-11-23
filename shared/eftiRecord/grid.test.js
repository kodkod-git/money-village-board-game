// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LAYOUT, columnLetter, parseGrid, attachCellRefs, parseCsv, normalizeDateText } from './grid.js'
import { validateSheet } from './validation.js'
import { loadSeedQuestions } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

// grid[row-1][col-1] 형태로 템플릿과 같은 배치를 만든다. students: [{ nickname, memo, values: {code: v} }]
function makeGrid({ header = {}, students = [], codes = QUESTIONS.map(q => q.code) } = {}) {
  const grid = []
  const set = (row, col, v) => { (grid[row - 1] ??= [])[col - 1] = v }
  set(1, 1, '선생님 ID'); set(1, 2, header.teacherName ?? null)
  set(2, 1, '반 이름'); set(2, 2, header.className ?? null)
  set(3, 1, '수업시간'); set(3, 2, header.classTime ?? null)
  set(4, 1, '수업 날짜'); set(4, 2, header.completedOn ?? null)
  ;['코드', '단계', '질문', '①', '②'].forEach((t, i) => set(LAYOUT.nameRow, i + 1, t))
  set(LAYOUT.memoRow, 1, '메모')
  codes.forEach((code, i) => set(LAYOUT.firstQuestionRow + i, 1, code))
  students.forEach((s, k) => {
    const col = LAYOUT.firstStudentCol + k
    set(LAYOUT.nameRow, col, s.nickname ?? null)
    set(LAYOUT.memoRow, col, s.memo ?? null)
    QUESTIONS.forEach((q, i) => set(LAYOUT.firstQuestionRow + i, col, s.values?.[q.code] ?? null))
  })
  return grid
}

describe('columnLetter', () => {
  it('1→A, 6→F, 26→Z, 27→AA, 40→AN', () => {
    expect([1, 6, 26, 27, 40].map(columnLetter)).toEqual(['A', 'F', 'Z', 'AA', 'AN'])
  })
})

describe('normalizeDateText', () => {
  it('Date, YYYY/M/D, YYYY.MM.DD 를 YYYY-MM-DD 로', () => {
    expect(normalizeDateText(new Date(Date.UTC(2026, 10, 23)))).toBe('2026-11-23')
    expect(normalizeDateText('2026/11/3')).toBe('2026-11-03')
    expect(normalizeDateText('2026.11.23.')).toBe('2026-11-23')
    expect(normalizeDateText('11월 23일')).toBe('11월 23일')
    expect(normalizeDateText(null)).toBe('')
  })
})

describe('parseGrid', () => {
  it('헤더와 학생 열을 읽고, 빈 학생 열은 건너뛴다', () => {
    const grid = makeGrid({
      header: { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' },
      students: [
        { nickname: '민준', memo: '결석', values: { '01': 1, '15-1': '2' } },
        { nickname: null },
        { nickname: '서연', values: { '46': 2 } },
      ],
    })
    const parsed = parseGrid(grid, QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toEqual({ teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' })
    expect(parsed.students.map(s => s.nickname)).toEqual(['민준', '서연'])
    expect(parsed.students[0]).toMatchObject({ memo: '결석' })
    expect(parsed.students[0].answers).toMatchObject({ '01': 1, '15-1': 2, '02': null })
    expect(parsed.studentColumns).toEqual([6, 8])
  })

  it('숫자로 바뀐 문항 코드(1)는 01 로 맞춘다', () => {
    const codes = QUESTIONS.map(q => q.code)
    codes[0] = 1
    expect(parseGrid(makeGrid({ codes }), QUESTIONS).errors).toEqual([])
  })

  it('문항 행이 다르면 QUESTION_MISMATCH 와 셀 주소', () => {
    const codes = QUESTIONS.map(q => q.code)
    codes[2] = '99'
    const { errors } = parseGrid(makeGrid({ codes: [...codes, '47'] }), QUESTIONS)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'QUESTION_MISMATCH', cell: 'A10' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'QUESTION_MISMATCH', cell: 'A60' }))
  })

  it('attachCellRefs는 검증 오류에 엑셀 셀 주소를 붙인다', () => {
    const grid = makeGrid({
      header: { className: '햇살반', classTime: '토 10:00', completedOn: '' },
      students: [{ nickname: '민준', values: { '03': 3 } }, { nickname: null, values: { '01': 1 } }],
    })
    const parsed = parseGrid(grid, QUESTIONS)
    const errors = attachCellRefs(validateSheet(parsed, QUESTIONS), parsed)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'REQUIRED_HEADER', cell: 'B4' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'INVALID_ANSWER', cell: 'F10' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'REQUIRED_NICKNAME', cell: 'G6' }))
  })
})

describe('grid 보강', () => {
  it('CSV 로 저장되어 앞자리 0 이 빠진 문자열 코드(1~9)도 01~09 로 맞춘다', () => {
    const codes = QUESTIONS.map(q => q.code)
    for (let i = 0; i < 9; i++) codes[i] = String(i + 1)
    expect(parseGrid(makeGrid({ codes }), QUESTIONS).errors).toEqual([])
  })

  it('엑셀 시간 셀(1899-12-30 Date)은 HH:MM 으로 읽는다', () => {
    const grid = makeGrid({ header: { classTime: new Date(Date.UTC(1899, 11, 30, 10, 0)) } })
    expect(parseGrid(grid, QUESTIONS).header.classTime).toBe('10:00')
  })

  it('잘못된 Date 는 던지지 않고 빈 문자열', () => {
    expect(normalizeDateText(new Date(NaN))).toBe('')
    const grid = makeGrid({ header: { completedOn: new Date(NaN), className: new Date(NaN) } })
    const { header } = parseGrid(grid, QUESTIONS)
    expect(header.completedOn).toBe('')
    expect(header.className).toBe('')
  })
})

describe('parseCsv', () => {
  it('BOM, 따옴표, 쉼표, CRLF 를 처리하고 빈 칸은 null', () => {
    expect(parseCsv('\uFEFFa,"b,c","say ""hi"""\r\n,1\r\n')).toEqual([
      ['a', 'b,c', 'say "hi"'],
      [null, '1'],
    ])
  })
})
