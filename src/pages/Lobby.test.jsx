import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'

const DEFAULT_PLAYERS = [{ name: '철수', character: 'Adventurer-강아지', isHost: true, socketId: 's1' }]
let mockRoomUpdatePlayers = DEFAULT_PLAYERS

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn((ev, cb) => {
      if (ev === 'room-updated') {
        cb({ players: mockRoomUpdatePlayers })
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
  afterEach(() => {
    mockRoomUpdatePlayers = DEFAULT_PLAYERS
  })

  it('shows the team code', () => {
    renderLobby()
    expect(screen.getByText(/ABC123/)).toBeInTheDocument()
  })

  it('shows joined player names', () => {
    renderLobby()
    expect(screen.getByText('철수')).toBeInTheDocument()
  })

  it('방장이 아니어도 QR 코드가 보인다', () => {
    mockRoomUpdatePlayers = [
      { name: '영희', character: 'Guardian-판다', isHost: true, socketId: 's2' },
      { name: '철수', character: 'Adventurer-강아지', isHost: false, socketId: 's1' },
    ]
    renderLobby()
    expect(screen.getByText('QR 코드')).toBeInTheDocument()
  })

  it('방장이 아니면 결과 등록 버튼이 보이지만 비활성화된다', () => {
    mockRoomUpdatePlayers = [
      { name: '영희', character: 'Guardian-판다', isHost: true, socketId: 's2' },
      { name: '철수', character: 'Adventurer-강아지', isHost: false, socketId: 's1' },
    ]
    renderLobby()
    expect(screen.getByText('결과 등록')).toBeDisabled()
  })

  it('내 카드만 클릭 가능하고, 다른 팀원 카드는 클릭할 수 없다', () => {
    mockRoomUpdatePlayers = [
      { name: '철수', character: 'Adventurer-강아지', isHost: true, socketId: 's1' },
      { name: '영희', character: 'Guardian-판다', isHost: false, socketId: 's2' },
    ]
    renderLobby()
    const myCard = screen.getByText('철수').closest('[role]')
    const otherCard = screen.getByText('영희').closest('[role]')
    expect(myCard).toHaveAttribute('role', 'button')
    expect(otherCard).toBeNull()
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

describe('Lobby price setting modal', () => {
  it('가격 설정 버튼을 누르면 팝업이 열리고 기본으로 주식 목록이 보인다', async () => {
    renderLobby()
    await userEvent.click(screen.getByText('가격 설정'))
    expect(screen.getByText('반도체 IT')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    renderLobby()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
  })

  it('가격 pill을 누르면 숫자 입력 팝업이 열리고, 확인하면 가격이 갱신된다', async () => {
    renderLobby()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체 IT' })).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByRole('button', { name: /9,000 원/ })).toBeInTheDocument()
  })
})
