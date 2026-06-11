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

  it('isHost가 false이면 참가완료를 표시한다', () => {
    render(<PlayerSlot player={{ name: '영희', character: 'pasc', isHost: false }} />)
    expect(screen.getByText('참가완료')).toBeInTheDocument()
  })
})
