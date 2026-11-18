import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssetInputSteps, { defaultGameState } from './AssetInputSteps'

async function goToStocks() {
  await userEvent.click(screen.getByText('다음'))
  await userEvent.click(screen.getByText('다음'))
  expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
}

describe('AssetInputSteps', () => {
  it('가격을 보여준다(기본)', async () => {
    render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await goToStocks()
    expect(screen.getAllByText(/^[\d,]+원$/).length).toBeGreaterThan(0)
  })

  it('단계를 지날 때 방문 표시를 onChange로 알리고, 완료 시 현금과 isCompleted를 담아 onComplete를 부른다', async () => {
    const onChange = vi.fn()
    const onComplete = vi.fn()
    render(<AssetInputSteps gameState={{ ...defaultGameState(), cash: 3000 }} onChange={onChange} onComplete={onComplete} />)
    await userEvent.click(screen.getByText('다음'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ jobVisited: true }))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('완료'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cash: 3000, isCompleted: true }))
  })
})

describe('AssetInputSteps 5판', () => {
  it('주식 단계에 뷰티를 포함한 4종목이 나오고, 6판에는 뷰티가 없다', async () => {
    const { unmount } = render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} hideRealEstate />)
    await goToStocks()
    for (const label of ['반도체', '금융', '바이오', '뷰티']) expect(screen.getByText(label)).toBeInTheDocument()
    unmount()

    render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await goToStocks()
    expect(screen.getByText('바이오')).toBeInTheDocument()
    expect(screen.queryByText('뷰티')).not.toBeInTheDocument()
  })

  it('뷰티 수량 값이 없는 예전 상태여도 0주로 보여준다', async () => {
    const { beauty, ...oldStocks } = defaultGameState().stocks
    render(<AssetInputSteps gameState={{ ...defaultGameState(), stocks: oldStocks }} onChange={vi.fn()} onComplete={vi.fn()} hideRealEstate />)
    await goToStocks()
    expect(screen.getByText('뷰티')).toBeInTheDocument()
  })

  it('부동산 단계 없이 직업 → 성공열쇠 → 주식 → 현금으로 진행한다', async () => {
    const onComplete = vi.fn()
    render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={onComplete} hideRealEstate />)
    expect(screen.queryByText('부동산')).not.toBeInTheDocument()
    await goToStocks()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '현금' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('완료'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ isCompleted: true }))
  })
})
