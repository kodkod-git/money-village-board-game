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
  it('관리자 버튼 클릭 시 /admin으로 이동한다', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    await userEvent.click(screen.getByText('관리자'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin')
  })

  it('시작하기 버튼 클릭 시 /join-code로 이동한다', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    await userEvent.click(screen.getByText('시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/join-code')
  })

  it('관전자 버튼은 비활성화되어 있다', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText('관전자').closest('button')).toBeDisabled()
  })
})
