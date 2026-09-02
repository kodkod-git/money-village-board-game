import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { toast, dismissToast, subscribeToasts, getToasts, _resetToasts } from './toast'

describe('toast store', () => {
  beforeEach(() => {
    _resetToasts()
    vi.useRealTimers()
  })

  afterEach(() => {
    _resetToasts()
    vi.useRealTimers()
  })

  it('toast()를 호출하면 메시지가 목록에 추가된다', () => {
    toast('저장됐어요')
    expect(getToasts().map(t => t.message)).toEqual(['저장됐어요'])
  })

  it('여러 번 호출하면 순서대로 쌓이고 각기 다른 id를 가진다', () => {
    toast('첫 번째')
    toast('두 번째')
    const items = getToasts()
    expect(items.map(t => t.message)).toEqual(['첫 번째', '두 번째'])
    expect(items[0].id).not.toBe(items[1].id)
  })

  it('구독자는 목록이 바뀔 때마다 최신 목록을 통보받는다', () => {
    const listener = vi.fn()
    subscribeToasts(listener)
    toast('알림')
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ message: '알림' }),
    ]))
  })

  it('구독 해지 후에는 통보받지 않는다', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToasts(listener)
    unsubscribe()
    toast('알림')
    expect(listener).not.toHaveBeenCalled()
  })

  it('dismissToast(id)를 호출하면 해당 토스트만 사라진다', () => {
    const id = toast('사라질 것')
    toast('남을 것')
    dismissToast(id)
    expect(getToasts().map(t => t.message)).toEqual(['남을 것'])
  })

  it('duration이 지나면 자동으로 사라진다', () => {
    vi.useFakeTimers()
    toast('잠깐 알림', { duration: 3000 })
    expect(getToasts()).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(getToasts()).toHaveLength(0)
  })

  it('duration: 0이면 자동으로 사라지지 않는다', () => {
    vi.useFakeTimers()
    toast('계속 있는 알림', { duration: 0 })
    vi.advanceTimersByTime(100000)
    expect(getToasts()).toHaveLength(1)
  })
})
