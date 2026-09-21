import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizPlay from './QuizPlay'
import { QUESTIONS } from '../constants/quizData'

function answerAllQuestions() {
  // 안내 슬라이드
  fireEvent.click(screen.getByText('다음 문제'))
  // 이름
  fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
  fireEvent.click(screen.getByText('다음'))
  // 성별 — 선택 후 다음 버튼으로 확정
  fireEvent.click(screen.getByRole('button', { name: /남자아이/ }))
  fireEvent.click(screen.getByText('다음'))
  // 나이
  fireEvent.change(screen.getByPlaceholderText('예: 10'), { target: { value: '7' } })
  fireEvent.click(screen.getByText('다음'))
  // 질문 N개 모두 첫 번째 선택지(today/safety 쪽)를 고르고 다음으로 확정 → Green Group
  for (let i = 0; i < QUESTIONS.length; i++) {
    const buttons = screen.getAllByRole('button').filter(b => b.dataset.quizOption)
    fireEvent.click(buttons[0])
    fireEvent.click(screen.getByText('다음'))
  }
}

describe('QuizPlay', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'result-1' }) })
  })

  it('안내 슬라이드를 먼저 보여주고 진행바는 표시하지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    expect(screen.getByText(/우리 아이와 가까운 모습을 선택해주세요/)).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-progress-fill')).not.toBeInTheDocument()
  })

  it('이름을 입력하지 않으면 다음으로 넘어가지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.click(screen.getByText('다음'))
    expect(screen.getByPlaceholderText('예: 이준서')).toBeInTheDocument()
  })

  it(`${QUESTIONS.length}문항을 모두 답하면 결과를 저장하고 결과 페이지로 이동한다`, async () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    answerAllQuestions()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/quiz/results', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/quiz/result/result-1'))

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.childName).toBe('철수')
    expect(body.childGender).toBe('male')
    expect(body.childAge).toBe(7)
    expect(body.resultGroup).toBe('Green Group')
  })

  it('성별을 선택하고 다음 버튼을 눌러야 나이 입력 단계로 넘어간다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음'))

    expect(screen.getByText(/성별을/)).toBeInTheDocument()
    const nextBtn = screen.getByText('다음')
    expect(nextBtn).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /여자아이/ }))
    expect(nextBtn).not.toBeDisabled()
    expect(screen.queryByPlaceholderText('예: 10')).not.toBeInTheDocument()

    fireEvent.click(nextBtn)
    expect(screen.getByPlaceholderText('예: 10')).toBeInTheDocument()
  })

  it('질문 단계에서도 선택 후 다음 버튼을 눌러야 다음 문항으로 넘어간다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 문제'))
    fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음'))
    fireEvent.click(screen.getByRole('button', { name: /남자아이/ }))
    fireEvent.click(screen.getByText('다음'))
    fireEvent.change(screen.getByPlaceholderText('예: 10'), { target: { value: '7' } })
    fireEvent.click(screen.getByText('다음'))

    const firstQuestionText = QUESTIONS[0].prompt
    expect(screen.getByText(firstQuestionText)).toBeInTheDocument()
    const nextBtn = screen.getByText('다음')
    expect(nextBtn).toBeDisabled()

    const options = screen.getAllByRole('button').filter(b => b.dataset.quizOption)
    fireEvent.click(options[0])
    expect(nextBtn).not.toBeDisabled()
    expect(screen.getByText(firstQuestionText)).toBeInTheDocument() // 아직 다음 문항으로 넘어가지 않음

    fireEvent.click(nextBtn)
    expect(screen.getByText(QUESTIONS[1].prompt)).toBeInTheDocument()
  })

  it('진행바는 이름 단계부터 표시되며 "안내" 단계는 세지 않는다', () => {
    render(<MemoryRouter><QuizPlay /></MemoryRouter>)
    const total = QUESTIONS.length + 3

    fireEvent.click(screen.getByText('다음 문제')) // 이름 단계 = 1/total
    const fill = screen.getByTestId('quiz-progress-fill')
    expect(parseFloat(fill.style.width)).toBeCloseTo((1 / total) * 100, 5)

    fireEvent.change(screen.getByPlaceholderText('예: 이준서'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음')) // 성별 단계 = 2/total
    expect(parseFloat(fill.style.width)).toBeCloseTo((2 / total) * 100, 5)
  })
})
