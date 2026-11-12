import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import useOfficialNameResolve from './useOfficialNameResolve'

beforeEach(() => { global.fetch = vi.fn() })

function reply(body) {
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) })
}

describe('useOfficialNameResolve', () => {
  it('같은 이름이 없으면 submit이 id를 돌려준다', async () => {
    reply({ officialPlayerId: 'op1' })
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    let id
    await act(async () => { id = await result.current.submit('박병윤') })
    expect(id).toBe('op1')
    expect(result.current.confirmLabel).toBeNull()
  })

  it('같은 이름이 있으면 확인 문구를 세우고, confirm하면 id를 돌려준다', async () => {
    reply({ exists: true, label: '박병윤 (2026 시즌1)' })
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    await act(async () => { await result.current.submit('박병윤') })
    expect(result.current.confirmLabel).toBe('박병윤 (2026 시즌1)')

    reply({ officialPlayerId: 'op-old' })
    let id
    await act(async () => { id = await result.current.confirm() })
    expect(id).toBe('op-old')
    expect(global.fetch).toHaveBeenLastCalledWith('/api/contests/c1/players/resolve', expect.objectContaining({
      body: JSON.stringify({ realName: '박병윤', confirm: true }),
    }))
  })

  it('reject하면 확인 문구를 닫고 중복 안내를 켠다', async () => {
    reply({ exists: true, label: '박병윤 (2026 시즌1)' })
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    await act(async () => { await result.current.submit('박병윤') })
    act(() => result.current.reject())
    expect(result.current.confirmLabel).toBeNull()
    expect(result.current.duplicateNotice).toBe(true)
  })

  it('요청이 실패하면 오류 문구를 세우고 null을 돌려준다', async () => {
    global.fetch.mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useOfficialNameResolve('c1'))
    let id
    await act(async () => { id = await result.current.submit('박병윤') })
    expect(id).toBeNull()
    expect(result.current.error).toBe('참가자 확인 중 오류가 발생했어요. 다시 시도해 주세요.')
  })
})
