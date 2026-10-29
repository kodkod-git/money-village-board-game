import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapFinalSlide from './RecapFinalSlide'

const t = (id, name, totalAssets) => ({ id, name, memberCount: 1, cash: 0, stockValue: 0, realEstateValue: 0, totalAssets })

describe('RecapFinalSlide', () => {
  it('총 자산 1·2·3위를 시상대에, 4위부터 목록에 보여준다', () => {
    render(<RecapFinalSlide teams={[t('a', '가', 100), t('b', '나', 400), t('c', '다', 300), t('d', '라', 200), t('e', '마', 50)]} />)
    expect(screen.getByRole('heading', { name: '최종 순위' })).toBeInTheDocument()
    expect(screen.getByTestId('podium-1')).toHaveTextContent('나')
    expect(screen.getByTestId('podium-1')).toHaveTextContent('400원')
    expect(screen.getByTestId('podium-2')).toHaveTextContent('다')
    expect(screen.getByTestId('podium-3')).toHaveTextContent('라')
    const rest = screen.getAllByTestId('recap-rest-row').map(r => r.textContent)
    expect(rest).toEqual(['4위가100원', '5위마50원'])
  })

  it('팀이 7개 이상이면 compact 표시가 붙는다', () => {
    const many = Array.from({ length: 8 }, (_, i) => t(`t${i}`, `팀${i}`, 100 - i))
    const { container, rerender } = render(<RecapFinalSlide teams={many} />)
    expect(container.firstChild).toHaveAttribute('data-compact', 'true')
    rerender(<RecapFinalSlide teams={many.slice(0, 6)} />)
    expect(container.firstChild).not.toHaveAttribute('data-compact')
  })

  it('팀이 하나면 1위 자리만 있고 목록은 없다', () => {
    render(<RecapFinalSlide teams={[t('a', '가', 100)]} />)
    expect(screen.getByTestId('podium-1')).toHaveTextContent('가')
    expect(screen.queryByTestId('podium-2')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('recap-rest-row')).toHaveLength(0)
  })
})
