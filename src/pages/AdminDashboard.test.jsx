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
  it('mounts with the admin-mode body class', () => {
    renderDashboard()
    expect(document.body.classList.contains('admin-mode')).toBe(true)
  })

  it('removes the admin-mode body class on unmount', () => {
    const { unmount } = renderDashboard()
    unmount()
    expect(document.body.classList.contains('admin-mode')).toBe(false)
  })

  it('shows the grid view by default without team codes', () => {
    renderDashboard()

    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.queryByText('CD5678')).not.toBeInTheDocument()
  })

  it('shows the table view when the table tab is clicked', async () => {
    renderDashboard()

    await userEvent.click(screen.getByText('테이블 뷰'))

    expect(screen.getByText('이름')).toBeInTheDocument()
    expect(screen.queryByText('팀코드')).not.toBeInTheDocument()
  })

  it('opens the spectate popup when a room card is clicked', async () => {
    renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /홍길동/ }))

    expect(screen.getByText('관전 모드입니다')).toBeInTheDocument()
  })

  it('closes the popup when the close button is clicked', async () => {
    renderDashboard()

    await userEvent.click(screen.getByRole('button', { name: /홍길동/ }))
    await userEvent.click(screen.getByLabelText('닫기'))

    expect(screen.queryByText('관전 모드입니다')).toBeNull()
  })
})
