import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminGridView from './AdminGridView'

const rooms = [
  {
    code: 'AB1234', registered: false,
    players: [{ character: 'Adventurer-강아지', name: '홍길동' }],
  },
  {
    code: 'GH3456', registered: true,
    players: [
      { character: 'Innovator-돌고래', name: '오세훈' },
      { character: 'Planner-개미', name: '한소희' },
      { character: 'Guardian-캥거루', name: '장하늘' },
      { character: 'Adventurer-원숭이', name: '윤서준' },
    ],
  },
]

describe('AdminGridView', () => {
  it('각 방의 팀 코드를 표시한다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('AB1234')).toBeInTheDocument()
    expect(screen.getByText('GH3456')).toBeInTheDocument()
  })

  it('등록완료 방에는 "등록 완료" 배지를 표시한다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.getByText('등록 완료')).toBeInTheDocument()
  })

  it('진행중 방 카드를 클릭하면 onSpectate가 해당 방 데이터로 호출된다', async () => {
    const handleSpectate = vi.fn()
    render(<AdminGridView rooms={rooms} onSpectate={handleSpectate} />)
    await userEvent.click(screen.getByText('AB1234'))
    expect(handleSpectate).toHaveBeenCalledWith(rooms[0])
  })

  it('등록완료 방 카드는 클릭해도 onSpectate가 호출되지 않는다', async () => {
    const handleSpectate = vi.fn()
    render(<AdminGridView rooms={rooms} onSpectate={handleSpectate} />)
    await userEvent.click(screen.getByText('GH3456'))
    expect(handleSpectate).not.toHaveBeenCalled()
  })

  it('빈 슬롯은 물음표를 표시한다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)
    expect(screen.getAllByText('?')).toHaveLength(3)
  })
})
