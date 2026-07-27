// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createAdmin, verifyAdminPassword, seedMasterAdmin } from './admins.js'

beforeEach(() => mockFrom.mockReset())

describe('createAdmin', () => {
  it('비밀번호를 해시해서 저장하고 평문 비밀번호는 반환하지 않는다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'coach1', is_super: false },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const admin = await createAdmin('coach1', 'hunter2')

    expect(admin).toEqual({ id: 'a1', username: 'coach1', isSuper: false })
    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.username).toBe('coach1')
    expect(insertedRow.password_hash).not.toBe('hunter2')
  })
})

describe('verifyAdminPassword', () => {
  it('비밀번호가 맞으면 admin 정보를 반환한다', async () => {
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash('hunter2', 10)
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'coach1', password_hash: passwordHash, is_super: false },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await verifyAdminPassword('coach1', 'hunter2')

    expect(result).toEqual({ id: 'a1', username: 'coach1', isSuper: false })
  })

  it('비밀번호가 틀리면 null을 반환한다', async () => {
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash('hunter2', 10)
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'coach1', password_hash: passwordHash, is_super: false },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await verifyAdminPassword('coach1', 'wrong-password')

    expect(result).toBeNull()
  })

  it('존재하지 않는 아이디면 null을 반환한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await verifyAdminPassword('nobody', 'anything')

    expect(result).toBeNull()
  })
})

describe('seedMasterAdmin', () => {
  it('admin 계정이 이미 있으면 새로 만들지 않는다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'a1', username: 'admin', password_hash: 'x', is_super: true },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockInsert = vi.fn()
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })

    await seedMasterAdmin()

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('admin 계정이 없으면 is_super=true로 생성한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })

    await seedMasterAdmin()

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ username: 'admin', is_super: true }))
  })
})
