import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import TeamCodeInput from './TeamCodeInput'

describe('TeamCodeInput', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('팀 코드 입력 필드와 다음 버튼을 렌더링한다', () => {
    render(<MemoryRouter><TeamCodeInput /></MemoryRouter>)
    expect(screen.getByPlaceholderText('예) A3F9C1')).toBeInTheDocument()
    expect(screen.getByText('다음 →')).toBeInTheDocument()
  })

  it('코드를 입력하면 대문자로 바뀐다', () => {
    render(<MemoryRouter><TeamCodeInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) A3F9C1'), { target: { value: 'a3f9c1' } })
    expect(screen.getByPlaceholderText('예) A3F9C1')).toHaveValue('A3F9C1')
  })

  it('코드 입력 후 다음을 누르면 /join?code=...로 이동한다', () => {
    render(<MemoryRouter><TeamCodeInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) A3F9C1'), { target: { value: 'a3f9c1' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/join?code=A3F9C1')
  })

  it('코드가 비어있으면 이동하지 않는다', () => {
    render(<MemoryRouter><TeamCodeInput /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
