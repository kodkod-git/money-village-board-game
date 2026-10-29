import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClanCard from './ClanCard'
import { CLAN_MEMBER_DRAG_TYPE } from '../../constants/clan'

const m = (id, name) => ({ resultId: id, name, character: 'Adventurer-강아지', teamName: 'T' })
const clan = (count) => ({
  id: 'k1', name: '팀 1',
  members: Array.from({ length: count }, (_, i) => m(`r${i + 1}`, `학생${i + 1}`)),
})

function renderCard(c, props = {}) {
  const handlers = { onDropMember: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), ...props }
  render(<ClanCard clan={c} {...handlers} />)
  return handlers
}

describe('ClanCard', () => {
  it('4명 이하면 모두 보이고 빈 자리는 빈 슬롯으로 채운다', () => {
    renderCard(clan(3))
    expect(screen.getAllByText(/^학생\d$/)).toHaveLength(3)
    expect(screen.getAllByTestId('empty-slot')).toHaveLength(1)
    expect(screen.getByText('3명')).toBeInTheDocument()
    expect(screen.queryByText(/^외 /)).not.toBeInTheDocument()
  })

  it('5명 이상이면 4명만 보이고 "외 N명"으로 펼치고 접는다', async () => {
    renderCard(clan(6))
    expect(screen.getAllByText(/^학생\d$/)).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: '외 2명' }))
    expect(screen.getAllByText(/^학생\d$/)).toHaveLength(6)
    await userEvent.click(screen.getByRole('button', { name: '접기' }))
    expect(screen.getAllByText(/^학생\d$/)).toHaveLength(4)
  })

  it('이름을 눌러 고치고 Enter로 저장한다(앞뒤 공백 제거)', async () => {
    const { onRename } = renderCard(clan(0))
    await userEvent.click(screen.getByRole('button', { name: '팀 1 이름 바꾸기' }))
    const input = screen.getByRole('textbox', { name: '팀 이름' })
    await userEvent.clear(input)
    await userEvent.type(input, ' 호랑이반 {Enter}')
    expect(onRename).toHaveBeenCalledWith('k1', '호랑이반')
  })

  it('Esc는 취소하고, 빈 이름이나 같은 이름은 저장하지 않는다', async () => {
    const { onRename } = renderCard(clan(0))
    await userEvent.click(screen.getByRole('button', { name: '팀 1 이름 바꾸기' }))
    await userEvent.type(screen.getByRole('textbox', { name: '팀 이름' }), '바뀜{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '팀 1 이름 바꾸기' }))
    await userEvent.clear(screen.getByRole('textbox', { name: '팀 이름' }))
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: '팀 1 이름 바꾸기' }))
    await userEvent.keyboard('{Enter}')
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '팀 1 이름 바꾸기' })).toBeInTheDocument()
  })

  it('삭제 버튼은 onDelete(clan)을 부른다', async () => {
    const c = clan(1)
    const { onDelete } = renderCard(c)
    await userEvent.click(screen.getByRole('button', { name: '팀 1 삭제' }))
    expect(onDelete).toHaveBeenCalledWith(c)
  })

  it('다른 곳의 참여자를 놓으면 onDropMember(resultId, clanId), 자기 멤버면 무시', () => {
    const { onDropMember } = renderCard(clan(1))
    const card = screen.getByRole('region', { name: '팀 1' })
    const drop = id => fireEvent.drop(card, { dataTransfer: { getData: t => (t === CLAN_MEMBER_DRAG_TYPE ? id : '') } })
    drop('r1')
    drop('r9')
    expect(onDropMember).toHaveBeenCalledTimes(1)
    expect(onDropMember).toHaveBeenCalledWith('r9', 'k1')
  })
})
