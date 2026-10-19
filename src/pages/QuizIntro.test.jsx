import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizIntro from './QuizIntro'

// 행동 로그는 별도 요청이라 fetch 목과 섞이지 않게 모듈째 대체한다.
vi.mock('../utils/surveyTracking', () => ({
  trackSurveyEvent: vi.fn(),
  markSurveyStart: vi.fn(),
  takeSurveyDuration: vi.fn(() => 42000),
}))
import { trackSurveyEvent, markSurveyStart } from '../utils/surveyTracking'
import { QUESTIONS } from '../constants/quizData'

describe('QuizIntro', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('들어오면 잠재력 테스트 참여(visit) 로그를 남긴다', () => {
    trackSurveyEvent.mockClear()
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(trackSurveyEvent).toHaveBeenCalledWith('potential', 'visit')
  })

  it('제목과 시작 버튼을 렌더링한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(screen.getByText('우리 아이')).toBeInTheDocument()
    expect(screen.getByText('경제 잠재력 테스트')).toBeInTheDocument()
    expect(screen.getByText('테스트 시작하기')).toBeInTheDocument()
  })

  it('실제 질문 개수를 메타 정보에 표시한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    expect(screen.getByText(`${QUESTIONS.length}가지 질문`)).toBeInTheDocument()
  })

  it('시작 버튼을 누르면 /quiz/play로 이동한다', () => {
    render(<MemoryRouter><QuizIntro /></MemoryRouter>)
    fireEvent.click(screen.getByText('테스트 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz/play')
  })
})
