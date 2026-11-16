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
