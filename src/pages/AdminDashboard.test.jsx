import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminDashboard from './AdminDashboard'
import { clearAdminSession } from '../utils/adminAuth'

beforeEach(() => {
  clearAdminSession()
  global.fetch = vi.fn(url => {
    if (url === '/api/admin/login') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 't1', username: 'admin', isSuper: true }),
      })
    }
    if (url === '/api/admin/classes') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'class-1', name: '3학년 2반' }]) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  })
})

afterEach(() => {
  document.body.classList.remove('admin-mode')
  clearAdminSession()
})

describe('AdminDashboard', () => {
  it('토큰이 없으면 로그인 화면을 보여준다', () => {
    render(<AdminDashboard />)
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument()
  })

  it('로그인에 성공하면 수업 목록 화면으로 전환한다', async () => {
    render(<AdminDashboard />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))
    expect(await screen.findByText('3학년 2반')).toBeInTheDocument()
  })

  it('수업을 선택하면 해당 수업의 대시보드로 전환한다', async () => {
    render(<AdminDashboard />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))
    await userEvent.click(await screen.findByText('3학년 2반'))
    expect(await screen.findByText('← 수업 목록')).toBeInTheDocument()
  })
})
