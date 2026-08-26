import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizPlay from './QuizPlay'

function answerAllQuestions() {
  // 안내 슬라이드
  fireEvent.click(screen.getByText('다음 문제'))
  // 이름
  fireEvent.change(screen.getByPlaceholderText('텍스트를 입력해 주세요.'), { target: { value: '철수' } })
  fireEvent.click(screen.getByText('다음 문제'))
  // 나이
  fireEvent.change(screen.getByPlaceholderText('숫자를 입력해 주세요.'), { target: { value: '7' } })
  fireEvent.click(screen.getByText('다음 문제'))
  // 6문항 모두 첫 번째 선택지(today/safety 쪽)를 고른다 → Green Group
  for (let i = 0; i < 6; i++) {
    const buttons = screen.getAllByRole('button').filter(b => b.dataset.quizOption)
    fireEvent.click(buttons[0])
  }
}

describe('QuizPlay', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'result-1' }) })
  })

  it('안내 슬라이드를 먼저 보여준다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    expect(screen.getByText(/우리 아이와 가까운 모습을 선택해주세요/)).toBeInTheDocument()
  })

  it('이름을 입력하지 않으면 다음으로 넘어가지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.click(screen.getByText('다음 문제'))
    expect(screen.getByPlaceholderText('텍스트를 입력해 주세요.')).toBeInTheDocument()
  })

  it('6문항을 모두 답하면 결과를 저장하고 결과 페이지로 이동한다', async () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    answerAllQuestions()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/quiz/results', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/quiz/result/result-1'))

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.childName).toBe('철수')
    expect(body.childAge).toBe(7)
    expect(body.resultGroup).toBe('Green Group')
  })

  it('진행바가 현재 단계에 맞는 너비로 표시된다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    const fill = screen.getByTestId('quiz-progress-fill')
    expect(parseFloat(fill.style.width)).toBeCloseTo((1 / 9) * 100, 5)

    fireEvent.click(screen.getByText('다음 문제'))
    expect(parseFloat(fill.style.width)).toBeCloseTo((2 / 9) * 100, 5)
  })
})
