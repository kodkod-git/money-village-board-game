import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import Home from './Home'

describe('Home', () => {
  beforeEach(() => vi.clearAllMocks())

  it('팀 만들기, 팀 참가 버튼을 렌더링한다', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByText('팀 만들기')).toBeInTheDocument()
    expect(screen.getByText('팀 참가')).toBeInTheDocument()
  })

  it('팀 참가 클릭 시 CodeModal이 열린다', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    fireEvent.click(screen.getByText('팀 참가'))
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })

  it('팀 만들기 클릭 시 POST /api/rooms를 호출한다', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 'ABC123' }) })
    render(<MemoryRouter><Home /></MemoryRouter>)
    fireEvent.click(screen.getByText('팀 만들기'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('QR URL(/join?code=)로 접근 시 /name으로 자동 이동한다', () => {
    render(
      <MemoryRouter initialEntries={['/join?code=ABC123']}>
        <Home />
      </MemoryRouter>
    )
    expect(mockNavigate).toHaveBeenCalledWith('/name?code=ABC123')
  })
})
