import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerAssetReceipt from './PlayerAssetReceipt'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makePlayer(overrides = {}) {
  return {
    playerUuid: 'p1', name: '김민준', character: 'Innovator-사자',
    gameState: {
      cash: 125000, job: 'a', jobVisited: true,
      stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, false, false, false, false],
      ...overrides,
    },
  }
}

describe('PlayerAssetReceipt', () => {
  it('이름·직업·현금·보유 자산·총자산을 보여준다', () => {
    render(<PlayerAssetReceipt player={makePlayer()} prices={PRICES} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getAllByText('경영·금융').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('125,000원')).toBeInTheDocument()
    expect(screen.getByTestId('receipt-p1-real-estate-gaon')).toHaveTextContent('1개')
    expect(screen.getByTestId('receipt-p1-stock-semiconductor')).toHaveTextContent('2주')
    // cash 125000 + stock 4000 + realEstate 10000 = 139000; badgeCount 1 → 0-2 bracket → ×1 = 139,000원
    expect(screen.getByText('139,000원')).toBeInTheDocument()
  })

  it('보유·입력이 없으면 미보유/미입력/무직으로 표시한다', () => {
    const player = makePlayer({
      job: null, jobVisited: true,
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
    })
    render(<PlayerAssetReceipt player={player} prices={PRICES} />)
    expect(screen.getAllByText('미보유')).toHaveLength(2)
    expect(screen.getByText('미입력')).toBeInTheDocument()
    expect(screen.getAllByText('무직').length).toBeGreaterThanOrEqual(1)
  })
})
