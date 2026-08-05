import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminTableView from './AdminTableView'

const prices = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const blankGameState = {
  job: null,
  cash: null,
  stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
  realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
  badges: [false, false, false, false, false, false],
  isCompleted: false,
}

const rooms = [
  {
    code: 'GH3456',
    prices,
    players: [
      {
        playerUuid: 'p1',
        name: '이서연',
        affiliation: '미래고',
        gameState: {
          ...blankGameState,
          job: 'a',
          cash: 32000,
          stocks: { ...blankGameState.stocks, semiconductor: 2 },
          realEstate: { ...blankGameState.realEstate, gaon: 1 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'p2',
        name: '박도윤',
        affiliation: '미래고',
        gameState: { ...blankGameState, cash: 12000 },
      },
      {
        playerUuid: 'p3',
        name: '최하은',
        affiliation: '미래고',
        gameState: blankGameState,
      },
    ],
  },
]

describe('AdminTableView', () => {
  it('does not render the team code column', () => {
    render(<AdminTableView rooms={rooms} />)

    expect(screen.queryByRole('columnheader', { name: '팀코드' })).not.toBeInTheDocument()
    expect(screen.queryByText('GH3456')).not.toBeInTheDocument()
  })

  it('shows completed player assets and status', () => {
    render(<AdminTableView rooms={rooms} />)

    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('32,000원')).toBeInTheDocument()
    expect(screen.getByText('10,000원')).toBeInTheDocument()
    expect(screen.getByText('4,000원')).toBeInTheDocument()
    expect(screen.getByText('46,000원')).toBeInTheDocument()
    expect(screen.getByText('✅ 입력완료')).toBeInTheDocument()
  })

  it('shows in-progress and not-started statuses', () => {
    render(<AdminTableView rooms={rooms} />)

    expect(screen.getByText('🟡 입력중')).toBeInTheDocument()
    expect(screen.getByText('❌ 미입력')).toBeInTheDocument()
  })

  it('연결 컬럼에 연결 끊김 여부를 표시한다', () => {
    const disconnectedRooms = [{
      code: 'GH3456', prices,
      players: [
        { playerUuid: 'p1', name: '이서연', affiliation: '', gameState: blankGameState, connected: false },
        { playerUuid: 'p2', name: '박도윤', affiliation: '', gameState: blankGameState, connected: true },
      ],
    }]
    render(<AdminTableView rooms={disconnectedRooms} />)
    expect(screen.getByText('연결')).toBeInTheDocument()
    expect(screen.getByText('🔴 연결 끊김')).toBeInTheDocument()
    expect(screen.getByText('🟢 연결됨')).toBeInTheDocument()
  })

  it('방 상태 컬럼에 정체/등록 완료를 표시한다', () => {
    const mixedRooms = [
      {
        code: 'A1', registered: false, status: 'stale', prices,
        players: [{ playerUuid: 'x1', name: '가나다', affiliation: '', gameState: blankGameState }],
      },
      {
        code: 'A2', registered: true, prices,
        players: [{ playerUuid: 'x2', name: '라마바', affiliation: '', gameState: blankGameState }],
      },
    ]
    render(<AdminTableView rooms={mixedRooms} />)
    expect(screen.getByText('방 상태')).toBeInTheDocument()
    expect(screen.getByText('정체')).toBeInTheDocument()
    expect(screen.getByText('등록 완료')).toBeInTheDocument()
  })
})
