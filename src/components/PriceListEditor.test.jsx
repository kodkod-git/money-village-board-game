import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PriceListEditor from './PriceListEditor'

const STOCKS = { semiconductor: 2000, finance: 2000, bio: 2000 }

describe('PriceListEditor', () => {
  it('종목 이름·단위·가격을 보여준다', () => {
    render(<PriceListEditor category="stocks" prices={STOCKS} onChange={vi.fn()} />)
    expect(screen.getByText('반도체')).toBeInTheDocument()
    expect(screen.getAllByText('단위: 원')).toHaveLength(3)
    expect(screen.getAllByText('2,000')).toHaveLength(3)
  })

  it('가격을 눌러 계산기로 입력하면 바뀐 목록으로 onChange를 부른다', async () => {
    const onChange = vi.fn()
    render(<PriceListEditor category="stocks" prices={STOCKS} onChange={onChange} />)
    await userEvent.click(screen.getAllByRole('button', { name: /2,000/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith({ semiconductor: 5, finance: 2000, bio: 2000 })
  })
})
