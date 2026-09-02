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

  it('선택된 타일을 다시 클릭해 해제하고 확인하면 onChange(null)을 호출한다 (무직)', async () => {
    const onChange = vi.fn()
    render(<JobEditModal value="a" onChange={onChange} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('경영·금융')) // 선택 해제
    await userEvent.click(screen.getByText('확인'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('선택된 직업이 없으면 무직으로 저장된다는 안내를 보여준다', () => {
    render(<JobEditModal value={null} onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/무직으로 저장/)).toBeInTheDocument()
  })

  it('직업이 선택되어 있으면 무직 안내를 보여주지 않는다', () => {
    render(<JobEditModal value="a" onChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText(/무직으로 저장/)).toBeNull()
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
