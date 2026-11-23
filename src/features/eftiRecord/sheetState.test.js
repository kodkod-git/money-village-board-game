import { describe, it, expect } from 'vitest'
import { sheetReducer, initialSheetState, loadedSheetState, toSavePayload } from './sheetState'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

describe('sheetState', () => {
  it('새 기록지는 선생님이 채워진 빈 헤더와 빈 학생 1명', () => {
    const s = initialSheetState(QUESTIONS, 'kim')
    expect(s.original).toBeNull()
    expect(s.header).toEqual({ teacherName: 'kim', className: '', classTime: '', completedOn: '' })
    expect(s.students).toHaveLength(1)
    expect(s.students[0].answers['01']).toBeNull()
    expect(s.dirty).toBe(false)
  })

  it('cycleAnswer 는 빈칸 → 1 → 2 → 빈칸', () => {
    let s = initialSheetState(QUESTIONS, 'kim')
    const key = s.students[0].key
    const step = () => { s = sheetReducer(s, { type: 'cycleAnswer', key, code: '01' }); return s.students[0].answers['01'] }
    expect([step(), step(), step()]).toEqual([1, 2, null])
    expect(s.dirty).toBe(true)
  })

  it('저장된 학생 열을 지우면 deleteIds 에 id 가 들어간다', () => {
    let s = loadedSheetState(HEADER, [{ id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }])
    s = sheetReducer(s, { type: 'addStudent', questions: QUESTIONS })
    expect(s.students).toHaveLength(2)
    s = sheetReducer(s, { type: 'removeStudent', key: s.students[0].key })
    s = sheetReducer(s, { type: 'removeStudent', key: s.students[0].key })
    expect(s.deleteIds).toEqual(['r1'])
    expect(s.students).toHaveLength(0)
  })

  it('toSavePayload 는 original·header·students(id 있는 것만 id)·deleteIds', () => {
    let s = loadedSheetState(HEADER, [{ id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }])
    s = sheetReducer(s, { type: 'setHeader', field: 'classTime', value: '토 11:00' })
    s = sheetReducer(s, { type: 'addStudent', questions: QUESTIONS })
    s = sheetReducer(s, { type: 'setStudentField', key: s.students[1].key, field: 'nickname', value: '서연' })
    s = sheetReducer(s, { type: 'setAnswer', key: s.students[1].key, code: '01', value: 2 })
    const p = toSavePayload(s)
    expect(p.original).toEqual(HEADER)
    expect(p.header.classTime).toBe('토 11:00')
    expect(p.students[0]).toMatchObject({ id: 'r1', nickname: '민준', memo: '' })
    expect(p.students[1]).not.toHaveProperty('id')
    expect(p.students[1].answers['01']).toBe(2)
    expect(p.deleteIds).toEqual([])
  })
})
