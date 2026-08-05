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

  it('게임 참여 버튼 클릭 시 /join-code로 이동한다', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    await userEvent.click(screen.getByText('게임 참여'))
    expect(mockNavigate).toHaveBeenCalledWith('/join-code')
  })
})
