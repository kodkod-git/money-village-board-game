import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TeamStatSlide from './TeamStatSlide'

const TEAMS = [
  { sessionId: 's1', name: '팀 1', cash: 1000 },
  { sessionId: 's2', name: '팀 2', cash: 3000 },
  { sessionId: 's3', name: '팀 3', cash: 0 },
]

function renderSlide(teams = TEAMS, mySessionId = 's1') {
  return render(<TeamStatSlide title="더 많은 현금을 가진 팀은?" valueKey="cash" teams={teams} mySessionId={mySessionId} />)
}

describe('TeamStatSlide', () => {
  it('제목과 1위 팀을 보여주고, 값이 큰 팀부터 막대를 그린다', () => {
    renderSlide()
    expect(screen.getByRole('heading', { name: '더 많은 현금을 가진 팀은?' })).toBeInTheDocument()
    expect(screen.getByText('🏆 팀 2')).toBeInTheDocument()
    const rows = screen.getAllByTestId('team-stat-row')
    expect(rows.map(r => within(r).getByTestId('team-stat-name').textContent)).toEqual(['팀 2', '팀 1우리 팀', '팀 3'])
    expect(within(rows[0]).getByText('3,000원')).toBeInTheDocument()
    expect(within(rows[2]).getByText('0원')).toBeInTheDocument()
  })

  it('막대 길이는 1위 값 기준이고 0원은 길이 0이다', () => {
    renderSlide()
    const bars = screen.getAllByTestId('team-stat-bar')
    expect(bars[0].style.width).toBe('100%')
    expect(bars[1].style.width).toBe(`${(1000 / 3000) * 100}%`)
    expect(bars[2].style.width).toBe('0%')
  })

  it('우리 팀 줄을 강조하고 "우리 팀"을 붙인다', () => {
    renderSlide()
    const mine = screen.getByText('우리 팀').closest('[data-testid="team-stat-row"]')
    expect(mine).toHaveAttribute('data-mine', 'true')
    expect(screen.getAllByText('우리 팀')).toHaveLength(1)
  })

  it('1위가 동점이면 함께 보여준다', () => {
    renderSlide([
      { sessionId: 's1', name: '팀 1', cash: 500 },
      { sessionId: 's2', name: '팀 2', cash: 100 },
      { sessionId: 's3', name: '팀 3', cash: 500 },
    ])
    expect(screen.getByText('🏆 팀 1 · 팀 3')).toBeInTheDocument()
  })

  it('모든 팀이 0원이면 막대 길이가 모두 0이다', () => {
    renderSlide([{ sessionId: 's1', name: '팀 1', cash: 0 }])
    expect(screen.getByTestId('team-stat-bar').style.width).toBe('0%')
  })
})
