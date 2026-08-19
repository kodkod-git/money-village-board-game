import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JobEditModal from './JobEditModal'

describe('JobEditModal', () => {
  it('직업 타일 선택 후 확인 클릭 시 onChange를 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<JobEditModal value="a" onChange={onChange} onClose={onClose} />)
    await userEvent.click(screen.getByText('보건·교육'))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('확인'))
    expect(onChange).toHaveBeenCalledWith('c')
    expect(onClose).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<JobEditModal value="a" onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<JobEditModal value="a" onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
