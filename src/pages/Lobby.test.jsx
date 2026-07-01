import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn((ev, cb) => {
      if (ev === 'room-updated') {
        cb({ players: [{ name: '철수', character: 'Adventurer-강아지', isHost: true, socketId: 's1' }] })
      }
    }),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
    id: 's1',
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
  it('shows the team code', () => {
    renderLobby()
    expect(screen.getByText(/ABC123/)).toBeInTheDocument()
  })

  it('shows joined player names', () => {
    renderLobby()
    expect(screen.getByText('철수')).toBeInTheDocument()
  })
})

describe('Lobby readOnly mode', () => {
  const mockRoom = {
    code: 'ZZ9999',
    prices: {
      stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
      realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
    },
    players: [
      { playerUuid: 'p1', name: '민서', character: 'Guardian-판다', isHost: true, gameState: { isCompleted: true } },
    ],
  }

  function renderReadOnlyLobby() {
    return render(
      <SocketProvider>
        <MemoryRouter>
          <Lobby readOnly mockRoom={mockRoom} />
        </MemoryRouter>
      </SocketProvider>
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows mock room code and player names', () => {
    renderReadOnlyLobby()

    expect(screen.getByText('ZZ9999')).toBeInTheDocument()
    expect(screen.getByText('민서')).toBeInTheDocument()
  })

  it('does not show the leave button', () => {
    renderReadOnlyLobby()
    expect(screen.queryByLabelText('팀 나가기')).toBeNull()
  })

  it('does not fetch live room data', () => {
    vi.stubGlobal('fetch', vi.fn())
    renderReadOnlyLobby()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the QR card in readOnly mode', () => {
    renderReadOnlyLobby()
    expect(screen.getByText('QR 코드')).toBeInTheDocument()
  })

  it('renders the QR preview as an in-browser data image', async () => {
    renderReadOnlyLobby()

    const qrImage = screen.getByAltText('QR 코드')

    await waitFor(() => {
      expect(qrImage).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
    })
  })

  it('shows price and result actions in readOnly mode', () => {
    renderReadOnlyLobby()
    expect(screen.getByText('가격 설정')).toBeInTheDocument()
    expect(screen.getByText('결과 등록')).toBeInTheDocument()
  })
})
