import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RoomCard from './RoomCard'

const BASE_PROPS = { teamNumber: 3, status: 'live', characters: ['Adventurer-강아지', 'Guardian-판다'], onClick: () => {} }

describe('RoomCard', () => {
  it('제목을 "OO님의 방"이 아니라 팀 번호("팀 N")로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getByText('팀 3')).toBeInTheDocument()
    expect(screen.queryByText(/님의 방/)).toBeNull()
  })

  it('참여한 캐릭터만큼 이미지를 왼쪽부터 렌더링한다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', '/characters/Adventurer-강아지.png')
    expect(images[1]).toHaveAttribute('src', '/characters/Guardian-판다.png')
  })

  it('빈 자리는 항상 4자리를 채우도록 물음표 플레이스홀더로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getAllByText('?')).toHaveLength(2)
  })

  it('아무도 없으면 4자리 모두 플레이스홀더다', () => {
    render(<RoomCard {...BASE_PROPS} characters={[]} />)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getAllByText('?')).toHaveLength(4)
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
    fireEvent.click(screen.getByText('팀 3'))
    expect(onClick).toHaveBeenCalled()
  })

  it('title이 있으면(관리자가 이름을 정한 방) 팀 번호 대신 title을 그대로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} title="TEAM 1" />)
    expect(screen.getByText('TEAM 1')).toBeInTheDocument()
    expect(screen.queryByText('팀 3')).toBeNull()
  })

  it('title이 빈 문자열이면 팀 번호로 폴백한다', () => {
    render(<RoomCard {...BASE_PROPS} title="" />)
    expect(screen.getByText('팀 3')).toBeInTheDocument()
  })

  it('title·번호가 모두 없으면 "새 팀"으로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} teamNumber={null} />)
    expect(screen.getByText('새 팀')).toBeInTheDocument()
  })
})
