import { render, screen } from '@testing-library/react'
import TeamPriceCharts, { barWidthFor, changeRate, niceRange, teamPrices } from './TeamPriceCharts'

const row = (sessionId, teamName, stockPrices, realEstatePrices) => ({
  sessionId, teamName, stockPrices, realEstatePrices,
})

const rows = [
  row('s2', '팀 10', { bio: 3000, semiconductor: 4000, finance: 5000 }, { gaon: 20000, chorong: 100000, dami: 70000 }),
  row('s1', '팀 2', { bio: 1000, semiconductor: 2000, finance: 0 }, { gaon: 30000, chorong: 90000, dami: 60000 }),
  row('s1', '팀 2', { bio: 1000, semiconductor: 2000, finance: 0 }, { gaon: 30000, chorong: 90000, dami: 60000 }),
]

describe('TeamPriceCharts', () => {
  it('참가자 행을 팀 단위로 묶고 팀 이름 숫자 순으로 정렬한다', () => {
    expect(teamPrices(rows).map(t => t.name)).toEqual(['팀 2', '팀 10'])
  })

  it('팀이 많을수록 막대가 가늘어진다', () => {
    expect(barWidthFor(2)).toBeGreaterThan(barWidthFor(10))
    expect(barWidthFor(1)).toBe(36)
    expect(barWidthFor(100)).toBe(6)
  })

  it('시작 가격 대비 등락률을 계산한다', () => {
    expect(changeRate(3000, 2000)).toBe(50)
    expect(changeRate(1000, 2000)).toBe(-50)
  })

  it('축 범위는 0%를 포함하고 하락 값도 담는다', () => {
    const { min, max, ticks } = niceRange([-50, 150])
    expect(min).toBeLessThanOrEqual(-50)
    expect(max).toBeGreaterThanOrEqual(150)
    expect(ticks).toContain(0)
  })

  it('팀별 주식·부동산 가격 차트를 그린다', () => {
    render(<TeamPriceCharts rows={rows} />)
    expect(screen.getByRole('img', { name: '팀별 주식 가격: 팀 2 바이오 1,000원, 반도체 2,000원, 금융 0원 / 팀 10 바이오 3,000원, 반도체 4,000원, 금융 5,000원' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^팀별 부동산 가격: 팀 2 단독주택 30,000원, 아파트 90,000원, 빌라 60,000원/ })).toBeInTheDocument()
  })

  it('팀별 주식·부동산 등락률 차트를 그린다 (시작가 주식 2,000원, 부동산 10,000원)', () => {
    render(<TeamPriceCharts rows={rows} />)
    expect(screen.getByRole('img', { name: '팀별 주식 가격 등락: 팀 2 바이오 -50%, 반도체 0%, 금융 -100% / 팀 10 바이오 +50%, 반도체 +100%, 금융 +150%' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^팀별 부동산 가격 등락: 팀 2 단독주택 \+200%, 아파트 \+800%, 빌라 \+500%/ })).toBeInTheDocument()
  })

  it('가격 기록이 없는 옛 결과 팀은 차트에서 뺀다', () => {
    render(<TeamPriceCharts rows={[...rows, row('s3', '팀 3', null, null)]} />)
    expect(screen.getByRole('img', { name: /팀별 주식 가격 등락/ })).not.toHaveAccessibleName(/팀 3/)
  })
})
