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

  it('닫기 버튼 없이 배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<JobEditModal value="a" onChange={vi.fn()} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
