import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RoomCard from './RoomCard'

const BASE_PROPS = { code: 'A3F9C1', status: 'live', playerCount: 2, characters: ['Adventurer-강아지', 'Guardian-판다'], onClick: () => {} }

describe('RoomCard', () => {
  it('방 코드를 제목으로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getByText('A3F9C1')).toBeInTheDocument()
  })

  it('참여인원을 n/4 형태로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} playerCount={3} />)
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('참여자 수만큼 캐릭터 이미지를 렌더링한다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('상태 뱃지 라벨을 관리자 화면과 동일하게 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} status="stale" />)
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  it('완료 후 미등록 상태 라벨을 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} status="completed-but-unregistered" />)
    expect(screen.getByText('등록 대기')).toBeInTheDocument()
  })

  it('클릭 시 onClick을 호출한다', () => {
    const onClick = vi.fn()
    render(<RoomCard {...BASE_PROPS} onClick={onClick} />)
    fireEvent.click(screen.getByText('A3F9C1'))
    expect(onClick).toHaveBeenCalled()
  })
})
