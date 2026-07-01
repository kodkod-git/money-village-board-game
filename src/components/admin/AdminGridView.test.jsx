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
})
