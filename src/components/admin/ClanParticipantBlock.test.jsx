import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ClanParticipantBlock from './ClanParticipantBlock'
import { CLAN_MEMBER_DRAG_TYPE } from '../../constants/clan'

const P = [{ resultId: 'r1', name: '홍길동', character: 'Adventurer-강아지', teamName: 'AB1234' }]

function dropEvent(resultId) {
  return { dataTransfer: { getData: type => (type === CLAN_MEMBER_DRAG_TYPE ? resultId : '') } }
}

describe('ClanParticipantBlock', () => {
  it('참여자 이름·팀 이름·인원 수를 보여준다', () => {
    render(<ClanParticipantBlock participants={P} onDropMember={vi.fn()} />)
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('AB1234')).toBeInTheDocument()
    expect(screen.getByText('1명')).toBeInTheDocument()
  })

  it('비어 있으면 안내 문구를 보여준다', () => {
    render(<ClanParticipantBlock participants={[]} onDropMember={vi.fn()} />)
    expect(screen.getByText('결과 등록을 마친 참여자가 여기에 표시돼요')).toBeInTheDocument()
  })

  it('클랜 멤버를 놓으면 onDropMember(resultId)를 부르고, 이미 블럭에 있는 참여자면 부르지 않는다', () => {
    const onDropMember = vi.fn()
    render(<ClanParticipantBlock participants={P} onDropMember={onDropMember} />)
    const block = screen.getByRole('region', { name: '참여자' })
    fireEvent.drop(block, dropEvent('r9'))
    fireEvent.drop(block, dropEvent('r1'))
    expect(onDropMember).toHaveBeenCalledTimes(1)
    expect(onDropMember).toHaveBeenCalledWith('r9')
  })

  it('카드를 끌면 resultId를 담는다', () => {
    render(<ClanParticipantBlock participants={P} onDropMember={vi.fn()} />)
    const setData = vi.fn()
    fireEvent.dragStart(screen.getByText('홍길동').closest('li'), { dataTransfer: { setData } })
    expect(setData).toHaveBeenCalledWith(CLAN_MEMBER_DRAG_TYPE, 'r1')
  })
})
