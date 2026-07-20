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

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<BadgeEditModal badges={NONE} onToggle={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
