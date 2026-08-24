import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssetQtyStepper from './AssetQtyStepper'

describe('AssetQtyStepper', () => {
  it('+ 버튼 클릭 시 onChange에 value+1을 문자열로 전달한다', async () => {
    const onChange = vi.fn()
    render(<AssetQtyStepper value={3} onChange={onChange} max={100} label="금융" />)
    await userEvent.click(screen.getByLabelText('금융 수량 증가'))
    expect(onChange).toHaveBeenCalledWith('4')
  })

  it('− 버튼 클릭 시 onChange에 value-1을 문자열로 전달한다', async () => {
    const onChange = vi.fn()
    render(<AssetQtyStepper value={3} onChange={onChange} max={100} label="금융" />)
    await userEvent.click(screen.getByLabelText('금융 수량 감소'))
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('값이 0이면 − 버튼이 비활성화된다', () => {
    render(<AssetQtyStepper value={0} onChange={vi.fn()} max={100} label="금융" />)
    expect(screen.getByLabelText('금융 수량 감소')).toBeDisabled()
  })

  it('값이 max이면 + 버튼이 비활성화된다', () => {
    render(<AssetQtyStepper value={100} onChange={vi.fn()} max={100} label="금융" />)
    expect(screen.getByLabelText('금융 수량 증가')).toBeDisabled()
  })

  it('입력칸에 직접 타이핑하면 onChange가 입력값으로 호출된다', async () => {
    const onChange = vi.fn()
    render(<AssetQtyStepper value={0} onChange={onChange} max={100} label="금융" />)
    await userEvent.type(screen.getByLabelText('금융 수량'), '5')
    expect(onChange).toHaveBeenCalledWith('5')
  })
})
