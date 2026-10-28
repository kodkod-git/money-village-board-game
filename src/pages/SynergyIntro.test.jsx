import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import SynergyIntro from './SynergyIntro'

vi.mock('../utils/surveyTracking', () => ({
  trackSurveyEvent: vi.fn(),
  markSurveyStart: vi.fn(),
  takeSurveyDuration: vi.fn(() => 42000),
}))
import { trackSurveyEvent } from '../utils/surveyTracking'

function renderIntro(citizenType = 'PTEN') {
  return render(
    <MemoryRouter initialEntries={[`/synergy/${citizenType}`]}>
      <Routes>
        <Route path="/synergy/:citizenType" element={<SynergyIntro />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SynergyIntro', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    trackSurveyEvent.mockClear()
    global.navigator.clipboard = { writeText: vi.fn() }
    delete window.Kakao
  })

  it('제목에 시민권자 유형을, 이미지로 시민권자 대표 동물을 보여준다', () => {
    renderIntro('pten')
    expect(screen.getByRole('heading')).toHaveTextContent('경제적 성향 시너지 테스트PTEN')
    expect(screen.getByText('시민권자 친구와 나의 경제 시너지는?')).toBeInTheDocument()
    expect(screen.getByAltText('시민권자의 대표 동물 강아지')).toHaveAttribute('src', '/characters/Adventurer-강아지.png')
  })

  it('들어오면 참여 로그를 남기고, 테스트 시작하기를 누르면 테스트 화면으로 간다', () => {
    renderIntro()
    expect(trackSurveyEvent).toHaveBeenCalledWith('synergy', 'visit')
    fireEvent.click(screen.getByText('테스트 시작하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/synergy/PTEN/play')
  })

  it('링크를 복사하고, 카카오 키가 없으면 준비 중이라고 알려준다', () => {
    renderIntro()
    fireEvent.click(screen.getByLabelText('링크 공유하기'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href)
    expect(screen.getByRole('status')).toHaveTextContent('링크가 복사됐어요')
    fireEvent.click(screen.getByLabelText('카카오톡 공유하기'))
    expect(screen.getByRole('status')).toHaveTextContent('카카오톡 공유는 준비 중이에요')
  })

  it('잘못된 시민권 링크는 안내만 하고 참여로 세지 않는다', () => {
    renderIntro('ZZZZ')
    expect(screen.getByText('올바르지 않은 시민권 링크예요.')).toBeInTheDocument()
    expect(trackSurveyEvent).not.toHaveBeenCalled()
  })
})
