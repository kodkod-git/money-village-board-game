import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminTableView from './AdminTableView'

const prices = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const blankGameState = {
  job: null,
  cash: null,
  stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
  realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
  badges: [false, false, false, false, false, false],
  isCompleted: false,
}

const rooms = [
  {
    code: 'GH3456',
    prices,
    players: [
      {
        playerUuid: 'p1',
        name: '이서연',
        affiliation: '미래고',
        gameState: {
          ...blankGameState,
          job: 'a',
          cash: 32000,
          stocks: { ...blankGameState.stocks, semiconductor: 2 },
          realEstate: { ...blankGameState.realEstate, gaon: 1 },
          badges: [true, true, false, false, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'p2',
        name: '박도윤',
        affiliation: '미래고',
        gameState: { ...blankGameState, cash: 12000 },
      },
      {
        playerUuid: 'p3',
        name: '최하은',
        affiliation: '미래고',
        gameState: blankGameState,
      },
    ],
  },
]

describe('AdminTableView', () => {
  it('does not render the team code column', () => {
    render(<AdminTableView rooms={rooms} />)

    expect(screen.queryByRole('columnheader', { name: '팀코드' })).not.toBeInTheDocument()
    expect(screen.queryByText('GH3456')).not.toBeInTheDocument()
  })

  it('shows completed player assets and status', () => {
    render(<AdminTableView rooms={rooms} />)

    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('32,000원')).toBeInTheDocument()
    expect(screen.getByText('10,000원')).toBeInTheDocument()
    expect(screen.getByText('4,000원')).toBeInTheDocument()
    expect(screen.getByText('46,000원')).toBeInTheDocument()
    expect(screen.getByText('입력 완료')).toBeInTheDocument()
  })

  it('shows in-progress and not-started statuses', () => {
    render(<AdminTableView rooms={rooms} />)

    expect(screen.getByText('진행중')).toBeInTheDocument()
    expect(screen.getByText('미등록')).toBeInTheDocument()
  })

  it('무직(jobVisited만 true)이어도 진행중으로 표시한다', () => {
    const rooms2 = [{
      code: 'AA0000', prices,
      players: [{
        playerUuid: 'x', name: '무직이', affiliation: '미래고',
        gameState: { ...blankGameState, job: null, jobVisited: true },
      }],
    }]
    render(<AdminTableView rooms={rooms2} />)
    expect(screen.getByText('진행중')).toBeInTheDocument()
    expect(screen.queryByText('미등록')).not.toBeInTheDocument()
  })

  it('참가자 아바타와 소속을 함께 보여준다', () => {
    render(<AdminTableView rooms={rooms} />)
    const avatar = screen.getAllByAltText('')[0]
    expect(avatar).toHaveAttribute('src', expect.stringContaining('/characters/'))
    expect(screen.getAllByText('미래고').length).toBeGreaterThan(0)
  })

  it('행 체크박스를 선택하고 선택 삭제 확인 시 onDeletePlayers를 호출한다', async () => {
    const onDeletePlayers = vi.fn().mockResolvedValue()
    render(<AdminTableView rooms={rooms} onDeletePlayers={onDeletePlayers} />)

    await userEvent.click(screen.getByRole('checkbox', { name: '이서연 선택' }))
    await userEvent.click(screen.getByText('선택 삭제'))
    expect(onDeletePlayers).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('예'))

    expect(onDeletePlayers).toHaveBeenCalledWith([{ roomCode: 'GH3456', playerUuid: 'p1' }])
  })

  it('상태 헤더를 두 번 클릭하면 정렬 순서가 반대로 바뀐다', async () => {
    render(<AdminTableView rooms={rooms} />)
    const rowsBefore = screen.getAllByRole('row').slice(1).map(r => r.textContent)
    await userEvent.click(screen.getByText('상태'))
    await userEvent.click(screen.getByText('상태'))
    const rowsAfter = screen.getAllByRole('row').slice(1).map(r => r.textContent)
    expect(rowsAfter).not.toEqual(rowsBefore)
  })
})
