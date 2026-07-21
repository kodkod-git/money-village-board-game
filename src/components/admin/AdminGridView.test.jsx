import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminGridView from './AdminGridView'

const rooms = [
  {
    code: 'AB1234',
    registered: false,
    players: [{ character: 'Adventurer-강아지', name: '김민준' }],
  },
  {
    code: 'GH3456',
    registered: true,
    players: [
      { character: 'Innovator-코끼리', name: '이서연' },
      { character: 'Planner-개미', name: '박도윤' },
      { character: 'Guardian-캥거루', name: '최하은' },
      { character: 'Adventurer-원숭이', name: '정서준' },
    ],
  },
]

describe('AdminGridView', () => {
  it('does not show team codes inside room cards', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)

    expect(screen.queryByText('AB1234')).not.toBeInTheDocument()
    expect(screen.queryByText('GH3456')).not.toBeInTheDocument()
  })

  it('shows player names in each room card', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)

    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('박도윤')).toBeInTheDocument()
    expect(screen.getByText('최하은')).toBeInTheDocument()
    expect(screen.getByText('정서준')).toBeInTheDocument()
  })

  it('uses four fixed player slots per room card', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)

    const firstCard = screen.getByRole('button', { name: /김민준/ })
    expect(within(firstCard).getAllByTestId('admin-player-slot')).toHaveLength(4)
  })

  it('opens registered room cards too', async () => {
    const handleSpectate = vi.fn()
    render(<AdminGridView rooms={rooms} onSpectate={handleSpectate} />)

    await userEvent.click(screen.getByRole('button', { name: /이서연/ }))

    expect(handleSpectate).toHaveBeenCalledWith(rooms[1])
  })

  it('stale 상태 방에는 정체 배지를 보여준다', () => {
    const staleRooms = [{
      code: 'AB1234', registered: false, status: 'stale',
      players: [{ character: 'Adventurer-강아지', name: '김민준' }],
    }]
    render(<AdminGridView rooms={staleRooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  it('abandoned 상태 방에는 방치 배지를 보여준다', () => {
    const abandonedRooms = [{
      code: 'AB1234', registered: false, status: 'abandoned',
      players: [{ character: 'Adventurer-강아지', name: '김민준' }],
    }]
    render(<AdminGridView rooms={abandonedRooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('방치')).toBeInTheDocument()
  })

  it('completed-but-unregistered 상태 방에는 등록 대기 배지를 보여준다', () => {
    const unregisteredRooms = [{
      code: 'AB1234', registered: false, status: 'completed-but-unregistered',
      players: [{ character: 'Adventurer-강아지', name: '김민준' }],
    }]
    render(<AdminGridView rooms={unregisteredRooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('등록 대기')).toBeInTheDocument()
  })

  it('live 상태 방에는 상태 배지를 보여주지 않는다', () => {
    const liveRooms = [{
      code: 'AB1234', registered: false, status: 'live',
      players: [{ character: 'Adventurer-강아지', name: '김민준' }],
    }]
    render(<AdminGridView rooms={liveRooms} onSpectate={vi.fn()} />)
    expect(screen.queryByText('정체')).not.toBeInTheDocument()
    expect(screen.queryByText('방치')).not.toBeInTheDocument()
    expect(screen.queryByText('등록 대기')).not.toBeInTheDocument()
  })
})
