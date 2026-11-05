import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import AssetQtyStepper from './AssetQtyStepper'
import { mockViewport, restoreViewport } from '../../test-utils/mockViewport'

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

describe('AssetQtyStepper 모바일', () => {
  afterEach(restoreViewport)

  it('숫자를 누르면 키패드가 열리고, 고른 값을 문자열로 넘기며 최댓값으로 제한한다', async () => {
    mockViewport(390)
    const onChange = vi.fn()
    render(<AssetQtyStepper value="1" onChange={onChange} max={50} label="바이오" />)
    await userEvent.click(screen.getByRole('button', { name: '바이오 수량' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenCalledWith('19')

    await userEvent.click(screen.getByRole('button', { name: '바이오 수량' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onChange).toHaveBeenLastCalledWith('50')
  })

  it('PC에서는 입력칸을 그대로 보여 준다', () => {
    mockViewport(1280)
    render(<AssetQtyStepper value="1" onChange={vi.fn()} max={50} label="바이오" />)
    expect(screen.getByRole('spinbutton', { name: '바이오 수량' })).toBeInTheDocument()
  })
})
