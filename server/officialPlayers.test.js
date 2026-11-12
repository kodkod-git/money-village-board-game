// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { normalizeRealName, createOfficialPlayer, resolveOfficialPlayer, getOfficialPlayer } from './officialPlayers.js'

// select().eq().eq().maybeSingle() 체인과 insert().select().single() 체인을 흉내 낸다.
function mockTable({ found = null, insertResult = { data: { id: 'new-id' }, error: null } } = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: found, error: null })
  const eq2 = vi.fn().mockReturnValue({ maybeSingle })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, maybeSingle })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  const insertSingle = vi.fn().mockResolvedValue(insertResult)
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: insertSingle }) })
  mockFrom.mockImplementation(table => {
    if (table !== 'official_players') throw new Error(`unexpected table: ${table}`)
    return { select, insert }
  })
  return { select, insert, eq1, eq2, maybeSingle }
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('normalizeRealName', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeRealName('  박병윤 ')).toBe('박병윤')
    expect(normalizeRealName(undefined)).toBe('')
  })
})

describe('resolveOfficialPlayer', () => {
  it('같은 이름이 없으면 새로 만들고 id를 돌려준다', async () => {
    const { insert } = mockTable({ found: null })
    const result = await resolveOfficialPlayer({ classId: 'c1', contestName: '2026 시즌1', realName: ' 박병윤 ' })
    expect(insert).toHaveBeenCalledWith({ class_id: 'c1', real_name: '박병윤' })
    expect(result).toEqual({ officialPlayerId: 'new-id' })
  })

  it('같은 이름이 있고 confirm이 없으면 확인 문구만 돌려주고 만들지 않는다', async () => {
    const { insert } = mockTable({ found: { id: 'old-id', class_id: 'c1', real_name: '박병윤' } })
    const result = await resolveOfficialPlayer({ classId: 'c1', contestName: '2026 시즌1', realName: '박병윤' })
    expect(result).toEqual({ exists: true, label: '박병윤 (2026 시즌1)' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('같은 이름이 있고 confirm이면 기존 id를 돌려준다', async () => {
    mockTable({ found: { id: 'old-id', class_id: 'c1', real_name: '박병윤' } })
    const result = await resolveOfficialPlayer({ classId: 'c1', contestName: '2026 시즌1', realName: '박병윤', confirm: true })
    expect(result).toEqual({ officialPlayerId: 'old-id' })
  })

  it('이름이 비어 있으면 에러를 던진다', async () => {
    await expect(resolveOfficialPlayer({ classId: 'c1', contestName: 'x', realName: '  ' })).rejects.toThrow('realName is required')
  })
})

describe('createOfficialPlayer', () => {
  it('동시에 만들어져 unique 위반(23505)이 나면 기존 행을 다시 찾아 돌려준다', async () => {
    const { maybeSingle } = mockTable({ insertResult: { data: null, error: { code: '23505' } } })
    maybeSingle.mockResolvedValueOnce({ data: { id: 'raced-id' }, error: null })
    expect(await createOfficialPlayer('c1', '박병윤')).toEqual({ id: 'raced-id' })
  })
})

describe('getOfficialPlayer', () => {
  it('id로 조회한다', async () => {
    const { eq1, maybeSingle } = mockTable()
    maybeSingle.mockResolvedValueOnce({ data: { id: 'p1', class_id: 'c1', real_name: '박병윤' }, error: null })
    expect(await getOfficialPlayer('p1')).toEqual({ id: 'p1', class_id: 'c1', real_name: '박병윤' })
    expect(eq1).toHaveBeenCalledWith('id', 'p1')
  })
})
