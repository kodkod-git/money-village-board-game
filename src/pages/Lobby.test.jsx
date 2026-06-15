import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn((ev, cb) => {
      if (ev === 'room-updated') {
        cb({ players: [{ name: '철수', character: 'ptsc', isHost: true, socketId: 's1' }] })
      }
    }),
    off: vi.fn(), emit: vi.fn(),
    connected: true, id: 's1',
  }
  return { io: vi.fn(() => socket) }
})

import { SocketProvider } from '../contexts/SocketContext'
import Lobby from './Lobby'

function renderLobby() {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={['/lobby/ABC123']}>
        <Routes><Route path="/lobby/:code" element={<Lobby />} /></Routes>
      </MemoryRouter>
    </SocketProvider>
  )
}

describe('Lobby', () => {
  it('팀 코드를 표시한다', () => {
    renderLobby()
    expect(screen.getByText(/ABC123/)).toBeInTheDocument()
  })

  it('참가 인원을 표시한다', () => {
    renderLobby()
    expect(screen.getByText(/1 \/ 4 명 참가/)).toBeInTheDocument()
  })

  it('참가한 플레이어 이름을 표시한다', () => {
    renderLobby()
    expect(screen.getByText('철수')).toBeInTheDocument()
  })
})
