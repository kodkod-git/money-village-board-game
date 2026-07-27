// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { signAdminToken, requireAdmin } from './adminAuth.js'

function mockReqRes(headerValue) {
  const req = { get: () => headerValue }
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  return { req, res }
}

describe('signAdminToken / requireAdmin', () => {
  it('유효한 토큰이면 req.admin에 payload를 담고 next를 호출한다', () => {
    const token = signAdminToken({ id: 'a1', username: 'admin', isSuper: true })
    const { req, res } = mockReqRes(`Bearer ${token}`)
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.admin).toMatchObject({ adminId: 'a1', username: 'admin', isSuper: true })
  })

  it('토큰이 없으면 401을 반환한다', () => {
    const { req, res } = mockReqRes('')
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('토큰이 위조되었으면 401을 반환한다', () => {
    const { req, res } = mockReqRes('Bearer not-a-real-token')
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})
