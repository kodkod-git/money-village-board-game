import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StockEditModal from './StockEditModal'

const VALUES = { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 }

describe('StockEditModal', () => {
  it('+ 버튼 클릭 시 onChange를 병합된 주식 객체로 호출한다', async () => {
    const onChange = vi.fn()
    render(<StockEditModal values={VALUES} onChange={onChange} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByLabelText('수량 증가')[1])
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, finance: 1 })
  })

  it('닫기 버튼 없이 배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<StockEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
