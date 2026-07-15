import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import RankingTable from './RankingTable'

const mockRows = [
  { rank: 1, name: '홍길동', affiliation: '경영학과', teamCode: 'AB1234', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1' },
  { rank: 2, name: '김철수', affiliation: '공학부', teamCode: 'CD5678', character: 'cat', totalAssets: 120000, playerUuid: 'uuid-2' },
]

describe('RankingTable', () => {
  it('등수, 이름, 소속, 팀, 총자산을 렌더링한다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.getByText('1위')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('경영학과 · AB1234')).toBeInTheDocument()
    expect(screen.getByText('150,000원')).toBeInTheDocument()
  })

  it('valueKey를 지정하면 해당 필드 값을 표시한다', () => {
    const boothRows = [
      { rank: 1, name: '정우성', affiliation: '수도고', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, playerUuid: 'uuid-3' },
    ]
    render(<MemoryRouter><RankingTable rows={boothRows} valueKey="stockValue" /></MemoryRouter>)
    expect(screen.getByText('172,000원')).toBeInTheDocument()
  })

  it('highlightPlayerUuid에 해당하는 행을 하단에 pinned row로 렌더링한다', () => {
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} highlightPlayerUuid="uuid-2" />
      </MemoryRouter>
    )
    const pinnedRow = screen.getByTestId('pinned-row')
    expect(pinnedRow).toBeInTheDocument()
    expect(pinnedRow).toHaveTextContent('김철수')
  })

  it('highlightPlayerUuid 없으면 pinned row를 렌더링하지 않는다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.queryByTestId('pinned-row')).toBeNull()
  })

  it('onRowClick이 있을 때 행 클릭 시 해당 row 데이터로 콜백을 호출한다', async () => {
    const handleClick = vi.fn()
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} onRowClick={handleClick} />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByText('홍길동'))
    expect(handleClick).toHaveBeenCalledWith(mockRows[0])
  })

  it('같은 playerUuid가 여러 행에 있을 때 각 행을 독립적으로 렌더링한다', () => {
    const duplicateRows = [
      { rank: 1, name: '홍길동', affiliation: '경영학과', teamCode: 'AB1234', character: 'fox', totalAssets: 200000, playerUuid: 'uuid-1', sessionId: 'session-A' },
      { rank: 2, name: '홍길동', affiliation: '경영학과', teamCode: 'AB1234', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1', sessionId: 'session-B' },
    ]
    render(<MemoryRouter><RankingTable rows={duplicateRows} /></MemoryRouter>)
    const rows = screen.getAllByText('홍길동')
    expect(rows).toHaveLength(2)
  })

  it('highlightPlayerUuid가 있지만 rows에서 찾을 수 없을 때 플레이스홀더 행을 렌더링한다', () => {
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} highlightPlayerUuid="uuid-unknown" />
      </MemoryRouter>
    )
    const empty = screen.getByTestId('pinned-row-empty')
    expect(empty).toBeInTheDocument()
    expect(empty).toHaveTextContent('게임에 참여하러 가기')
    expect(empty).toHaveTextContent('-위')
    expect(empty).toHaveTextContent('-원')
  })

  it('플레이스홀더 행 클릭 시 onRowClick에 isPlaceholder: true 객체를 전달한다', async () => {
    const handleClick = vi.fn()
    render(
      <MemoryRouter>
        <RankingTable rows={mockRows} highlightPlayerUuid="uuid-unknown" onRowClick={handleClick} />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByTestId('pinned-row-empty'))
    expect(handleClick).toHaveBeenCalledWith({ isPlaceholder: true })
  })
})
