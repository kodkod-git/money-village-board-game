import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminTableView from './AdminTableView'

const prices = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const rooms = [
  {
    code: 'GH3456',
    prices,
    players: [
      {
        playerUuid: 'p1', name: '오세훈', affiliation: '미래고',
        gameState: {
          job: 'a', cash: 32000,
          stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'p2', name: '한소희', affiliation: '미래고',
        gameState: {
          job: null, cash: null,
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [false, false, false, false, false, false],
          isCompleted: false,
        },
      },
    ],
  },
]

describe('AdminTableView', () => {
  it('완료된 플레이어의 자산을 계산해서 표시한다', () => {
    render(<AdminTableView rooms={rooms} />)
    expect(screen.getByText('오세훈')).toBeInTheDocument()
    expect(screen.getByText('32,000원')).toBeInTheDocument()
    expect(screen.getByText('10,000원')).toBeInTheDocument()
    expect(screen.getByText('4,000원')).toBeInTheDocument()
    expect(screen.getByText('46,000원')).toBeInTheDocument()
    expect(screen.getByText('입력완료')).toBeInTheDocument()
  })

  it('미입력 플레이어는 자산 컬럼에 -를 표시한다', () => {
    render(<AdminTableView rooms={rooms} />)
    expect(screen.getByText('한소희')).toBeInTheDocument()
    expect(screen.getByText('미입력')).toBeInTheDocument()
  })
})
