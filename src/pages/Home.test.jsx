import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()
const mockNavigate = vi.fn()
const mockEmit = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../hooks/useSocket', () => ({
  default: () => ({ socket: { emit: mockEmit }, isConnected: true })
}))

import Home from './Home'

describe('Home', () => {
  beforeEach(() => vi.clearAllMocks())

  it('팀 생성, 팀 참가 버튼을 렌더링한다', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByText('팀 만들기')).toBeInTheDocument()
    expect(screen.getByText('팀 참여')).toBeInTheDocument()
  })

  it('팀 참가 클릭 시 CodeModal이 열린다', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    fireEvent.click(screen.getByText('팀 참여'))
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })

  it('팀 생성 클릭 시 POST /api/rooms를 호출한다', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 'ABC123' }) })
    mockEmit.mockImplementation((_event, _data, cb) => cb?.({ ok: true }))
    render(<MemoryRouter><Home /></MemoryRouter>)
    fireEvent.click(screen.getByText('팀 만들기'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('URL에 code가 있으면 CodeModal이 자동으로 열린다', () => {
    render(
      <MemoryRouter initialEntries={['/team?name=철수&character=c1&code=ABC123']}>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })
})
