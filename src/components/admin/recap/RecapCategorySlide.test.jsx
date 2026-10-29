import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapCategorySlide from './RecapCategorySlide'

const team = (id, name, cash) => ({ id, name, memberCount: 2, cash, stockValue: 0, realEstateValue: 0, totalAssets: 0 })

describe('RecapCategorySlide', () => {
  it('제목, 큰 값부터 줄, 1위 기준 막대 너비, 동점 1위를 보여준다', () => {
    render(
      <RecapCategorySlide
        title="현금을 가장 많이 모은 팀은?"
        valueKey="cash"
        teams={[team('k1', '팀 1', 100), team('k2', '팀 2', 200), team('k3', '팀 3', 200)]}
      />
    )
    expect(screen.getByRole('heading', { name: '현금을 가장 많이 모은 팀은?' })).toBeInTheDocument()
    const rows = screen.getAllByTestId('recap-row')
    expect(rows.map(r => r.textContent)).toEqual(['팀 2200원', '팀 3200원', '팀 1100원'])
    expect(screen.getAllByTestId('recap-bar').map(b => b.style.width)).toEqual(['100%', '100%', '50%'])
    expect(screen.getByTestId('recap-winner')).toHaveTextContent('🏆 팀 2 · 팀 3')
  })

  it('꼴찌 줄의 막대가 먼저(지연 0), 1위가 마지막에 차오른다', () => {
    render(
      <RecapCategorySlide title="t" valueKey="cash" teams={[team('k1', 'A', 300), team('k2', 'B', 200), team('k3', 'C', 100)]} />
    )
    const delays = screen.getAllByTestId('recap-bar').map(b => b.style.getPropertyValue('--delay'))
    expect(delays).toEqual(['700ms', '350ms', '0ms'])
    expect(screen.getByTestId('recap-winner').style.getPropertyValue('--delay')).toBe('1200ms')
  })

  it('모두 0원이면 막대 0%, "0원", 전원 1위', () => {
    render(<RecapCategorySlide title="t" valueKey="cash" teams={[team('k1', 'A', 0), team('k2', 'B', 0)]} />)
    expect(screen.getAllByTestId('recap-bar').map(b => b.style.width)).toEqual(['0%', '0%'])
    expect(screen.getAllByText('0원')).toHaveLength(2)
    expect(screen.getByTestId('recap-winner')).toHaveTextContent('🏆 A · B')
  })
})
