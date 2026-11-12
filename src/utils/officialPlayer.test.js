import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchEntryKind, resolveOfficialPlayer, rememberOfficialPlayer, getRememberedOfficialPlayers } from './officialPlayer'

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn()
})

describe('fetchEntryKind', () => {
  it('classId가 있으면 수업 종류 API를 부른다', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ kind: 'official', name: '2026 시즌1' }) })
    expect(await fetchEntryKind({ classId: 'c1' })).toEqual({ kind: 'official', name: '2026 시즌1', classId: 'c1' })
    expect(global.fetch).toHaveBeenCalledWith('/api/classes/c1/kind')
  })

  it('code만 있으면 방 종류 API를 부른다', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ kind: 'official', name: '시즌1', classId: 'c9' }) })
    expect(await fetchEntryKind({ code: 'AB12CD' })).toEqual({ kind: 'official', name: '시즌1', classId: 'c9' })
    expect(global.fetch).toHaveBeenCalledWith('/api/rooms/AB12CD/kind')
  })

  it('실패하거나 둘 다 없으면 일반으로 본다', async () => {
    global.fetch.mockRejectedValue(new Error('down'))
    expect(await fetchEntryKind({ classId: 'c1' })).toEqual({ kind: 'class', name: null, classId: 'c1' })
    expect(await fetchEntryKind({})).toEqual({ kind: 'class', name: null, classId: null })
  })
})

describe('resolveOfficialPlayer', () => {
  it('실명과 confirm을 POST하고 응답을 돌려준다', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ officialPlayerId: 'op1' }) })
    expect(await resolveOfficialPlayer('c1', '박병윤', true)).toEqual({ officialPlayerId: 'op1' })
    expect(global.fetch).toHaveBeenCalledWith('/api/contests/c1/players/resolve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ realName: '박병윤', confirm: true }),
    }))
  })

  it('응답이 실패면 에러를 던진다', async () => {
    global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'x' }) })
    await expect(resolveOfficialPlayer('c1', '박병윤')).rejects.toThrow()
  })
})

describe('공식 id 기억', () => {
  it('대회별로 저장하고 읽는다', () => {
    rememberOfficialPlayer('c1', 'op1')
    rememberOfficialPlayer('c2', 'op2')
    expect(getRememberedOfficialPlayers()).toEqual({ c1: 'op1', c2: 'op2' })
  })

  it('저장값이 깨져 있으면 빈 객체를 돌려준다', () => {
    localStorage.setItem('official_player_ids', '{broken')
    expect(getRememberedOfficialPlayers()).toEqual({})
  })
})
