// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { createOrg, listOrgsForAdmin, hasOrgAccess, UNASSIGNED_ORG } from './orgs.js'

beforeEach(() => {
  mockFrom.mockReset()
})

describe('createOrg', () => {
  it('org을 생성하고 생성자에게 접근권을 부여한다', async () => {
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-1', name: '경영학과' }, error: null })
    const mockOrgSelect = vi.fn().mockReturnValue({ single: mockOrgSingle })
    const mockOrgInsert = vi.fn().mockReturnValue({ select: mockOrgSelect })
    const mockAccessInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation(table => {
      if (table === 'orgs') return { insert: mockOrgInsert }
      if (table === 'admin_org_access') return { insert: mockAccessInsert }
      throw new Error(`unexpected table: ${table}`)
    })

    const org = await createOrg('  경영학과  ', 'admin-1')

    expect(mockOrgInsert).toHaveBeenCalledWith({ name: '경영학과', created_by: 'admin-1' })
    expect(mockAccessInsert).toHaveBeenCalledWith({ admin_id: 'admin-1', org_id: 'org-1' })
    expect(org).toEqual({ id: 'org-1', name: '경영학과' })
  })
})

describe('listOrgsForAdmin', () => {
  it('is_super면 전체 소속 + 미소속/기타 가상 항목을 반환한다', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'org-1', name: '경영학과' }], error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const orgs = await listOrgsForAdmin({ adminId: 'admin-1', isSuper: true })

    expect(orgs).toEqual([
      { id: 'org-1', name: '경영학과' },
      { id: 'unassigned', name: UNASSIGNED_ORG },
    ])
  })

  it('일반 관리자는 admin_org_access로 연결된 소속만 반환한다', async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [{ orgs: { id: 'org-1', name: '경영학과' } }],
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const orgs = await listOrgsForAdmin({ adminId: 'admin-1', isSuper: false })

    expect(mockEq).toHaveBeenCalledWith('admin_id', 'admin-1')
    expect(orgs).toEqual([{ id: 'org-1', name: '경영학과' }])
  })
})

describe('hasOrgAccess', () => {
  it('is_super면 항상 true를 반환한다', async () => {
    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: true }, '아무 소속')
    expect(result).toBe(true)
  })

  it('일반 관리자는 미소속/기타에 접근할 수 없다', async () => {
    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: false }, UNASSIGNED_ORG)
    expect(result).toBe(false)
  })

  it('접근권이 있으면 true를 반환한다', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: [{ orgs: { name: '경영학과' } }], error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: false }, '경영학과')

    expect(result).toBe(true)
  })

  it('접근권이 없으면 false를 반환한다', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await hasOrgAccess({ adminId: 'admin-1', isSuper: false }, '다른 소속')

    expect(result).toBe(false)
  })
})
