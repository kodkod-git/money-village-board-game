// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeResult } from './scoring.js'
import { loadSeedQuestions, allAnswers } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

describe('seed 픽스처', () => {
  it('시드 52문항을 기록지 순서로 읽는다 (1단계 28, 2단계 24)', () => {
    expect(QUESTIONS).toHaveLength(52)
    expect(QUESTIONS.filter(q => q.stage === 1)).toHaveLength(28)
    expect(QUESTIONS[0]).toMatchObject({ code: '01', columnName: 'q01', letter1: 'F', letter2: 'P' })
    expect(QUESTIONS[51]).toMatchObject({ code: '46', sortOrder: 52 })
    expect(new Set(QUESTIONS.map(q => q.code)).size).toBe(52)
  })
})

// supabase/tests/efti_record_verify.sql 케이스 3·4·5와 같은 기대값
describe('computeResult', () => {
  it('52문항 모두 1이면 PASC / PASN, 미응답 없음', () => {
    const r = computeResult(allAnswers(QUESTIONS, 1), QUESTIONS)
    expect(r.citizenType).toBe('PASC')
    expect(r.passportType).toBe('PASN')
    expect(r.citizenCounts).toEqual({ F: 1, P: 6, A: 7, T: 0, S: 7, E: 0, C: 6, N: 1 })
    expect(r.passportCounts).toEqual({ F: 6, P: 7, A: 13, T: 0, S: 9, E: 4, C: 6, N: 7 })
    expect(r.missingCodes).toEqual([])
  })

  it('52문항 모두 2이면 FTEN / FTEC', () => {
    const r = computeResult(allAnswers(QUESTIONS, 2), QUESTIONS)
    expect(r.citizenType).toBe('FTEN')
    expect(r.passportType).toBe('FTEC')
  })

  it('2단계 33-2만 빈칸이면 시민권은 나오고 여권은 null', () => {
    const r = computeResult({ ...allAnswers(QUESTIONS, 1), '33-2': null }, QUESTIONS)
    expect(r.citizenType).toBe('PASC')
    expect(r.passportType).toBeNull()
    expect(r.missingCodes).toEqual(['33-2'])
  })

  it('15-1과 46이 빈칸이면 둘 다 null, 미응답은 기록지 순서', () => {
    const r = computeResult({ ...allAnswers(QUESTIONS, 1), '46': null, '15-1': null }, QUESTIONS)
    expect(r.citizenType).toBeNull()
    expect(r.passportType).toBeNull()
    expect(r.missingCodes).toEqual(['15-1', '46'])
  })

  it('1·2가 아닌 값은 미응답으로 센다', () => {
    const r = computeResult({ ...allAnswers(QUESTIONS, 1), '01': '3' }, QUESTIONS)
    expect(r.missingCodes).toEqual(['01'])
  })
})
