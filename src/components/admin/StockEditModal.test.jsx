import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StockEditModal from './StockEditModal'

const VALUES = { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 }

describe('StockEditModal', () => {
  it('수량 입력 후 확인 클릭 시 onChange를 병합된 주식 객체로 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<StockEditModal values={VALUES} onChange={onChange} onClose={onClose} />)
    const input = screen.getByLabelText('금융 수량')
    await userEvent.clear(input)
    await userEvent.type(input, '1')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('확인'))
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, finance: 1 })
    expect(onClose).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<StockEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<StockEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
