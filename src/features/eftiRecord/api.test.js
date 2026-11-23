import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSheet, saveSheet, deleteSheet, fetchResults, uploadFile, ApiError } from './api'
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'

const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

beforeEach(() => {
  clearAdminSession()
  setAdminSession('t1', { username: 'kim', isSuper: false })
  global.fetch = vi.fn(() => ok({}))
})

describe('eftiRecord api', () => {
  it('fetchSheet는 헤더를 쿼리로 보내고 토큰을 붙인다', async () => {
    await fetchSheet(HEADER)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/efti-record/sheet?teacher_name=kim&class_name=%ED%96%87%EC%82%B4%EB%B0%98&class_time=%ED%86%A0+10%3A00&completed_on=2026-11-23')
    expect(options.headers.Authorization).toBe('Bearer t1')
  })

  it('saveSheet는 PUT JSON', async () => {
    await saveSheet({ original: null, header: HEADER, students: [], deleteIds: [] })
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/efti-record/sheet')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body).header).toEqual(HEADER)
  })

  it('오류 응답은 errors 를 가진 ApiError', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ errors: [{ code: 'SHEET_EXISTS', message: '이미 있어요' }] }) }))
    const err = await saveSheet({}).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.errors[0].code).toBe('SHEET_EXISTS')
    expect(err.message).toBe('이미 있어요')
  })

  it('deleteSheet 204 는 null', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) }))
    expect(await deleteSheet(HEADER)).toBeNull()
  })

  it('fetchResults는 값이 있는 필터만 보낸다', async () => {
    await fetchResults({ teacherName: '', className: '햇살반', q: '', needsFollowUp: true })
    expect(global.fetch.mock.calls[0][0]).toBe('/api/admin/efti-record/results?class_name=%ED%96%87%EC%82%B4%EB%B0%98&needs_follow_up=1')
  })

  it('uploadFile은 파일을 octet-stream 으로 보낸다', async () => {
    const file = new Blob(['x'])
    await uploadFile(file)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/efti-record/upload')
    expect(options.headers['Content-Type']).toBe('application/octet-stream')
    expect(options.body).toBe(file)
  })
})
