import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('톱니바퀴 버튼 클릭 시 /admin으로 이동한다', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    await userEvent.click(screen.getByLabelText('관리자 모드'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin')
  })

  it('참여하기 버튼이 더 이상 없다', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.queryByText('참여하기')).toBeNull()
  })

  it('QR 스캔 안내 문구를 보여준다', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText('선생님이 보여주는 QR 코드를 스캔해 참여해주세요')).toBeInTheDocument()
  })
})
