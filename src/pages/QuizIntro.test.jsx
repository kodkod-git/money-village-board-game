import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizIntro from './QuizIntro'

describe('QuizIntro', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('제목과 시작 버튼을 렌더링한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(screen.getByText('우리 아이 경제 잠재력(색깔편)')).toBeInTheDocument()
    expect(screen.getByText('테스트 시작하기')).toBeInTheDocument()
  })

  it('시작 버튼을 누르면 /quiz/play로 이동한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    fireEvent.click(screen.getByText('테스트 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz/play')
  })
})
