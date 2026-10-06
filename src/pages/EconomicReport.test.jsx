import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EconomicReport from './EconomicReport'

const ME = {
  name: '홍길동', playerUuid: 'me', job: 'a', cash: 50000, stockValue: 30000, realEstateValue: 20000, totalAssets: 110000,
  badges: [false, true, false, true, true, false],
  stockHoldings: { bio: 3, semiconductor: 1 }, realEstateHoldings: { dami: 1, gaon: 1 },
}

const RESULT = {
  teamCode: 'AB1234',
  createdAt: '2026-10-06T05:00:00.000Z',
  players: [
    ME,
    { name: '김철수', playerUuid: 'p2', stockHoldings: { finance: 1 }, realEstateHoldings: {} },
  ],
}

// 역대 전체 플레이어: 홍길동(6개) + 보유 수가 많은 다른 팀 플레이어들 → 평균 8개
const ALL_PLAYERS = [
  ME,
  { name: '부자1', playerUuid: 'x1', stockHoldings: { semiconductor: 9 }, realEstateHoldings: {} },
  { name: '부자2', playerUuid: 'x2', stockHoldings: { finance: 9 }, realEstateHoldings: {} },
]

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
  global.fetch = vi.fn(url => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url === '/api/rankings' ? ALL_PLAYERS : RESULT),
  }))
})

describe('EconomicReport', () => {
  it('나이를 입력하기 전에는 보고서 보기 버튼이 비활성화된다', async () => {
    renderReport()
    expect(await screen.findByText('홍길동님은 몇 살인가요?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '보고서 보기' })).toBeDisabled()
  })

  it('0이나 소수 같은 잘못된 나이로는 넘어갈 수 없다', async () => {
    renderReport()
    const input = await screen.findByLabelText('숫자')
    await userEvent.type(input, '0')
    expect(screen.getByRole('button', { name: '보고서 보기' })).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, '10.5')
    expect(screen.getByRole('button', { name: '보고서 보기' })).toBeDisabled()
  })

  it('나이를 입력하면 이름·나이·날짜·기관명·프로그램과 유형이 담긴 보고서를 보여준다', async () => {
    renderReport()
    await userEvent.type(await screen.findByLabelText('숫자'), '11')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    expect(screen.getByRole('heading', { name: '경제적 잠재력 유형 보고서' })).toBeInTheDocument()
    expect(screen.getByText('한동대학교 · 머니빌리지 보드게임')).toBeInTheDocument()
    expect(screen.getByText('11세')).toBeInTheDocument()
    expect(screen.getByText('2026년 10월 6일')).toBeInTheDocument()
    expect(screen.getAllByText('홍길동').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'PDF로 저장' })).toBeInTheDocument()
  })

  it('미래형/현재형은 같은 팀이 아니라 역대 전체 플레이어 평균과 비교한다', async () => {
    renderReport()
    await userEvent.type(await screen.findByLabelText('숫자'), '11')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    // 팀 평균(3.5개)보다는 많지만 역대 평균(8개)보다 적은 6개 → 현재형, 빌라·바이오 4/6 → 위험형(Red)
    expect(global.fetch).toHaveBeenCalledWith('/api/rankings')
    expect(screen.getByText('현재형 · 위험형')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Red Group' })).toBeInTheDocument()
    expect(screen.queryByText('판단 근거')).not.toBeInTheDocument()
  })

  it('이 게임에 내 결과가 없으면 보고서를 볼 수 없다', async () => {
    sessionStorage.setItem('player_uuid', 'stranger')
    renderReport()
    expect(await screen.findByText(/내 게임 결과가 있을 때만/)).toBeInTheDocument()
    expect(screen.queryByLabelText('숫자')).not.toBeInTheDocument()
  })
})

describe('EconomicReport 자산 요약', () => {
  it('총자산·현금·주식·부동산 비중과 보유 내역, 성공열쇠, 직업을 요약해 보여준다', async () => {
    sessionStorage.setItem('player_uuid', 'me')
    renderReport()
    await userEvent.type(await screen.findByLabelText('숫자'), '11')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    expect(screen.getByText('110,000원')).toBeInTheDocument()
    expect(screen.getByText('현금+주식+부동산 100,000원 × 성공열쇠 1.1배')).toBeInTheDocument()
    expect(screen.getByText('50,000원')).toBeInTheDocument()
    expect(screen.getByText('(50%)')).toBeInTheDocument()
    expect(screen.getByText('반도체 1주 · 금융 0주 · 바이오 3주')).toBeInTheDocument()
    expect(screen.getByText('단독주택 1개 · 빌라 1개 · 아파트 0개')).toBeInTheDocument()
    expect(screen.getByText('3개')).toBeInTheDocument()
    expect(screen.getByText('노동 · 주식 · 부동산')).toBeInTheDocument()
    expect(screen.getByText('경영·금융')).toBeInTheDocument()
  })

  it('예전 결과처럼 평가액이 비어 있으면 보유 수 × 게임 시세로 계산한다', async () => {
    const old = { ...ME, stockValue: null, realEstateValue: null, job: '' }
    global.fetch = vi.fn(url => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url === '/api/rankings' ? [old] : {
        ...RESULT, players: [old],
        stockPrices: { bio: 1000, semiconductor: 2000 }, realEstatePrices: { dami: 7000, gaon: 3000 },
      }),
    }))
    renderReport()
    await userEvent.type(await screen.findByLabelText('숫자'), '11')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    expect(screen.getByText('5,000원')).toBeInTheDocument()
    expect(screen.getByText('10,000원')).toBeInTheDocument()
    expect(screen.getByText('직업 없음')).toBeInTheDocument()
  })
})
