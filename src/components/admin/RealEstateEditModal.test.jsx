import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RealEstateEditModal from './RealEstateEditModal'

const VALUES = { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('RealEstateEditModal', () => {
  it('수량 입력 후 확인 클릭 시 onChange를 병합된 부동산 객체로 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={onChange} onClose={onClose} />)
    const input = screen.getByLabelText('단독 누리고양이 수량')
    await userEvent.clear(input)
    await userEvent.type(input, '3')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('확인'))
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, nuri: 3 })
    expect(onClose).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<RealEstateEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
