import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassList from './AdminClassList'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'

const CLASSES = [
  { id: 'class-1', name: '3학년 2반', createdAt: '2026-07-27T00:00:00.000Z' },
  { id: 'unassigned', name: '미배정 수업' },
]

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(CLASSES) })
})

afterEach(() => clearAdminSession())

describe('AdminClassList', () => {
  it('제목은 수업 목록이다', () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    expect(screen.getByText('수업 목록')).toBeInTheDocument()
  })

  it('마운트 시 /api/admin/classes를 호출해 수업 목록을 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('3학년 2반')).toBeInTheDocument()
    expect(screen.getByText('미배정 수업')).toBeInTheDocument()
  })

  it('수업 항목에 생성일을 함께 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    expect(screen.getByText(new Date('2026-07-27T00:00:00.000Z').toLocaleDateString('ko-KR'))).toBeInTheDocument()
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

  it('미배정 수업에는 삭제 버튼을 보여주지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('미배정 수업')
    expect(screen.getAllByText('삭제')).toHaveLength(1)
  })

  it('삭제 버튼 클릭 시 확인 팝업을 보여주고, 확인 시 DELETE 요청 후 목록을 새로고침한다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })

    await userEvent.click(screen.getByText('삭제'))
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument()

    await userEvent.click(screen.getAllByText('삭제')[1])

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1', expect.objectContaining({
      method: 'DELETE',
    }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.anything())
    )
  })

  it('삭제 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    global.fetch.mockClear()

    await userEvent.click(screen.getByText('삭제'))
    await userEvent.click(screen.getByText('취소'))

    expect(screen.queryByText(/되돌릴 수 없습니다/)).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
