import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CompetitionPoolBlock from './CompetitionPoolBlock'

const PLAYERS = [
  { playerUuid: 'p1', name: '철수', character: 'Innovator-사자', connected: true, gameState: { isCompleted: false } },
  { playerUuid: 'p2', name: '영희', character: 'Adventurer-강아지', connected: true, gameState: { isCompleted: true } },
  { playerUuid: 'p3', name: '민수', character: 'Adventurer-강아지', connected: false, gameState: { isCompleted: true } },
]

describe('CompetitionPoolBlock', () => {
  it('대기 중인 참여자의 캐릭터·이름·상태를 보여준다', () => {
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={vi.fn()} onDelete={vi.fn()} />)
    const block = screen.getByRole('region', { name: '참여자' })
    expect(within(block).getByText('3명 대기 중')).toBeInTheDocument()
    const items = within(block).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('철수입력 중')
    expect(items[1]).toHaveTextContent('영희입력 완료')
    expect(items[2]).toHaveTextContent('민수연결 끊김')
    expect(within(items[0]).getByRole('img')).toHaveAttribute('src', '/characters/Innovator-사자.png')
  })

  it('비어 있으면 안내 문구를 보여준다', () => {
    render(<CompetitionPoolBlock players={[]} onAssign={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('QR로 들어온 참여자가 여기에 표시돼요')).toBeInTheDocument()
  })

  it('삭제 버튼을 누르면 그 참여자로 onDelete를 부른다', async () => {
    const onDelete = vi.fn()
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: '영희 삭제' }))
    expect(onDelete).toHaveBeenCalledWith(PLAYERS[1])
  })

  it('참여자 카드를 끌면 playerUuid를 싣는다', () => {
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={vi.fn()} onDelete={vi.fn()} />)
    const item = screen.getAllByRole('listitem')[0]
    expect(item).toHaveAttribute('draggable', 'true')
    const setData = vi.fn()
    fireEvent.dragStart(item, { dataTransfer: { setData } })
    expect(setData).toHaveBeenCalledWith('text/plain', 'p1')
  })

  it('팀에서 끌어온 플레이어를 놓으면 배정을 취소한다(toRoomCode null)', () => {
    const onAssign = vi.fn()
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={onAssign} onDelete={vi.fn()} />)
    fireEvent.drop(screen.getByRole('region', { name: '참여자' }), { dataTransfer: { getData: () => 'p7' } })
    expect(onAssign).toHaveBeenCalledWith('p7', null)
  })

  it('이미 명단에 있는 플레이어를 다시 놓으면 아무것도 하지 않는다', () => {
    const onAssign = vi.fn()
    render(<CompetitionPoolBlock players={PLAYERS} onAssign={onAssign} onDelete={vi.fn()} />)
    fireEvent.drop(screen.getByRole('region', { name: '참여자' }), { dataTransfer: { getData: () => 'p1' } })
    expect(onAssign).not.toHaveBeenCalled()
  })
})
