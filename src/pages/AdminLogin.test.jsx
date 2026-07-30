import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminLogin from './AdminLogin'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('AdminLogin', () => {
  it('기본으로 로그인하기 버튼을 보여준다', () => {
    render(<MemoryRouter><AdminLogin onLogin={vi.fn()} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument()
  })

  it('회원가입 탭 클릭 시 회원가입하기 버튼으로 바뀐다', async () => {
    render(<MemoryRouter><AdminLogin onLogin={vi.fn()} /></MemoryRouter>)
    await userEvent.click(screen.getByText('회원가입'))
    expect(screen.getByRole('button', { name: '회원가입하기' })).toBeInTheDocument()
  })

  it('로그인 성공 시 onLogin을 토큰/프로필과 함께 호출한다', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 't1', username: 'admin', isSuper: true }),
    })
    const onLogin = vi.fn()
    render(<MemoryRouter><AdminLogin onLogin={onLogin} /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), '0000')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: '0000' }),
    }))
    expect(onLogin).toHaveBeenCalledWith('t1', { username: 'admin', isSuper: true })
  })

  it('로그인 실패 시 에러 메시지를 보여준다', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }),
    })
    render(<MemoryRouter><AdminLogin onLogin={vi.fn()} /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))

    expect(await screen.findByText('아이디 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
  })
})
