// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, getClassMode, UNASSIGNED_CLASS } from './classes.js'

beforeEach(() => {
  mockFrom.mockReset()
})

describe('createClass', () => {
  function mockCreate(classRow) {
    const mockClassSingle = vi.fn().mockResolvedValue({ data: classRow, error: null })
    const mockClassSelect = vi.fn().mockReturnValue({ single: mockClassSingle })
    const mockClassInsert = vi.fn().mockReturnValue({ select: mockClassSelect })
    const mockAccessInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation(table => {
      if (table === 'classes') return { insert: mockClassInsert }
      if (table === 'admin_class_access') return { insert: mockAccessInsert }
      throw new Error(`unexpected table: ${table}`)
    })
    return { mockClassInsert, mockClassSelect, mockAccessInsert }
  }

  it('수업을 생성하고 생성자에게 접근권을 부여한다', async () => {
    const { mockClassInsert, mockClassSelect, mockAccessInsert } = mockCreate({ id: 'class-1', name: '3학년 2반', mode: 'normal' })

    const cls = await createClass('  3학년 2반  ', 'admin-1')

    expect(mockClassInsert).toHaveBeenCalledWith({ name: '3학년 2반', created_by: 'admin-1', mode: 'normal' })
    expect(mockClassSelect).toHaveBeenCalledWith('id, name, mode')
    expect(mockAccessInsert).toHaveBeenCalledWith({ admin_id: 'admin-1', class_id: 'class-1' })
    expect(cls).toEqual({ id: 'class-1', name: '3학년 2반', mode: 'normal' })
  })

  it('경쟁 모드를 저장하고, 알 수 없는 모드는 일반 모드로 저장한다', async () => {
    const { mockClassInsert } = mockCreate({ id: 'class-1', name: 'A', mode: 'competition' })
    await createClass('A', 'admin-1', 'competition')
    expect(mockClassInsert).toHaveBeenLastCalledWith({ name: 'A', created_by: 'admin-1', mode: 'competition' })

    await createClass('B', 'admin-1', 'weird')
    expect(mockClassInsert).toHaveBeenLastCalledWith({ name: 'B', created_by: 'admin-1', mode: 'normal' })
  })
})

describe('listClassesForAdmin', () => {
  it('is_super면 전체 수업 + 미배정 수업 가상 항목을 생성일 최신순으로 반환한다', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'class-1', name: '3학년 2반', mode: 'competition', created_at: '2026-07-27T00:00:00.000Z' }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(mockSelect).toHaveBeenCalledWith('id, name, mode, created_at')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(classes).toEqual([
      { id: 'class-1', name: '3학년 2반', mode: 'competition', createdAt: '2026-07-27T00:00:00.000Z' },
      { id: 'unassigned', name: UNASSIGNED_CLASS, mode: 'normal' },
    ])
  })

  it('일반 관리자는 admin_class_access로 연결된 수업을 생성일 최신순으로 반환한다', async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        { classes: { id: 'class-1', name: '오래된 수업', created_at: '2026-07-01T00:00:00.000Z' } },
        { classes: { id: 'class-2', name: '최근 수업', created_at: '2026-08-01T00:00:00.000Z' } },
      ],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: false })

    expect(mockSelect).toHaveBeenCalledWith('classes(id, name, mode, created_at)')
    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(classes).toEqual([
      { id: 'class-2', name: '최근 수업', mode: 'normal', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'class-1', name: '오래된 수업', mode: 'normal', createdAt: '2026-07-01T00:00:00.000Z' },
    ])
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

describe('deleteClass', () => {
  it('classes 테이블에서 해당 id를 삭제한다', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    await deleteClass('class-1')

    expect(mockEq).toHaveBeenCalledWith('id', 'class-1')
  })

  it('에러가 나면 던진다', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    await expect(deleteClass('class-1')).rejects.toEqual({ message: 'boom' })
  })
})

describe('getClassMode', () => {
  it('수업의 mode를 돌려준다', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { mode: 'competition' }, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    expect(await getClassMode('class-1')).toBe('competition')
    expect(mockFrom).toHaveBeenCalledWith('classes')
    expect(mockSelect).toHaveBeenCalledWith('mode')
    expect(mockEq).toHaveBeenCalledWith('id', 'class-1')
  })

  it('없는 수업이면 normal', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) })
    expect(await getClassMode('nope')).toBe('normal')
  })

  it('미배정 수업이나 빈 값은 DB를 조회하지 않고 normal', async () => {
    expect(await getClassMode('unassigned')).toBe('normal')
    expect(await getClassMode(null)).toBe('normal')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
