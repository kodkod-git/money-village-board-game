import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgeEditModal from './BadgeEditModal'

const NONE = [false, false, false, false, false, false]

describe('BadgeEditModal', () => {
  it('카드 토글 후 확인 클릭 시 onChange를 갱신된 배열로 호출하고 닫는다', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(<BadgeEditModal badges={NONE} onChange={onChange} onClose={onClose} />)
    await userEvent.click(screen.getByText('문제해결능력'))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('확인'))
    expect(onChange).toHaveBeenCalledWith([false, false, true, false, false, false])
    expect(onClose).toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<BadgeEditModal badges={NONE} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<BadgeEditModal badges={NONE} onChange={vi.fn()} onClose={onClose} />)
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
