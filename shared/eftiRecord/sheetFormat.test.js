// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  emptyAnswers, isBlankStudent, normalizeHeader, normalizeSheet, sameHeader,
  headerToRow, rowToHeader, rowToStudent, studentToRpc, countChangedAnswers,
} from './sheetFormat.js'
import { loadSeedQuestions, allAnswers } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

describe('sheetFormat', () => {
  it('emptyAnswers는 52개 코드를 모두 null로 만든다', () => {
    const a = emptyAnswers(QUESTIONS)
    expect(Object.keys(a)).toHaveLength(52)
    expect(a['15-1']).toBeNull()
  })

  it('이름·메모·답이 모두 비면 빈 학생이다', () => {
    expect(isBlankStudent({ nickname: ' ', memo: '', answers: emptyAnswers(QUESTIONS) })).toBe(true)
    expect(isBlankStudent({ nickname: '', memo: '', answers: { ...emptyAnswers(QUESTIONS), '01': 1 } })).toBe(false)
    expect(isBlankStudent({ nickname: '', memo: '결석', answers: {} })).toBe(false)
  })

  it('normalizeSheet는 공백을 다듬고 빈 학생을 빼고 빈 메모를 null로 만든다', () => {
    const sheet = normalizeSheet({
      header: { ...HEADER, className: ' 햇살반 ' },
      students: [
        { id: 'r1', nickname: ' 민준 ', memo: '  ', answers: { '01': 1, '02': '' } },
        { nickname: '', memo: '', answers: {} },
      ],
    }, QUESTIONS)
    expect(sheet.header.className).toBe('햇살반')
    expect(sheet.students).toHaveLength(1)
    expect(sheet.students[0]).toMatchObject({ id: 'r1', nickname: '민준', memo: null })
    expect(sheet.students[0].answers['01']).toBe(1)
    expect(sheet.students[0].answers['02']).toBeNull()
    expect(Object.keys(sheet.students[0].answers)).toHaveLength(52)
  })

  it('sameHeader는 앞뒤 공백을 무시하고 비교한다', () => {
    expect(sameHeader(HEADER, { ...HEADER, classTime: ' 토 10:00 ' })).toBe(true)
    expect(sameHeader(HEADER, { ...HEADER, completedOn: '2026-11-30' })).toBe(false)
  })

  it('헤더와 DB 행을 서로 바꾼다', () => {
    const row = headerToRow(HEADER)
    expect(row).toEqual({ teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23' })
    expect(rowToHeader(row)).toEqual(HEADER)
  })

  it('DB 행 → 학생, 학생 → RPC 형태 (답 키는 column_name)', () => {
    const row = { id: 'r1', nickname: '민준', memo: null, q01: 1, q15_1: 2 }
    const student = rowToStudent(row, QUESTIONS)
    expect(student.answers['01']).toBe(1)
    expect(student.answers['15-1']).toBe(2)
    expect(student.answers['02']).toBeNull()
    const rpc = studentToRpc(student, QUESTIONS)
    expect(rpc).toMatchObject({ id: 'r1', nickname: '민준', memo: null })
    expect(rpc.answers.q15_1).toBe(2)
    expect(studentToRpc({ nickname: 'a', memo: null, answers: {} }, QUESTIONS)).not.toHaveProperty('id')
  })

  it('countChangedAnswers는 값이 다른 문항 수를 센다', () => {
    const a = allAnswers(QUESTIONS, 1)
    expect(countChangedAnswers(a, { ...a, '01': 2, '46': null }, QUESTIONS)).toBe(2)
  })
})
