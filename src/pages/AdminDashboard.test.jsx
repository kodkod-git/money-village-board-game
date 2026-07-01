import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

import { SocketProvider } from '../contexts/SocketContext'
import AdminDashboard from './AdminDashboard'

function renderDashboard() {
  return render(
    <SocketProvider>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </SocketProvider>
  )
}

afterEach(() => {
  document.body.classList.remove('admin-mode')
})

describe('AdminDashboard', () => {
  it('마운트되면 body에 admin-mode 클래스를 추가한다', () => {
    renderDashboard()
    expect(document.body.classList.contains('admin-mode')).toBe(true)
  })

  it('언마운트되면 body에서 admin-mode 클래스를 제거한다', () => {
    const { unmount } = renderDashboard()
    unmount()
    expect(document.body.classList.contains('admin-mode')).toBe(false)
  })

  it('기본적으로 그리드 뷰를 표시한다', () => {
    renderDashboard()
    expect(screen.getByText('AB1234')).toBeInTheDocument()
  })

  it('테이블 뷰 탭을 클릭하면 테이블이 표시된다', async () => {
    renderDashboard()
    await userEvent.click(screen.getByText('테이블 뷰'))
    expect(screen.getByText('팀코드')).toBeInTheDocument()
  })

  it('진행중 방 카드를 클릭하면 관전 팝업이 열린다', async () => {
    renderDashboard()
    await userEvent.click(screen.getByText('AB1234'))
    expect(screen.getByText('관전 모드입니다')).toBeInTheDocument()
  })

  it('팝업 닫기 버튼을 클릭하면 팝업이 사라진다', async () => {
    renderDashboard()
    await userEvent.click(screen.getByText('AB1234'))
    await userEvent.click(screen.getByLabelText('닫기'))
    expect(screen.queryByText('관전 모드입니다')).toBeNull()
  })
})
