import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import QuantitySelector from './QuantitySelector'

describe('QuantitySelector', () => {
  it('현재 값을 가운데에 표시한다', () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('값이 0이면 0을 표시한다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('+ 버튼 클릭 시 onChange에 value+1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('− 버튼 클릭 시 onChange에 value-1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('수량 감소'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('값이 0이면 − 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} />)
    expect(screen.getByLabelText('수량 감소')).toBeDisabled()
  })

  it('값이 10이면 + 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={10} onChange={vi.fn()} />)
    expect(screen.getByLabelText('수량 증가')).toBeDisabled()
  })
})
