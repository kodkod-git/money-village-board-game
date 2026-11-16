// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass, getClassInfo, listOfficialContests, UNASSIGNED_CLASS } from './classes.js'

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

    expect(mockClassInsert).toHaveBeenCalledWith({ name: '3학년 2반', created_by: 'admin-1', kind: 'class', board_count: 6 })
    expect(mockAccessInsert).toHaveBeenCalledWith({ admin_id: 'admin-1', class_id: 'class-1' })
    expect(cls).toEqual({ id: 'class-1', name: '3학년 2반', kind: 'class', boardCount: 6 })
  })
})

describe('listClassesForAdmin', () => {
  it('is_super면 전체 수업 + 미배정 수업 가상 항목을 생성일 최신순으로 반환한다', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'class-1', name: '3학년 2반', created_at: '2026-07-27T00:00:00.000Z' }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const classes = await listClassesForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(classes).toEqual([
      { id: 'class-1', name: '3학년 2반', kind: 'class', boardCount: 6, createdAt: '2026-07-27T00:00:00.000Z' },
      { id: 'unassigned', name: UNASSIGNED_CLASS, kind: 'class', boardCount: 6 },
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

    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(classes).toEqual([
      { id: 'class-2', name: '최근 수업', kind: 'class', boardCount: 6, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'class-1', name: '오래된 수업', kind: 'class', boardCount: 6, createdAt: '2026-07-01T00:00:00.000Z' },
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

describe('createClass kind', () => {
  function mockInsert() {
    const mockClassSingle = vi.fn().mockResolvedValue({ data: { id: 'c', name: 'n', kind: 'official' }, error: null })
    const mockClassInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockClassSingle }) })
    mockFrom.mockImplementation(table => {
      if (table === 'classes') return { insert: mockClassInsert }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })
    return mockClassInsert
  }

  it("kind가 'official'이면 그대로 저장한다", async () => {
    const insert = mockInsert()
    await createClass('2026 시즌1', 'admin-1', 'official')
    expect(insert).toHaveBeenCalledWith({ name: '2026 시즌1', created_by: 'admin-1', kind: 'official', board_count: 6 })
  })

  it("알 수 없는 kind는 'class'로 저장한다", async () => {
    const insert = mockInsert()
    await createClass('x', 'admin-1', 'weird')
    expect(insert).toHaveBeenCalledWith({ name: 'x', created_by: 'admin-1', kind: 'class', board_count: 6 })
  })

  it('진행 방식 5판을 저장하고, 알 수 없는 값은 6판으로 저장한다', async () => {
    const insert = mockInsert()
    await createClass('5판 게임', 'admin-1', 'class', 5)
    expect(insert).toHaveBeenCalledWith({ name: '5판 게임', created_by: 'admin-1', kind: 'class', board_count: 5 })
    await createClass('이상한 값', 'admin-1', 'class', 7)
    expect(insert).toHaveBeenLastCalledWith({ name: '이상한 값', created_by: 'admin-1', kind: 'class', board_count: 6 })
  })
})

describe('getClassInfo', () => {
  function mockLookup(result) {
    const maybeSingle = vi.fn().mockResolvedValue(result)
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })
    return eq
  }

  it('대회면 kind와 이름을 돌려준다', async () => {
    const eq = mockLookup({ data: { name: '2026 시즌1', kind: 'official' }, error: null })
    expect(await getClassInfo('class-1')).toEqual({ kind: 'official', name: '2026 시즌1', boardCount: 6 })
    expect(eq).toHaveBeenCalledWith('id', 'class-1')
  })

  it('5판 게임이면 boardCount 5를 돌려준다', async () => {
    mockLookup({ data: { name: '5판 수업', kind: 'class', board_count: 5 }, error: null })
    expect(await getClassInfo('class-5')).toEqual({ kind: 'class', name: '5판 수업', boardCount: 5 })
  })

  it('미배정이거나 classId가 없으면 DB를 보지 않고 일반 수업으로 본다', async () => {
    expect(await getClassInfo('unassigned')).toEqual({ kind: 'class', name: null, boardCount: 6 })
    expect(await getClassInfo(null)).toEqual({ kind: 'class', name: null, boardCount: 6 })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('없는 수업이나 uuid 형식이 아닌 id(22P02)는 일반 수업으로 본다', async () => {
    mockLookup({ data: null, error: null })
    expect(await getClassInfo('missing')).toEqual({ kind: 'class', name: null, boardCount: 6 })
    mockLookup({ data: null, error: { code: '22P02' } })
    expect(await getClassInfo('not-a-uuid')).toEqual({ kind: 'class', name: null, boardCount: 6 })
  })
})

describe('listOfficialContests', () => {
  it('대회만 최신순으로 돌려준다', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'c2', name: '시즌2', created_at: '2026-11-02T00:00:00.000Z' }],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })

    expect(await listOfficialContests()).toEqual([{ id: 'c2', name: '시즌2', boardCount: 6, createdAt: '2026-11-02T00:00:00.000Z' }])
    expect(eq).toHaveBeenCalledWith('kind', 'official')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
