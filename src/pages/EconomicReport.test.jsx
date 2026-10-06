import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EconomicReport from './EconomicReport'

const RESULT = {
  teamCode: 'AB1234',
  createdAt: '2026-10-06T05:00:00.000Z',
  players: [
    { name: '홍길동', playerUuid: 'me', stockHoldings: { bio: 3, semiconductor: 1 }, realEstateHoldings: { dami: 1, gaon: 1 } },
    { name: '김철수', playerUuid: 'p2', stockHoldings: { finance: 1 }, realEstateHoldings: {} },
  ],
}

function renderReport() {
  return render(
    <MemoryRouter initialEntries={['/result/session-1/report']}>
      <Routes>
        <Route path="/result/:sessionId/report" element={<EconomicReport />} />
        <Route path="/result/:sessionId" element={<div>결과 화면</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('player_uuid', 'me')
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(RESULT) }))
})

describe('EconomicReport', () => {
  it('출생년도를 고르기 전에는 보고서 보기 버튼이 비활성화된다', async () => {
    renderReport()
    expect(await screen.findByText('홍길동님은 몇 년생인가요?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '보고서 보기' })).toBeDisabled()
  })

  it('출생년도를 고르면 이름·나이·날짜·기관명·프로그램과 유형이 담긴 보고서를 보여준다', async () => {
    renderReport()
    await userEvent.selectOptions(await screen.findByLabelText('출생년도'), '2015')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    expect(screen.getByRole('heading', { name: '경제 잠재력 보고서' })).toBeInTheDocument()
    expect(screen.getAllByText('한동대학교 · 머니빌리지 보드게임')).toHaveLength(1)
    expect(screen.getByText('11세 (2015년생)')).toBeInTheDocument()
    expect(screen.getByText('2026년 10월 6일')).toBeInTheDocument()
    expect(screen.getAllByText('홍길동').length).toBeGreaterThan(0)
    // 보유 6개 > 평균 3.5개, 빌라·바이오 4/6 → 미래·위험(Blue)
    expect(screen.getByText('미래형 · 위험형')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blue Group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF로 저장' })).toBeInTheDocument()
  })

  it('이 게임에 내 결과가 없으면 보고서를 볼 수 없다', async () => {
    sessionStorage.setItem('player_uuid', 'stranger')
    renderReport()
    expect(await screen.findByText(/내 게임 결과가 있을 때만/)).toBeInTheDocument()
    expect(screen.queryByLabelText('출생년도')).not.toBeInTheDocument()
  })
})
