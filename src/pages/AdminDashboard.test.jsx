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
    if (url === '/api/admin/orgs') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'org-1', name: '경영학과' }]) })
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

  it('로그인에 성공하면 소속 목록 화면으로 전환한다', async () => {
    render(<AdminDashboard />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))
    expect(await screen.findByText('경영학과')).toBeInTheDocument()
  })

  it('소속을 선택하면 해당 소속의 대시보드로 전환한다', async () => {
    render(<AdminDashboard />)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))
    await userEvent.click(await screen.findByText('경영학과'))
    expect(await screen.findByText('← 소속 목록')).toBeInTheDocument()
  })
})
