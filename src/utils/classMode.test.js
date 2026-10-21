import { describe, it, expect, vi } from 'vitest'
import { fetchClassMode } from './classMode'

describe('fetchClassMode', () => {
  it('수업 모드를 조회한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: 'competition' }) })
    expect(await fetchClassMode('class-1')).toBe('competition')
    expect(fetch).toHaveBeenCalledWith('/api/classes/class-1/mode')
  })

  it('classId가 없거나, 응답이 이상하거나, 요청이 실패하면 normal', async () => {
    global.fetch = vi.fn()
    expect(await fetchClassMode('')).toBe('normal')
    expect(fetch).not.toHaveBeenCalled()

    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await fetchClassMode('class-1')).toBe('normal')

    global.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchClassMode('class-1')).toBe('normal')
  })
})
