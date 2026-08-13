import { render, screen } from '@testing-library/react'
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
    ],
  },
]

describe('AdminGridView', () => {
  it('각 방을 카드로 렌더링해 팀코드와 참여자를 보여준다', () => {
    render(<AdminGridView rooms={rooms} onSpectate={vi.fn()} />)

    expect(screen.getByText('AB1234')).toBeInTheDocument()
    expect(screen.getByText('GH3456')).toBeInTheDocument()
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('박도윤')).toBeInTheDocument()
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
})
