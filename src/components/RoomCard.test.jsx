import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RoomCard from './RoomCard'

const BASE_PROPS = { hostName: '철수', status: 'live', characters: ['Adventurer-강아지', 'Guardian-판다'], onClick: () => {} }

describe('RoomCard', () => {
  it('방장 닉네임을 "OO님의 방" 형태로 제목에 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} />)
    expect(screen.getByText('철수님의 방')).toBeInTheDocument()
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
    fireEvent.click(screen.getByText('철수님의 방'))
    expect(onClick).toHaveBeenCalled()
  })

  it('title이 있으면(관리자가 만든 방) hostName 대신 title을 그대로 보여준다', () => {
    render(<RoomCard {...BASE_PROPS} title="TEAM 1" />)
    expect(screen.getByText('TEAM 1')).toBeInTheDocument()
    expect(screen.queryByText('철수님의 방')).toBeNull()
  })

  it('title이 빈 문자열이면(관리자가 이름을 아직 정하지 않은 방) hostName 기반 표시로 폴백한다', () => {
    render(<RoomCard {...BASE_PROPS} title="" />)
    expect(screen.getByText('철수님의 방')).toBeInTheDocument()
  })
})
