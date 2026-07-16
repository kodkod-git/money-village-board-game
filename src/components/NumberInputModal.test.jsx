import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import NumberInputModal from './NumberInputModal'

describe('NumberInputModal', () => {
  it('제목과 초기값, 단위를 표시한다', () => {
    render(<NumberInputModal title="현금 입력" initialValue={5000} unit="원" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('현금 입력')).toBeInTheDocument()
    expect(screen.getByTestId('display-value')).toHaveTextContent('5,000')
    expect(screen.getByText('원')).toBeInTheDocument()
  })

  it('숫자 키를 누르면 값 뒤에 이어붙인다', async () => {
    render(<NumberInputModal title="현금 입력" initialValue={0} unit="원" onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    expect(screen.getByTestId('display-value')).toHaveTextContent('5,000')
  })

  it('← 클릭 시 마지막 자리를 지운다', async () => {
    render(<NumberInputModal title="현금 입력" initialValue={50} unit="원" onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByTestId('display-value')).toHaveTextContent('5')
  })

  it('확인 클릭 시 onConfirm에 현재 값을 전달한다', async () => {
    const onConfirm = vi.fn()
    render(<NumberInputModal title="현금 입력" initialValue={1200} unit="원" onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledWith(1200)
  })

  it('maxValue가 있으면 확인 시 그 값으로 클램프한다', async () => {
    const onConfirm = vi.fn()
    render(<NumberInputModal title="수량" initialValue={5} unit="개" maxValue={10} onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledWith(10)
  })

  it('배경(오버레이) 클릭 시 onClose를 호출하고 onConfirm은 호출하지 않는다', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { container } = render(<NumberInputModal title="현금 입력" initialValue={0} unit="원" onConfirm={onConfirm} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('시트 영역 클릭 시 onClose를 호출하지 않는다', async () => {
    const onClose = vi.fn()
    render(<NumberInputModal title="현금 입력" initialValue={0} unit="원" onConfirm={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('현금 입력'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
