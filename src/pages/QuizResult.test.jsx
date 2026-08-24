import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import QuizResult from './QuizResult'

function renderResult(id = 'result-1') {
  return render(
    <MemoryRouter initialEntries={[`/quiz/result/${id}`]}>
      <Routes>
        <Route path="/quiz/result/:resultId" element={<QuizResult />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('QuizResult', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'result-1', child_name: '철수', result_group: 'Green Group',
        axis_today_tomorrow: 'today', axis_safety_adventure: 'safety',
      }),
    })
    global.navigator.clipboard = { writeText: vi.fn() }
  })

  it('결과 그룹명과 태그라인을 렌더링한다', async () => {
    renderResult()
    await waitFor(() => expect(screen.getByText('Green Group')).toBeInTheDocument())
    expect(screen.getByText('[오늘을 가꾸며 안정을 추구하는 그룹]')).toBeInTheDocument()
  })

  it('공유하기를 누르면 현재 URL을 클립보드에 복사한다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('결과 공유하기'))
    expect(global.navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('다시 하기를 누르면 /quiz로 이동한다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('다시 하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz')
  })
})
