import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClanRecapBanner from './ClanRecapBanner'

describe('ClanRecapBanner', () => {
  it('제목·부제를 보여주고 누르면 onOpen을 부른다', async () => {
    const onOpen = vi.fn()
    render(<ClanRecapBanner onOpen={onOpen} />)
    const banner = screen.getByRole('button', { name: /팀 대결 결과/ })
    expect(screen.getByText('팀별 자산을 한눈에 비교해 보세요')).toBeInTheDocument()
    await userEvent.click(banner)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
