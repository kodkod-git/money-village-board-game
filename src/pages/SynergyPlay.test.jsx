import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import SynergyPlay from './SynergyPlay'

function renderPlay(citizenType = 'FASN') {
  return render(
    <MemoryRouter initialEntries={[`/synergy/${citizenType}`]}>
      <Routes>
        <Route path="/synergy/:citizenType" element={<SynergyPlay />} />
      </Routes>
    </MemoryRouter>
  )
}

function enterName(value) {
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value } })
  fireEvent.click(screen.getByText('다음'))
}

function answer(text) {
  fireEvent.click(screen.getByText(text))
  fireEvent.click(screen.getByText('다음'))
}

describe('SynergyPlay', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('닉네임 2개와 질문 4개에 답하면 유형 코드와 닉네임을 담아 결과 화면으로 이동한다', () => {
    renderPlay('fasn')
    expect(screen.getByText('1/6')).toBeInTheDocument()
    enterName('민수')
    expect(screen.getByText('2/6')).toBeInTheDocument()
    enterName('지우')
    answer('앞으로의 일을 생각해 일부를 남겨 둔다.')
    answer('안정적 결과를 얻을 수 있는 선택을 한다.')
    answer('친구들이 원하는 물건을 먼저 들어본다.')
    answer('기준을 비교해 보고 결정한다.')
    expect(screen.getByText('결과 분석중')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(600))
    expect(mockNavigate).toHaveBeenCalledWith('/synergy/FASN/result?me=FAEC&name=%EB%AF%BC%EC%88%98&friend=%EC%A7%80%EC%9A%B0')
  })

  it('닉네임이 비어 있으면 다음으로 넘어갈 수 없다', () => {
    renderPlay()
    expect(screen.getByText('다음')).toBeDisabled()
  })

  it('16가지 유형이 아닌 링크면 안내 문구를 보여준다', () => {
    renderPlay('ABCD')
    expect(screen.getByText('올바르지 않은 시민권 링크예요.')).toBeInTheDocument()
  })
})
