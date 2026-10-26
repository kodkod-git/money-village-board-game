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

  function competitionState() {
    return { ...defaultGameState(), prices: {
      stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
    } }
  }

  it('일반 모드는 5단계이고 가격 단계가 없다', () => {
    render(<AssetInputSteps gameState={defaultGameState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.queryByText('주식 가격')).not.toBeInTheDocument()
  })

  it('editablePrices면 성공열쇠 다음에 주식 가격, 주식 다음에 부동산 가격 단계가 나온다', async () => {
    render(<AssetInputSteps editablePrices gameState={competitionState()} onChange={vi.fn()} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식 가격' })).toBeInTheDocument()
    expect(screen.getByText('게임이 끝났을 때의 가격을 입력해주세요')).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산 가격' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '현금' })).toBeInTheDocument()
  })

  it('가격 단계에서 고친 가격을 onChange로 알리고, 수량 단계에 그 가격을 보여준다', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<AssetInputSteps editablePrices gameState={competitionState()} onChange={onChange} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getAllByRole('button', { name: /2,000/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    const next = onChange.mock.lastCall[0]
    expect(next.prices.stocks).toEqual({ semiconductor: 5, finance: 2000, bio: 2000 })

    rerender(<AssetInputSteps editablePrices gameState={next} onChange={onChange} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()
    expect(screen.getByText('5원')).toBeInTheDocument()
  })

  it('가격 단계의 초기화는 그 종류만 기본 가격으로 되돌린다', async () => {
    const onChange = vi.fn()
    const state = competitionState()
    state.prices = { stocks: { semiconductor: 1, finance: 1, bio: 1 }, realEstate: { gaon: 1, dami: 1, chorong: 1 } }
    render(<AssetInputSteps editablePrices gameState={state} onChange={onChange} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      prices: { stocks: { semiconductor: 2000, finance: 2000, bio: 2000 }, realEstate: { gaon: 1, dami: 1, chorong: 1 } },
    }))
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
