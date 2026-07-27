import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassList from './AdminClassList'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'

const CLASSES = [{ id: 'class-1', name: '3학년 2반' }, { id: 'unassigned', name: '미배정 수업' }]

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(CLASSES) })
})

afterEach(() => clearAdminSession())

describe('AdminClassList', () => {
  it('마운트 시 /api/admin/classes를 호출해 수업 목록을 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('3학년 2반')).toBeInTheDocument()
    expect(screen.getByText('미배정 수업')).toBeInTheDocument()
  })

  it('수업 클릭 시 onSelectClass를 {id,name}과 함께 호출한다', async () => {
    const onSelectClass = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={onSelectClass} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('3학년 2반'))
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'class-1', name: '3학년 2반' })
  })

  it('수업 생성하기로 새 수업을 만들면 목록을 새로고침한다', async () => {
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'class-2', name: '3학년 3반' }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CLASSES) })
    })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    await userEvent.type(screen.getByPlaceholderText('새 수업 이름'), '3학년 3반')
    await userEvent.click(screen.getByText('수업 생성하기'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '3학년 3반' }),
      }))
    )
  })

  it('로그아웃 버튼 클릭 시 onLogout을 호출한다', async () => {
    const onLogout = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={onLogout} />)
    await userEvent.click(screen.getByText('로그아웃'))
    expect(onLogout).toHaveBeenCalled()
  })
})
