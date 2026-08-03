import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import QuantitySelector from './QuantitySelector'

describe('QuantitySelector', () => {
  it('현재 값을 가운데에 표시한다', () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('값이 0이면 0을 표시한다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('+ 버튼 클릭 시 onChange에 value+1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('− 버튼 클릭 시 onChange에 value-1을 전달한다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 감소'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('값이 0이면 − 버튼이 비활성화된다', () => {
    render(<QuantitySelector value={0} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 감소')).toBeDisabled()
  })

  it('값이 10 이상이어도 + 버튼이 비활성화되지 않는다', () => {
    render(<QuantitySelector value={10} onChange={vi.fn()} label="단독 가온개미" />)
    expect(screen.getByLabelText('수량 증가')).not.toBeDisabled()
  })

  it('값이 10일 때 + 버튼을 클릭하면 11을 전달한다 (상한 없음)', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={10} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByLabelText('수량 증가'))
    expect(onChange).toHaveBeenCalledWith(11)
  })

  it('가운데 숫자를 클릭하면 라벨을 포함한 수량 입력 팝업이 열린다', async () => {
    render(<QuantitySelector value={3} onChange={vi.fn()} label="단독 가온개미" />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByText('단독 가온개미 수량')).toBeInTheDocument()
  })

  it('팝업에서 확인하면 onChange가 호출되고 팝업이 닫힌다', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={3} onChange={onChange} label="단독 가온개미" />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith(3)
    expect(screen.queryByText('단독 가온개미 수량')).toBeNull()
  })
})
