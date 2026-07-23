import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RankingPodium from './RankingPodium'

const rows = [
  { rank: 1, name: '김민준', character: 'lion', playerUuid: 'p1', totalAssets: 2191000 },
  { rank: 2, name: '이서연', character: 'fox', playerUuid: 'p2', totalAssets: 1844500 },
  { rank: 3, name: '박지호', character: 'panda', playerUuid: 'p3', totalAssets: 1291500 },
]

describe('RankingPodium', () => {
  it('3명일 때 1~3위를 모두 렌더링한다', () => {
    render(<RankingPodium rows={rows} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('박지호')).toBeInTheDocument()
    expect(screen.getByText('2,191,000원')).toBeInTheDocument()
  })

  it('2명일 때는 1~2위만 렌더링하고 3위 자리는 없다', () => {
    render(<RankingPodium rows={rows.slice(0, 2)} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.queryByText('박지호')).toBeNull()
  })

  it('1명일 때는 1위만 렌더링한다', () => {
    render(<RankingPodium rows={rows.slice(0, 1)} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.queryByText('이서연')).toBeNull()
  })

  it('0명일 때는 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<RankingPodium rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('valueKey를 지정하면 해당 필드 값을 표시한다', () => {
    const boothRows = [
      { rank: 1, name: '정우성', character: 'tiger', playerUuid: 'p4', stockValue: 172000 },
    ]
    render(<RankingPodium rows={boothRows} valueKey="stockValue" />)
    expect(screen.getByText('172,000원')).toBeInTheDocument()
  })

  it('해당 필드 값이 null이면 에러 없이 -원으로 표시한다', () => {
    const boothRows = [
      { rank: 1, name: '정우성', character: 'tiger', playerUuid: 'p4', stockValue: null },
      { rank: 2, name: '한소희', character: 'toucan', playerUuid: 'p5', stockValue: 90000 },
      { rank: 3, name: '박지호', character: 'panda', playerUuid: 'p6', stockValue: null },
    ]
    render(<RankingPodium rows={boothRows} valueKey="stockValue" />)
    expect(screen.getAllByText('-원')).toHaveLength(2)
    expect(screen.getByText('90,000원')).toBeInTheDocument()
  })
})
