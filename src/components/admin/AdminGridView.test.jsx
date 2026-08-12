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
  it('각 카드 왼쪽 상단에 팀코드를 보여준다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)

    expect(screen.getByText('AB1234')).toBeInTheDocument()
    expect(screen.getByText('GH3456')).toBeInTheDocument()
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

  it('live 상태 방에는 미입력 배지를 보여준다', () => {
    const liveRooms = [{
      code: 'AB1234', registered: false, status: 'live',
      players: [{ character: 'Adventurer-강아지', name: '김민준' }],
    }]
    render(<AdminGridView rooms={liveRooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('미입력')).toBeInTheDocument()
  })

  it('연결이 끊긴 플레이어에는 연결 끊김 표시를 보여준다', () => {
    const disconnectedRooms = [{
      code: 'AB1234', registered: false, status: 'live',
      players: [{ character: 'Adventurer-강아지', name: '김민준', connected: false }],
    }]
    render(<AdminGridView rooms={disconnectedRooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('연결 끊김')).toBeInTheDocument()
  })

  it('연결이 유지된 플레이어에는 연결 끊김 표시를 보여주지 않는다', () => {
    const connectedRooms = [{
      code: 'AB1234', registered: false, status: 'live',
      players: [{ character: 'Adventurer-강아지', name: '김민준', connected: true }],
    }]
    render(<AdminGridView rooms={connectedRooms} onSpectate={vi.fn()} />)
    expect(screen.queryByText('연결 끊김')).not.toBeInTheDocument()
  })

  it('onCreate가 주어지면 방 만들기 카드를 보여준다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText('방 만들기')).toBeInTheDocument()
  })

  it('onCreate가 없으면 방 만들기 카드를 보여주지 않는다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.queryByText('방 만들기')).not.toBeInTheDocument()
  })

  it('방 만들기 카드 클릭 시 onCreate를 호출한다', async () => {
    const onCreate = vi.fn()
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} onCreate={onCreate} />)
    await userEvent.click(screen.getByText('방 만들기'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('room.title이 있으면 카드에 제목을 보여준다', () => {
    const roomsWithTitle = [{ ...rooms[0], title: 'TEAM 1' }]
    render(<AdminGridView rooms={roomsWithTitle} onSpectate={vi.fn()} />)
    expect(screen.getByText('TEAM 1')).toBeInTheDocument()
  })

  it('room.title이 없으면 제목을 보여주지 않는다', () => {
    render(<AdminGridView rooms={[rooms[0]]} onSpectate={vi.fn()} />)
    expect(screen.queryByText(/^TEAM /)).not.toBeInTheDocument()
  })
})
