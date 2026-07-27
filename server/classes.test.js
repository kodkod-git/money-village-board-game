// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, UNASSIGNED_CLASS } from './classes.js'

beforeEach(() => {
  mockFrom.mockReset()
})

describe('createClass', () => {
  it('수업을 생성하고 생성자에게 접근권을 부여한다', async () => {
    const mockClassSingle = vi.fn().mockResolvedValue({ data: { id: 'class-1', name: '3학년 2반' }, error: null })
    const mockClassSelect = vi.fn().mockReturnValue({ single: mockClassSingle })
    const mockClassInsert = vi.fn().mockReturnValue({ select: mockClassSelect })
    const mockAccessInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation(table => {
      if (table === 'classes') return { insert: mockClassInsert }
      if (table === 'admin_class_access') return { insert: mockAccessInsert }
      throw new Error(`unexpected table: ${table}`)
    })

    const cls = await createClass('  3학년 2반  ', 'admin-1')

    expect(mockClassInsert).toHaveBeenCalledWith({ name: '3학년 2반', created_by: 'admin-1' })
    expect(mockAccessInsert).toHaveBeenCalledWith({ admin_id: 'admin-1', class_id: 'class-1' })
    expect(cls).toEqual({ id: 'class-1', name: '3학년 2반' })
  })
})

describe('listClassesForAdmin', () => {
  it('is_super면 전체 수업 + 미배정 수업 가상 항목을 반환한다', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'class-1', name: '3학년 2반', created_at: '2026-07-27T00:00:00.000Z' }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(classes).toEqual([
      { id: 'class-1', name: '3학년 2반', createdAt: '2026-07-27T00:00:00.000Z' },
      { id: 'unassigned', name: UNASSIGNED_CLASS },
    ])
  })

  it('일반 관리자는 admin_class_access로 연결된 수업만 반환한다', async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [{ classes: { id: 'class-1', name: '3학년 2반', created_at: '2026-07-27T00:00:00.000Z' } }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: false })

    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(classes).toEqual([{ id: 'class-1', name: '3학년 2반', createdAt: '2026-07-27T00:00:00.000Z' }])
  })
})

describe('hasClassAccess', () => {
  it('is_super면 항상 true를 반환한다', async () => {
    const result = await hasClassAccess({ adminId: 'admin-1', isSuper: true }, 'class-999')
    expect(result).toBe(true)
  })

  it('일반 관리자는 미배정 수업에 접근할 수 없다', async () => {
    const result = await hasClassAccess({ adminId: 'admin-1', isSuper: false }, 'unassigned')
    expect(result).toBe(false)
  })

  it('접근권이 있으면 true를 반환한다', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: [{ class_id: 'class-1' }], error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await hasClassAccess({ adminId: 'admin-1', isSuper: false }, 'class-1')

    expect(result).toBe(true)
  })

  it('접근권이 없으면 false를 반환한다', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await hasClassAccess({ adminId: 'admin-1', isSuper: false }, 'class-2')

    expect(result).toBe(false)
  })
})

describe('updateClassName', () => {
  it('수업 이름을 변경한다', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'class-1', name: '새이름' }, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const cls = await updateClassName('class-1', '  새이름  ')

    expect(mockUpdate).toHaveBeenCalledWith({ name: '새이름' })
    expect(mockEq).toHaveBeenCalledWith('id', 'class-1')
    expect(cls).toEqual({ id: 'class-1', name: '새이름' })
  })
})
