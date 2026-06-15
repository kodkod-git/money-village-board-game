import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerSlot from './PlayerSlot'

describe('PlayerSlot', () => {
  it('참가한 플레이어의 이름과 캐릭터를 표시한다', () => {
    render(<PlayerSlot player={{ name: '철수', character: 'ptsc', isHost: true }} />)
    expect(screen.getByText('철수')).toBeInTheDocument()
    expect(screen.getByText('방장 ★')).toBeInTheDocument()
    expect(screen.getByAltText('ptsc')).toBeInTheDocument()
  })

  it('player가 null이면 대기 중... 을 표시한다', () => {
    render(<PlayerSlot player={null} />)
    expect(screen.getByText('대기 중...')).toBeInTheDocument()
  })

  it('isHost가 false이고 미완료면 상태 뱃지가 없다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false }} />)
    expect(screen.getByText('영희')).toBeInTheDocument()
    expect(screen.queryByText('참가완료')).toBeNull()
  })

  it('입력완료 시 입력완료 뱃지를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false, gameState: { isCompleted: true } }} />)
    expect(screen.getByText('입력완료')).toBeInTheDocument()
  })
})
