import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgeEditModal from './BadgeEditModal'

const NONE = [false, false, false, false, false, false]

describe('BadgeEditModal', () => {
  it('카드 클릭 시 onToggle을 해당 인덱스로 호출한다', async () => {
    const onToggle = vi.fn()
    render(<BadgeEditModal badges={NONE} onToggle={onToggle} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('문제해결능력'))
    expect(onToggle).toHaveBeenCalledWith(2)
  })

  it('닫기 버튼 없이 배경 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(<BadgeEditModal badges={NONE} onToggle={vi.fn()} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
    await userEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })
})
