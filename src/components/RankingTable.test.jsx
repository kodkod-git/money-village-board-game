import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RankingTable from './RankingTable'

const mockRows = [
  { rank: 1, name: '홍길동', affiliation: '경영학과', character: 'fox', totalAssets: 150000, playerUuid: 'uuid-1' },
  { rank: 2, name: '김철수', affiliation: '공학부', character: 'cat', totalAssets: 120000, playerUuid: 'uuid-2' },
]

describe('RankingTable', () => {
  it('등수, 이름, 소속, 총자산을 렌더링한다', () => {
    render(<MemoryRouter><RankingTable rows={mockRows} /></MemoryRouter>)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('경영학과')).toBeInTheDocument()
    expect(screen.getByText('150,000원')).toBeInTheDocument()
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
})
