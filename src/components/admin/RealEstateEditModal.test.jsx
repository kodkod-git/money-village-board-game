import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RealEstateEditModal from './RealEstateEditModal'

const VALUES = { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('RealEstateEditModal', () => {
  it('+ 버튼 클릭 시 onChange를 병합된 부동산 객체로 호출한다', async () => {
    const onChange = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={onChange} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByLabelText('수량 증가')[1])
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, nuri: 1 })
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<RealEstateEditModal values={VALUES} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
