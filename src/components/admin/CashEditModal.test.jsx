import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import CashEditModal from './CashEditModal'
import { mockViewport, restoreViewport } from '../../test-utils/mockViewport'

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

describe('CashEditModal 모바일', () => {
  afterEach(restoreViewport)

  it('입력칸 대신 현재 값에서 시작하는 키패드를 연다', () => {
    mockViewport(390)
    render(<CashEditModal initialValue={125000} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByLabelText('현금')).not.toBeInTheDocument()
    expect(screen.getByTestId('display-value')).toHaveTextContent('125,000')
  })

  it('확인을 누르면 값을 넘기고 닫는다', async () => {
    mockViewport(390)
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<CashEditModal initialValue={12} onConfirm={onConfirm} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledWith(123)
    expect(onClose).toHaveBeenCalled()
  })
})
