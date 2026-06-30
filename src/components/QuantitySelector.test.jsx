import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import QuantitySelector from './QuantitySelector'

describe('QuantitySelector', () => {
  it('1~10 버튼 10개를 렌더링한다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} />)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument()
    }
  })

  it('버튼 클릭 시 onChange에 해당 숫자를 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={0} onChange={onChange} />)
    await userEvent.click(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('이미 선택된 버튼을 클릭하면 onChange에 0을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} />)
    await userEvent.click(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('value 이하의 버튼에 selected 클래스가 적용된다', () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} />)
    expect(screen.getByText('1').closest('button').className).toMatch(/selected/)
    expect(screen.getByText('4').closest('button').className).not.toMatch(/selected/)
  })
})
