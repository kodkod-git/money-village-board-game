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

  it('hidePrices면 가격을 숨긴다', async () => {
    render(<AssetInputSteps hidePrices gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await goToStocks()
    expect(screen.queryAllByText(/^[\d,]+원$/)).toHaveLength(0)
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산' })).toBeInTheDocument()
    expect(screen.queryAllByText(/^[\d,]+원$/)).toHaveLength(0)
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
