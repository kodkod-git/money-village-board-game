import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PlayerSlot from './PlayerSlot'

describe('PlayerSlot', () => {
  it('참가한 플레이어의 이름과 캐릭터를 표시한다', () => {
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: true }} />)
    expect(screen.getByText('철수')).toBeInTheDocument()
    expect(screen.getByAltText('ptsc')).toBeInTheDocument()
  })

  it('player가 null이면 대기중을 표시한다', () => {
    render(<PlayerSlot player={null} />)
    expect(screen.getByText('대기중')).toBeInTheDocument()
  })

  it('isHost가 false이고 미완료면 상태 뱃지가 없다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false }} />)
    expect(screen.getByText('영희')).toBeInTheDocument()
    expect(screen.queryByText('참가완료')).toBeNull()
  })

  it('입력완료 시 입력완료 뱃지를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, gameState: { isCompleted: true } }} />)
    expect(screen.getByLabelText('입력완료')).toBeInTheDocument()
  })

  it('connected가 false면 재접속 중 뱃지를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, connected: false }} />)
    expect(screen.getByText('재접속 중')).toBeInTheDocument()
  })

  it('connected가 true(기본)면 재접속 중 뱃지를 표시하지 않는다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, connected: true }} />)
    expect(screen.queryByText('재접속 중')).toBeNull()
  })

  it('onKick이 전달되면 추방 버튼을 표시한다', () => {
    const onKick = vi.fn()
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: false }} onKick={onKick} />)
    expect(screen.getByRole('button', { name: '추방' })).toBeInTheDocument()
  })

  it('onKick이 없으면 추방 버튼을 표시하지 않는다', () => {
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: false }} />)
    expect(screen.queryByRole('button', { name: '추방' })).toBeNull()
  })

  it('추방 버튼 클릭 시 onKick을 호출한다', async () => {
    const onKick = vi.fn()
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: false }} onKick={onKick} />)
    await userEvent.click(screen.getByRole('button', { name: '추방' }))
    expect(onKick).toHaveBeenCalledOnce()
  })
})
