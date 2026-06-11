import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn(), off: vi.fn(), emit: vi.fn(),
    disconnect: vi.fn(), connected: true, id: 'mock-id',
  }
  return { io: vi.fn(() => socket) }
})

import useSocket from './useSocket'

describe('useSocket', () => {
  it('socket과 isConnected를 반환한다', () => {
    const { result } = renderHook(() => useSocket())
    expect(result.current.socket).toBeDefined()
    expect(result.current.isConnected).toBe(true)
  })
})
