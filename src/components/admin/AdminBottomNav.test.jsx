import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminBottomNav from './AdminBottomNav'

describe('AdminBottomNav', () => {
  it('탭 4개만 보여 주고 분석 메뉴는 보여 주지 않는다', () => {
    render(<AdminBottomNav activeSection="classes" onNavigate={vi.fn()} teamStatusDisabled={false} />)
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['수업 목록', '팀 현황', '랭킹 보기', '설정'])
  })

  it('수업을 고르기 전에는 팀 현황과 랭킹 보기를 누를 수 없다', () => {
    render(<AdminBottomNav activeSection="classes" onNavigate={vi.fn()} teamStatusDisabled />)
    expect(screen.getByRole('button', { name: '팀 현황' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '랭킹 보기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '설정' })).toBeEnabled()
  })

  it('탭을 누르면 onNavigate를 부르고, 현재 탭을 표시한다', async () => {
    const onNavigate = vi.fn()
    render(<AdminBottomNav activeSection="settings" onNavigate={onNavigate} teamStatusDisabled={false} />)
    expect(screen.getByRole('button', { name: '설정' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))
    expect(onNavigate).toHaveBeenCalledWith('ranking')
  })
})
