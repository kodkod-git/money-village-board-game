import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClanRecapPage from './ClanRecapPage'

describe('ClanRecapPage', () => {
  it('수업 이름과 준비 중 문구를 보여주고 뒤로가기로 onBack을 부른다', async () => {
    const onBack = vi.fn()
    render(<ClanRecapPage className="3학년 2반" onBack={onBack} />)
    expect(screen.getByText('3학년 2반')).toBeInTheDocument()
    expect(screen.getByText('준비 중이에요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '팀 현황으로 돌아가기' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
