import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminDashboard from './AdminDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { SocketProvider } from '../contexts/SocketContext'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})
vi.mock('./AdminResponseAnalytics', () => ({ default: () => <div>테스트 분석 본문</div> }))

function renderDashboard() {
  return render(<SocketProvider><MemoryRouter><AdminDashboard /></MemoryRouter></SocketProvider>)
}

beforeEach(() => {
  setAdminSession('t1', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
})

afterEach(() => {
  restoreViewport()
  clearAdminSession()
  document.body.classList.remove('admin-mode')
})

describe('AdminDashboard 모바일', () => {
  it('마스터 관리자라도 모바일에서는 분석 메뉴가 없고 탭바를 보여 준다', () => {
    mockViewport(390)
    renderDashboard()
    expect(screen.queryByRole('button', { name: '테스트 분석' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '게임 분석' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '메뉴 접기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '설정' })).toBeInTheDocument()
  })

  it('PC에서는 사이드바를 보여 준다', () => {
    mockViewport(1280)
    renderDashboard()
    expect(screen.getByRole('button', { name: '테스트 분석' })).toBeInTheDocument()
    expect(screen.getByText('메뉴 접기')).toBeInTheDocument()
  })

  it('분석 화면을 보다가 좁히면 안내 문구가 나오고, 넓히면 돌아온다', async () => {
    const viewport = mockViewport(1280)
    renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: '테스트 분석' }))
    expect(screen.getByText('테스트 분석 본문')).toBeInTheDocument()

    viewport.resize(390)
    expect(screen.getByText('PC에서 이용해 주세요')).toBeInTheDocument()
    expect(screen.queryByText('테스트 분석 본문')).not.toBeInTheDocument()

    viewport.resize(1280)
    expect(screen.getByText('테스트 분석 본문')).toBeInTheDocument()
  })
})
