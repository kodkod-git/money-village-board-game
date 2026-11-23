// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('./client.js', () => ({
  supabaseEftiRecord: { from: (...a) => mockFrom(...a), rpc: (...a) => mockRpc(...a) },
}))

import { listQuestions, listSheets, getSheet, saveSheet, deleteSheet, listResults } from './repo.js'
import { loadSeedQuestions } from '../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

// 체인 메서드를 기록하고, await 하면 result 를 돌려주는 가짜 쿼리 빌더
function builder(result) {
  const b = { calls: [] }
  for (const m of ['select', 'order', 'eq', 'ilike', 'is', 'delete']) {
    b[m] = vi.fn((...args) => { b.calls.push([m, ...args]); return b })
  }
  b.range = vi.fn(() => Promise.resolve(result))
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return b
}

beforeEach(() => { mockFrom.mockReset(); mockRpc.mockReset() })

describe('repo', () => {
  it('listQuestions는 sort_order 순 문항을 camelCase 로', async () => {
    const b = builder({ data: [{ code: '01', column_name: 'q01', stage: 1, axis: 'T', question: 'q', option1: 'a', option2: 'b', letter1: 'F', letter2: 'P', sort_order: 1 }], error: null })
    mockFrom.mockReturnValue(b)
    expect(await listQuestions()).toEqual([{ code: '01', columnName: 'q01', stage: 1, axis: 'T', question: 'q', option1: 'a', option2: 'b', letter1: 'F', letter2: 'P', sortOrder: 1 }])
    expect(b.order).toHaveBeenCalledWith('sort_order')
  })

  it('listSheets는 결과 뷰 행을 기록지별로 묶고 보충 필요 수를 센다', async () => {
    const rows = [
      { teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23', passport_type: 'PASN' },
      { teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23', passport_type: null },
      { teacher_name: 'kim', class_name: '달님반', class_time: '일 10:00', completed_on: '2026-11-16', passport_type: 'FTEC' },
    ]
    const b = builder({ data: rows, error: null })
    mockFrom.mockReturnValue(b)
    const sheets = await listSheets({ teacherName: 'kim' })
    expect(mockFrom).toHaveBeenCalledWith('record_results')
    expect(b.eq).toHaveBeenCalledWith('teacher_name', 'kim')
    expect(sheets).toEqual([
      { header: HEADER, studentCount: 2, needsFollowUpCount: 1 },
      { header: { teacherName: 'kim', className: '달님반', classTime: '일 10:00', completedOn: '2026-11-16' }, studentCount: 1, needsFollowUpCount: 0 },
    ])
  })

  it('getSheet는 헤더 4개로 거른 records 를 학생으로 바꾼다', async () => {
    const b = builder({ data: [{ id: 'r1', nickname: '민준', memo: null, q01: 1 }], error: null })
    mockFrom.mockReturnValue(b)
    const students = await getSheet(HEADER, QUESTIONS)
    expect(mockFrom).toHaveBeenCalledWith('records')
    expect(b.eq).toHaveBeenCalledWith('class_name', '햇살반')
    expect(b.eq).toHaveBeenCalledWith('completed_on', '2026-11-23')
    expect(students[0]).toMatchObject({ id: 'r1', nickname: '민준' })
    expect(students[0].answers['01']).toBe(1)
  })

  it('saveSheet는 save_sheet RPC 를 snake_case 인자로 부른다', async () => {
    mockRpc.mockResolvedValue({ data: ['r1'], error: null })
    await saveSheet({
      original: HEADER,
      header: { ...HEADER, classTime: '토 11:00' },
      students: [{ id: 'r1', nickname: '민준', memo: null, answers: { '01': 2 } }],
      deleteIds: [],
    }, QUESTIONS)
    const [name, args] = mockRpc.mock.calls[0]
    expect(name).toBe('save_sheet')
    expect(args.p_original).toEqual({ teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23' })
    expect(args.p_header.class_time).toBe('토 11:00')
    expect(args.p_students[0]).toMatchObject({ id: 'r1', nickname: '민준' })
    expect(args.p_students[0].answers.q01).toBe(2)
    expect(args.p_delete_ids).toBeNull()
  })

  it('saveSheet는 DB 오류(code 포함)를 그대로 던진다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'dup' } })
    await expect(saveSheet({ original: null, header: HEADER, students: [], deleteIds: [] }, QUESTIONS))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('deleteSheet는 헤더 4개로 records 를 지운다', async () => {
    const b = builder({ error: null })
    mockFrom.mockReturnValue(b)
    await deleteSheet(HEADER)
    expect(b.delete).toHaveBeenCalled()
    expect(b.eq).toHaveBeenCalledWith('teacher_name', 'kim')
  })

  it('listResults는 필터를 걸고 결과를 camelCase 로', async () => {
    const b = builder({ data: [{
      record_id: 'r1', teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23',
      nickname: '민준', memo: '결석', citizen_type: 'PASC', passport_type: null,
      passport_f: 6, passport_p: 6, passport_a: 12, passport_t: 0, passport_s: 9, passport_e: 3, passport_c: 6, passport_n: 7,
      missing_codes: ['33-2'],
    }], error: null })
    mockFrom.mockReturnValue(b)
    const rows = await listResults({ teacherName: 'kim', className: '햇살반', q: '민_*', needsFollowUp: true })
    expect(b.eq).toHaveBeenCalledWith('class_name', '햇살반')
    expect(b.ilike).toHaveBeenCalledWith('nickname', '%민\\_\\*%')
    expect(b.is).toHaveBeenCalledWith('passport_type', null)
    expect(rows[0]).toEqual({
      recordId: 'r1', header: HEADER, nickname: '민준', memo: '결석', citizenType: 'PASC', passportType: null,
      passportCounts: { F: 6, P: 6, A: 12, T: 0, S: 9, E: 3, C: 6, N: 7 }, missingCodes: ['33-2'],
    })
  })
})
