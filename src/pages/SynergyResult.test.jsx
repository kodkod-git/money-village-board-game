import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ECONOMIC_TYPES_URL } from '../constants/quizData'
import { SYNERGY_TYPES, ACADEMY_INQUIRY_URL } from '../constants/synergyData'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import SynergyResult from './SynergyResult'

function renderResult(url = '/synergy/FASN/result?me=FAEC&name=민수&friend=지우') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/synergy/:citizenType/result" element={<SynergyResult />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SynergyResult', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    global.navigator.clipboard = { writeText: vi.fn() }
    delete window.Kakao
  })

  it('나의 경제적 성향과 대표 동물을 보여준다', () => {
    renderResult()
    expect(screen.getByText('민수의 경제적 성향은')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FAEC' })).toBeInTheDocument()
    expect(screen.getByText('차분한 돌봄형 리더')).toBeInTheDocument()
    expect(screen.getByText('대표 동물 : 수달')).toBeInTheDocument()
  })

  it('시민권자와의 시너지 지수를 보여준다', () => {
    renderResult()
    expect(screen.getByText('민수 × 지우 시너지')).toBeInTheDocument()
    expect(screen.getByText('FAEC × FASN')).toBeInTheDocument()
    expect(screen.getByTestId('synergy-strength')).toHaveTextContent('80')
    expect(screen.getByTestId('synergy-complement')).toHaveTextContent('80')
  })

  it('이동 버튼이 유형 상세, 경제 유형, 수업 문의 링크로 연결된다', () => {
    renderResult()
    expect(screen.getByText('나의 경제 유형 자세히 보기')).toHaveAttribute('href', SYNERGY_TYPES.FAEC.detailUrl)
    expect(screen.getByText('다양한 경제 유형 알아보기')).toHaveAttribute('href', ECONOMIC_TYPES_URL)
    expect(screen.getByText('초등 경제 수업 문의하기')).toHaveAttribute('href', ACADEMY_INQUIRY_URL)
  })

  it('링크 공유하기를 누르면 현재 URL을 복사한다', () => {
    renderResult()
    fireEvent.click(screen.getByLabelText('링크 공유하기'))
    expect(global.navigator.clipboard.writeText).toHaveBeenCalled()
    expect(screen.getByText('링크가 복사됐어요')).toBeInTheDocument()
  })

  it('다시 하기를 누르면 같은 시민권 테스트로 돌아간다', () => {
    renderResult()
    fireEvent.click(screen.getByText('다시 하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/synergy/FASN')
  })

  it('유형 코드가 잘못되면 오류 문구를 보여준다', () => {
    renderResult('/synergy/FASN/result?me=ZZZZ')
    expect(screen.getByText('결과를 불러오지 못했어요.')).toBeInTheDocument()
  })
})

describe('SynergyResult 배경', () => {
  it('내 그룹을 왼편, 시민권자 그룹을 오른편으로 하는 배경을 보여준다', () => {
    renderResult('/synergy/PTEN/result?me=PASC&name=a&friend=b')
    expect(screen.getByAltText('PASC × PTEN 시너지 배경')).toHaveAttribute('src', '/synergy/green_red.png')
  })
})

describe('SynergyResult 다시 하기 버튼', () => {
  it('내 결과 그룹 색으로 칠해진다', () => {
    renderResult('/synergy/FASN/result?me=PTEN&name=a&friend=b')
    expect(screen.getByText('다시 하기')).toHaveStyle({ background: '#F26D6D' })
  })
})
