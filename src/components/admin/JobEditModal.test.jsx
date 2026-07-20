import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JobEditModal from './JobEditModal'

describe('JobEditModal', () => {
  it('직업 타일 클릭 시 onChange를 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<JobEditModal value="a" onChange={onChange} onClose={onClose} />)
    await userEvent.click(screen.getByText('보건·교육'))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<JobEditModal value="a" onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
