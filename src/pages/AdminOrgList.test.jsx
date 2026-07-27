import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminOrgList from './AdminOrgList'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'

const ORGS = [{ id: 'org-1', name: '경영학과' }, { id: 'unassigned', name: '미소속/기타' }]

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ORGS) })
})

afterEach(() => clearAdminSession())

describe('AdminOrgList', () => {
  it('마운트 시 /api/admin/orgs를 호출해 소속 목록을 보여준다', async () => {
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('경영학과')).toBeInTheDocument()
    expect(screen.getByText('미소속/기타')).toBeInTheDocument()
  })

  it('소속 클릭 시 onSelectOrg를 소속 이름과 함께 호출한다', async () => {
    const onSelectOrg = vi.fn()
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={onSelectOrg} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('경영학과'))
    expect(onSelectOrg).toHaveBeenCalledWith('경영학과')
  })

  it('소속 생성하기로 새 소속을 만들면 목록을 새로고침한다', async () => {
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'org-2', name: '자원경영학과' }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ORGS) })
    })
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('경영학과')
    await userEvent.type(screen.getByPlaceholderText('새 소속 이름'), '자원경영학과')
    await userEvent.click(screen.getByText('소속 생성하기'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/orgs', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '자원경영학과' }),
      }))
    )
  })

  it('로그아웃 버튼 클릭 시 onLogout을 호출한다', async () => {
    const onLogout = vi.fn()
    render(<AdminOrgList profile={{ username: 'admin', isSuper: true }} onSelectOrg={vi.fn()} onLogout={onLogout} />)
    await userEvent.click(screen.getByText('로그아웃'))
    expect(onLogout).toHaveBeenCalled()
  })
})
