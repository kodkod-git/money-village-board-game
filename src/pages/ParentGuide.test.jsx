import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentGuide from './ParentGuide'

// 예시 안내문(Blue) 숫자: 현금 10만 + 주식 2종목 15만 + 부동산 25만, 성공열쇠 5개(직업 없음).
const RESULT = {
  createdAt: '2026-10-21T03:00:00.000Z',
  stockPrices: { semiconductor: 10000, finance: 10000, bio: 10000 },
  realEstatePrices: { gaon: 10000, dami: 10000, chorong: 10000 },
  players: [
    {
      name: '김민준', playerUuid: 'p1', cash: 100000,
      stockHoldings: { semiconductor: 10, bio: 5 }, realEstateHoldings: { chorong: 25 },
      badges: [true, true, false, true, true, true],
    },
    { name: '이서연', playerUuid: 'p2', cash: 300000, stockHoldings: {}, realEstateHoldings: {}, badges: [] },
  ],
}

function renderGuide(path = '/result/session-1/guide?player=p1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/result/:sessionId/guide" element={<ParentGuide />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(RESULT) }))
})

describe('ParentGuide', () => {
  it('?player로 고른 학생의 이름과 수업일을 채운다', async () => {
    renderGuide()
    expect(await screen.findByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('2026년 10월 21일')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/results/session-1')
  })

  it('게임 결과를 예시와 같은 형식으로 정산해 보여준다', async () => {
    renderGuide()
    await screen.findByText('김민준')
    expect(screen.getByText('주식 2종목 (끝났을 때 가격)')).toBeInTheDocument()
    expect(screen.getByText('성공열쇠 5개 × 1.5')).toBeInTheDocument()
    expect(screen.getByText('+ 25만원')).toBeInTheDocument()
    expect(screen.getByText('75만원')).toBeInTheDocument()
    expect(screen.getByText('성공열쇠 5개를 모았어요')).toBeInTheDocument()
    const bar = screen.getByTestId('split-bar')
    expect(within(bar).getByText('20%')).toBeInTheDocument()
    expect(within(bar).getByText('주식 30%')).toBeInTheDocument()
    expect(within(bar).getByText('부동산 50%')).toBeInTheDocument()
  })

  it('학생의 경제적 잠재력 그룹을 배너·4분면·문장으로 보여준다', async () => {
    renderGuide()
    await screen.findByText('김민준')
    expect(screen.getByAltText('나의 경제적 잠재력은 Blue Group')).toHaveAttribute('src', '/guide/banner-blue.jpg')
    expect(screen.getByText('Blue', { selector: '[aria-current="true"]' })).toBeInTheDocument()
    expect(screen.getByText('마음에 든 부동산 한 곳에 크게 투자했어요.')).toBeInTheDocument()
    expect(screen.getByText('도전성')).toBeInTheDocument()
  })

  it('다른 학생을 고르면 그 학생의 결과로 바뀐다', async () => {
    renderGuide('/result/session-1/guide?player=p2')
    expect(await screen.findByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('Green Group')).toBeInTheDocument()
    expect(screen.getAllByText('없음')).toHaveLength(2)
    expect(screen.queryByText('김민준')).toBeNull()
  })

  it('없는 학생이면 안내 문구를 보여준다', async () => {
    renderGuide('/result/session-1/guide?player=nobody')
    expect(await screen.findByText('이 학생의 게임 결과를 찾을 수 없어요.')).toBeInTheDocument()
  })
})
