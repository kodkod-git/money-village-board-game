import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GROUP_DETAIL_URLS, ECONOMIC_TYPES_URL, NAVER_REVIEW_URL, RESULT_GROUPS } from '../constants/quizData'

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
    delete window.Kakao
  })

  it('결과 그룹명과 태그라인을 렌더링한다', async () => {
    renderResult()
    await waitFor(() => expect(screen.getByText('Green Group')).toBeInTheDocument())
    expect(screen.getByText('[오늘을 가꾸며 안정을 추구하는 그룹]')).toBeInTheDocument()
  })

  it('링크 공유하기를 누르면 현재 URL을 클립보드에 복사하고 안내 문구를 보여준다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('링크 공유하기'))
    expect(global.navigator.clipboard.writeText).toHaveBeenCalled()
    expect(screen.getByText('링크가 복사됐어요')).toBeInTheDocument()
  })

  it('다시 하기를 누르면 /quiz로 이동한다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('다시 하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/quiz')
  })

  it('이동 버튼 3개가 올바른 링크로 새 탭에 열린다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))

    const detailLink = screen.getByText('우리 아이 경제 그룹 자세히 보기')
    expect(detailLink).toHaveAttribute('href', GROUP_DETAIL_URLS['Green Group'])
    expect(detailLink).toHaveAttribute('target', '_blank')

    const typesLink = screen.getByText('다양한 경제 유형 알아보기')
    expect(typesLink).toHaveAttribute('href', ECONOMIC_TYPES_URL)
    expect(typesLink).toHaveAttribute('target', '_blank')

    const reviewLink = screen.getByText('네이버 리뷰 작성하기')
    expect(reviewLink).toHaveAttribute('href', NAVER_REVIEW_URL)
    expect(reviewLink).toHaveAttribute('target', '_blank')
  })

  it('사진 공유하기는 그룹 일러스트를 다운로드하는 링크다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    const photoLink = screen.getByText('사진 공유하기')
    expect(photoLink).toHaveAttribute('href', RESULT_GROUPS['Green Group'].illustration)
    expect(photoLink).toHaveAttribute('download')
  })

  it('카카오 키가 없으면 카카오톡 공유하기 클릭 시 준비 중 안내를 보여준다', async () => {
    renderResult()
    await waitFor(() => screen.getByText('Green Group'))
    fireEvent.click(screen.getByText('카카오톡 공유하기'))
    expect(screen.getByText('카카오톡 공유는 준비 중이에요')).toBeInTheDocument()
  })
})
