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
    expect(screen.getByText('팀원 현황')).toBeInTheDocument()
  })

  it('참가한 플레이어 이름을 표시한다', () => {
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
      { playerUuid: 'p1', name: '민지', character: 'Guardian-판다', isHost: true, gameState: { isCompleted: true } },
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

  it('mockRoom의 팀 코드를 표시한다', () => {
    renderReadOnlyLobby()
    expect(screen.getByText('ZZ9999')).toBeInTheDocument()
  })

  it('mockRoom의 플레이어 이름을 표시한다', () => {
    renderReadOnlyLobby()
    expect(screen.getByText('민지')).toBeInTheDocument()
  })

  it('나가기 버튼을 렌더링하지 않는다', () => {
    renderReadOnlyLobby()
    expect(screen.queryByLabelText('팀 나가기')).toBeNull()
  })

  it('가격 설정, 결과 등록 버튼을 렌더링하지 않는다', () => {
    renderReadOnlyLobby()
    expect(screen.queryByText('가격 설정')).toBeNull()
    expect(screen.queryByText('결과 등록')).toBeNull()
  })
})
