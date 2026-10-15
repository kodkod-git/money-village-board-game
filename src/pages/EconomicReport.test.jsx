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

const PRICES = {
  stockPrices: { bio: 10000, semiconductor: 10000, finance: 10000 },
  realEstatePrices: { dami: 10000, gaon: 10000, chorong: 10000 },
}

// 홍길동: 현금 50,000 + 투자 60,000 → 투자 비율 약 55%, 바이오가 투자 금액의 절반(30,000)
const RESULT = {
  teamCode: 'AB1234',
  createdAt: '2026-10-06T05:00:00.000Z',
  ...PRICES,
  players: [
    ME,
    { name: '김철수', playerUuid: 'p2', cash: 100000, stockHoldings: { finance: 1 }, realEstateHoldings: {} },
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
  global.fetch = vi.fn(url => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(RESULT),
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

  it('다른 플레이어 통계 없이 내 자산만으로 유형을 정한다', async () => {
    renderReport()
    await userEvent.type(await screen.findByLabelText('숫자'), '11')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    // 투자 비율 55%(70% 이하) → 현재형, 한 종목(바이오)이 투자 금액의 50% → 위험형(Red)
    expect(global.fetch).not.toHaveBeenCalledWith('/api/rankings')
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

describe('EconomicReport 그룹 카드', () => {
  it('기존 보고서의 그룹 특징·대표 동물·대표 인물·경제적 특징 카드를 내 그룹 기준으로 보여준다', async () => {
    sessionStorage.setItem('player_uuid', 'me')
    renderReport()
    await userEvent.type(await screen.findByLabelText('숫자'), '11')
    await userEvent.click(screen.getByRole('button', { name: '보고서 보기' }))

    // 현재형·위험형 → Red Group
    expect(screen.getByText('[오늘을 가꾸며 모험을 즐기는 그룹]')).toBeInTheDocument()
    const picked = [...document.querySelectorAll('[aria-current]')].map(el => el.textContent)
    expect(picked).toEqual(['✓Present(오늘 가꾸기)', '✓Risk-Tolerant(모험 즐기기)'])

    expect(screen.getByRole('img', { name: '원숭이' })).toHaveAttribute('src', '/groups_report/red-animal-1.png')
    expect(screen.getByText('PTEC')).toBeInTheDocument()

    expect(screen.getByText('월트 디즈니')).toBeInTheDocument()
    expect(screen.getByText('월트 디즈니의 EFTI : PTSN')).toBeInTheDocument()

    expect(screen.getByText('[홍길동님의 경제적 특징]')).toBeInTheDocument()
    expect(screen.getByText('즐거움과 호기심을 바탕으로 적극적으로 움직여요.')).toBeInTheDocument()

    expect(screen.queryByText('자산 요약')).not.toBeInTheDocument()
  })

  it('?player=로 지정하면 이 기기에 내 기록이 없어도 그 플레이어의 보고서를 보여준다', async () => {
    sessionStorage.setItem('player_uuid', 'lost-device')
    render(
      <MemoryRouter initialEntries={['/result/session-1/report?player=p2']}>
        <Routes>
          <Route path="/result/:sessionId/report" element={<EconomicReport />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('김철수님은 몇 살인가요?')).toBeInTheDocument()
  })
})
