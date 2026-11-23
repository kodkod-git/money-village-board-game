// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import { once } from 'node:events'
import { createEftiRecordRouter } from './routes.js'
import { emptyAnswers } from '../../shared/eftiRecord/sheetFormat.js'
import { loadSeedQuestions, allAnswers } from '../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const TEACHER = { username: 'kim', isSuper: false }
const MASTER = { username: 'admin', isSuper: true }
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const LEE_QUERY = '?teacher_name=lee&class_name=a&class_time=b&completed_on=2026-11-23'

const student = (nickname, answers = {}, extra = {}) => ({ nickname, memo: null, answers: { ...emptyAnswers(QUESTIONS), ...answers }, ...extra })

function fakeRepo(overrides = {}) {
  return {
    listQuestions: vi.fn(async () => QUESTIONS),
    listSheets: vi.fn(async () => []),
    getSheet: vi.fn(async () => []),
    saveSheet: vi.fn(async () => []),
    deleteSheet: vi.fn(async () => {}),
    listResults: vi.fn(async () => []),
    ...overrides,
  }
}

function fakeXlsx(overrides = {}) {
  return {
    buildTemplate: vi.fn(async () => Buffer.from('xlsx')),
    parseUpload: vi.fn(),
    ...overrides,
  }
}

async function call({ repo = fakeRepo(), xlsx = fakeXlsx(), admin = TEACHER, method = 'GET', path, body, raw }) {
  const app = express()
  app.use(express.json())
  const requireAdmin = (req, _res, next) => { req.admin = admin; next() }
  app.use('/api', createEftiRecordRouter({ repo, xlsx, requireAdmin }))
  const server = app.listen(0)
  await once(server, 'listening')
  try {
    const headers = {}
    let payload
    if (raw) { headers['Content-Type'] = 'application/octet-stream'; payload = raw }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: payload })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* 바이너리 응답 */ }
    return { status: res.status, headers: res.headers, json, repo, xlsx }
  } finally {
    server.close()
  }
}

describe('GET /sheets, /results', () => {
  it('일반 관리자는 자기 기록만, 마스터는 전체', async () => {
    const a = await call({ path: '/sheets' })
    expect(a.repo.listSheets).toHaveBeenCalledWith({ teacherName: 'kim' })
    const b = await call({ admin: MASTER, path: '/sheets' })
    expect(b.repo.listSheets).toHaveBeenCalledWith({ teacherName: null })
  })

  it('결과 조회: 일반 관리자는 teacher_name 쿼리를 무시하고 자기 것만', async () => {
    const r = await call({ path: '/results?teacher_name=lee&class_name=햇살반&q=민&needs_follow_up=1' })
    expect(r.repo.listResults).toHaveBeenCalledWith({
      teacherName: 'kim', className: '햇살반', classTime: null, completedOn: null, q: '민', needsFollowUp: true,
    })
    const m = await call({ admin: MASTER, path: '/results?teacher_name=lee' })
    expect(m.repo.listResults).toHaveBeenCalledWith(expect.objectContaining({ teacherName: 'lee', needsFollowUp: false }))
  })
})

describe('GET/DELETE /sheet', () => {
  it('다른 선생님 기록지는 일반 관리자에게 403', async () => {
    expect((await call({ path: `/sheet${LEE_QUERY}` })).status).toBe(403)
    expect((await call({ method: 'DELETE', path: `/sheet${LEE_QUERY}` })).status).toBe(403)
  })

  it('없는 기록지는 404, 있으면 헤더와 학생', async () => {
    expect((await call({ admin: MASTER, path: `/sheet${LEE_QUERY}` })).status).toBe(404)
    const repo = fakeRepo({ getSheet: vi.fn(async () => [student('민준', {}, { id: 'r1' })]) })
    const r = await call({ repo, admin: MASTER, path: `/sheet${LEE_QUERY}` })
    expect(r.status).toBe(200)
    expect(r.json.header).toEqual({ teacherName: 'lee', className: 'a', classTime: 'b', completedOn: '2026-11-23' })
    expect(r.json.students[0].id).toBe('r1')
  })

  it('DELETE 는 204', async () => {
    const r = await call({ method: 'DELETE', path: '/sheet?teacher_name=kim&class_name=a&class_time=b&completed_on=2026-11-23' })
    expect(r.status).toBe(204)
    expect(r.repo.deleteSheet).toHaveBeenCalledWith({ teacherName: 'kim', className: 'a', classTime: 'b', completedOn: '2026-11-23' })
  })
})

describe('PUT /sheet', () => {
  it('새 기록지: 일반 관리자는 선생님 칸을 로그인 계정으로 덮어쓴다', async () => {
    const r = await call({ method: 'PUT', path: '/sheet', body: {
      original: null, header: { ...HEADER, teacherName: 'lee', className: ' 햇살반 ' }, students: [student('민준', { '01': 1 }), student('')], deleteIds: [],
    } })
    expect(r.status).toBe(200)
    const [payload] = r.repo.saveSheet.mock.calls[0]
    expect(payload.header).toEqual(HEADER)
    expect(payload.students).toHaveLength(1)
    expect(r.repo.getSheet).toHaveBeenCalledWith(HEADER, QUESTIONS)
  })

  it('남의 기록지 수정: 일반 관리자는 403, 마스터는 원래 선생님을 유지', async () => {
    const body = { original: { ...HEADER, teacherName: 'lee' }, header: { ...HEADER, teacherName: 'admin' }, students: [student('민준')], deleteIds: ['r9'] }
    expect((await call({ method: 'PUT', path: '/sheet', body })).status).toBe(403)
    const m = await call({ admin: MASTER, method: 'PUT', path: '/sheet', body })
    expect(m.status).toBe(200)
    const [payload] = m.repo.saveSheet.mock.calls[0]
    expect(payload.header.teacherName).toBe('lee')
    expect(payload.original.teacherName).toBe('lee')
    expect(payload.deleteIds).toEqual(['r9'])
  })

  it('검증 오류는 400 이고 저장하지 않는다', async () => {
    const r = await call({ method: 'PUT', path: '/sheet', body: { original: null, header: { ...HEADER, className: '' }, students: [student('민준', { '01': 3 })] } })
    expect(r.status).toBe(400)
    expect(r.json.errors.map(e => e.code)).toEqual(['REQUIRED_HEADER', 'INVALID_ANSWER'])
    expect(r.repo.saveSheet).not.toHaveBeenCalled()
  })

  it.each([
    ['EF409', 'SHEET_EXISTS'],
    ['23505', 'NICKNAME_EXISTS'],
    ['P0002', 'STALE_SHEET'],
  ])('DB 오류 %s 는 409 %s', async (dbCode, errorCode) => {
    const repo = fakeRepo({ saveSheet: vi.fn(async () => { throw { code: dbCode } }) })
    const r = await call({ repo, method: 'PUT', path: '/sheet', body: { original: null, header: HEADER, students: [student('민준')] } })
    expect(r.status).toBe(409)
    expect(r.json.errors[0].code).toBe(errorCode)
  })
})

describe('잘못된 입력 형식 DB 오류', () => {
  it('22007 은 400 INVALID_INPUT', async () => {
    const repo = fakeRepo({ getSheet: vi.fn(async () => { throw { code: '22007' } }) })
    const r = await call({ repo, admin: MASTER, path: `/sheet${LEE_QUERY}` })
    expect(r.status).toBe(400)
    expect(r.json.errors[0].code).toBe('INVALID_INPUT')
  })
})

describe('POST /upload', () => {
  const parsed = (header, students) => ({
    header, students, errors: [], studentColumns: students.map((_, i) => 6 + i),
    questionRows: Object.fromEntries(QUESTIONS.map((q, i) => [q.code, 8 + i])),
  })

  it('빈 파일은 400 EMPTY_FILE', async () => {
    const r = await call({ method: 'POST', path: '/upload', raw: Buffer.alloc(0) })
    expect(r.status).toBe(400)
    expect(r.json.errors[0].code).toBe('EMPTY_FILE')
  })

  it('일반 관리자 파일의 선생님 칸이 다르면 TEACHER_MISMATCH (B1)', async () => {
    const xlsx = fakeXlsx({ parseUpload: vi.fn(async () => parsed({ ...HEADER, teacherName: 'lee' }, [student('민준', allAnswers(QUESTIONS, 1))])) })
    const r = await call({ xlsx, method: 'POST', path: '/upload', raw: Buffer.from('x') })
    expect(r.status).toBe(200)
    expect(r.json.header.teacherName).toBe('kim')
    expect(r.json.errors).toContainEqual(expect.objectContaining({ code: 'TEACHER_MISMATCH', cell: 'B1' }))
  })

  it('기존 학생과 이름이 같으면 overwrite + 바뀐 문항 수, 아니면 new', async () => {
    const repo = fakeRepo({ getSheet: vi.fn(async () => [student('민준', allAnswers(QUESTIONS, 1), { id: 'r1' })]) })
    const xlsx = fakeXlsx({ parseUpload: vi.fn(async () => parsed({ ...HEADER, teacherName: '' }, [
      student('민준', { ...allAnswers(QUESTIONS, 1), '01': 2 }),
      student('서연', { '01': 1 }),
    ])) })
    const r = await call({ repo, xlsx, method: 'POST', path: '/upload', raw: Buffer.from('x') })
    expect(r.json.errors).toEqual([])
    expect(r.json.existingSheet).toBe(true)
    expect(r.json.students.map(s => [s.nickname, s.status, s.existingId, s.changedCount])).toEqual([
      ['민준', 'overwrite', 'r1', 1],
      ['서연', 'new', null, 0],
    ])
  })

  it('UploadFormatError 는 400 과 그 코드', async () => {
    const { UploadFormatError } = await import('./xlsx.js')
    const xlsx = fakeXlsx({ parseUpload: vi.fn(async () => { throw new UploadFormatError('ENCODING', 'utf8') }) })
    const r = await call({ xlsx, method: 'POST', path: '/upload', raw: Buffer.from('x') })
    expect(r.status).toBe(400)
    expect(r.json.errors[0]).toEqual({ code: 'ENCODING', message: 'utf8' })
  })
})

describe('GET /template.xlsx', () => {
  it('로그인 계정을 선생님 칸에 넣은 엑셀 파일을 내려준다', async () => {
    const r = await call({ path: '/template.xlsx' })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('spreadsheetml')
    expect(r.headers.get('content-disposition')).toContain('attachment')
    expect(r.xlsx.buildTemplate).toHaveBeenCalledWith(QUESTIONS, { teacherName: 'kim' })
  })
})
