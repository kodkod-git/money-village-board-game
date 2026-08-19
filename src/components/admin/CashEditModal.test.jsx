import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CashEditModal from './CashEditModal'

describe('CashEditModal', () => {
  it('금액 입력 후 확인 클릭 시 onConfirm을 숫자로 호출하고 닫는다', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<CashEditModal initialValue={125000} onConfirm={onConfirm} onClose={onClose} />)
    const input = screen.getByLabelText('현금')
    await userEvent.clear(input)
    await userEvent.type(input, '221000')
    expect(screen.getByText('= 22만 1천 원')).toBeInTheDocument()
    await userEvent.click(screen.getByText('확인'))
    expect(onConfirm).toHaveBeenCalledWith(221000)
    expect(onClose).toHaveBeenCalled()
  })

  it('10억원 초과로 입력하면 10억원으로 클램프된다', async () => {
    const onConfirm = vi.fn()
    render(<CashEditModal initialValue={0} onConfirm={onConfirm} onClose={vi.fn()} />)
    const input = screen.getByLabelText('현금')
    await userEvent.clear(input)
    await userEvent.type(input, '9999999999')
    await userEvent.click(screen.getByText('확인'))
    expect(onConfirm).toHaveBeenCalledWith(1000000000)
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<CashEditModal initialValue={0} onConfirm={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })
})
