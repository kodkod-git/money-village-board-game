// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateSheet, isValidDate, makeError, ERROR_MESSAGES } from './validation.js'
import { emptyAnswers } from './sheetFormat.js'
import { loadSeedQuestions } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const student = (nickname, answers = {}) => ({ nickname, memo: '', answers: { ...emptyAnswers(QUESTIONS), ...answers } })
const codes = errors => errors.map(e => e.code)

describe('isValidDate', () => {
  it('실제 있는 YYYY-MM-DD만 통과', () => {
    expect(isValidDate('2026-11-23')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026/11/23')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})

describe('validateSheet', () => {
  it('정상 기록지는 오류가 없다 (빈칸 허용)', () => {
    expect(validateSheet({ header: HEADER, students: [student('민준', { '01': 1 })] }, QUESTIONS)).toEqual([])
  })

  it('필수 헤더가 비면 필드별 REQUIRED_HEADER', () => {
    const errors = validateSheet({ header: { ...HEADER, className: ' ', completedOn: '' }, students: [student('민준')] }, QUESTIONS)
    expect(errors.filter(e => e.code === 'REQUIRED_HEADER').map(e => e.field)).toEqual(['className', 'completedOn'])
  })

  it('잘못된 날짜는 INVALID_DATE', () => {
    const errors = validateSheet({ header: { ...HEADER, completedOn: '2026-13-01' }, students: [student('민준')] }, QUESTIONS)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'INVALID_DATE', field: 'completedOn' }))
  })

  it('답이 있는데 이름이 없으면 REQUIRED_NICKNAME, 겹치는 이름은 DUPLICATE_NICKNAME', () => {
    const errors = validateSheet({
      header: HEADER,
      students: [student('민준'), student('', { '01': 1 }), student(' 민준 ')],
    }, QUESTIONS)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'REQUIRED_NICKNAME', studentIndex: 1 }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_NICKNAME', studentIndex: 2 }))
  })

  it('1·2·빈칸이 아닌 답은 INVALID_ANSWER (문항 코드 포함)', () => {
    const errors = validateSheet({ header: HEADER, students: [student('민준', { '15-1': 3, '02': '' })] }, QUESTIONS)
    expect(errors).toEqual([expect.objectContaining({ code: 'INVALID_ANSWER', studentIndex: 0, questionCode: '15-1' })])
  })

  it('빈 학생 열은 건너뛰고, 학생이 하나도 없으면 NO_STUDENTS', () => {
    expect(codes(validateSheet({ header: HEADER, students: [student('')] }, QUESTIONS))).toEqual(['NO_STUDENTS'])
  })

  it('makeError는 기본 메시지를 넣고 덮어쓸 수 있다', () => {
    expect(makeError('INVALID_ANSWER', { cell: 'F8' })).toEqual({ code: 'INVALID_ANSWER', message: ERROR_MESSAGES.INVALID_ANSWER, cell: 'F8' })
    expect(makeError('QUESTION_MISMATCH', { message: 'x' }).message).toBe('x')
  })
})
