import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultPage from './ResultPage'

const mockSession = {
  stockPrices: { semiconductor: 10000, finance: 8000, industrial: 6000, auto: 7000, bio: 9000, content: 5000 },
  realEstatePrices: { gaon: 50000, nuri: 60000, dami: 40000, maru: 45000, chorong: 80000, hani: 75000 },
  players: [
    {
      rank: 1,
      name: '홍길동',
      affiliation: '경영학과',
      character: 'fox',
      job: 'a',
      cash: 30000,
      stockHoldings: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstateHoldings: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, true, false, false, false],
      totalAssets: 230000,
      playerUuid: 'uuid-1',
    },
  ],
}

function renderWithRoute(sessionId = 'sess-1', playerUuid = 'uuid-1') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockSession),
  })
  return render(
    <MemoryRouter initialEntries={[`/result/${sessionId}/player/${playerUuid}`]}>
      <Routes>
        <Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResultPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('플레이어 이름과 소속을 렌더링한다', async () => {
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument())
    expect(screen.getByText('경영학과')).toBeInTheDocument()
  })

  it('총 자산을 렌더링한다', async () => {
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('230,000원')).toBeInTheDocument())
  })

  it('획득한 성공카드 이미지만 렌더링한다', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('홍길동'))
    const imgs = screen.getAllByRole('img').filter(img => img.getAttribute('src')?.includes('/badges/success/'))
    expect(imgs).toHaveLength(2)
    expect(imgs[0].alt).toBe('communication')
    expect(imgs[1].alt).toBe('idea')
  })

  it('부동산 소계를 헤더에 표시한다', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('홍길동'))
    // gaon 1개 × 50000 = 50,000원
    expect(screen.getByText('50,000원')).toBeInTheDocument()
  })

  it('fetch 실패 시 에러 메시지를 표시한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    render(
      <MemoryRouter initialEntries={['/result/bad/player/bad']}>
        <Routes>
          <Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('결과를 불러올 수 없습니다.')).toBeInTheDocument())
  })
})
