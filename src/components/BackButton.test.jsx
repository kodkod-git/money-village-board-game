import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import BackButton from './BackButton'

describe('BackButton', () => {
  it('<를 렌더링한다', () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument()
  })

  it('클릭 시 navigate(-1)을 호출한다', async () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
