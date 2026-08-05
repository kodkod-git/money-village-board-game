import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'

const DEFAULT_PLAYERS = [{ name: '철수', character: 'Adventurer-강아지', isHost: true, socketId: 's1' }]
let mockRoomUpdatePlayers = DEFAULT_PLAYERS

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

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

import { io } from 'socket.io-client'
import { SocketProvider } from '../contexts/SocketContext'
import Team from './Team'

function renderTeam() {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={['/team/ABC123']}>
        <Routes><Route path="/team/:code" element={<Team />} /></Routes>
      </MemoryRouter>
    </SocketProvider>
  )
}

describe('Team', () => {
  afterEach(() => {
    mockRoomUpdatePlayers = DEFAULT_PLAYERS
    sessionStorage.clear()
  })

  it('shows the team code', () => {
    renderTeam()
    expect(screen.getByText(/ABC123/)).toBeInTheDocument()
  })

  it('shows joined player names', () => {
    renderTeam()
    expect(screen.getByText('철수')).toBeInTheDocument()
  })

  it('방장이 아니어도 QR 코드가 보인다', () => {
    mockRoomUpdatePlayers = [
      { name: '영희', character: 'Guardian-판다', isHost: true, socketId: 's2' },
      { name: '철수', character: 'Adventurer-강아지', isHost: false, socketId: 's1' },
    ]
    renderTeam()
    expect(screen.getByText('QR 코드')).toBeInTheDocument()
  })

  it('방장이 아니면 결과 등록 버튼이 보이지만 비활성화된다', () => {
    mockRoomUpdatePlayers = [
      { name: '영희', character: 'Guardian-판다', isHost: true, socketId: 's2' },
      { name: '철수', character: 'Adventurer-강아지', isHost: false, socketId: 's1' },
    ]
    renderTeam()
    expect(screen.getByText('결과 등록')).toBeDisabled()
  })

  it('내 카드만 클릭 가능하고, 다른 팀원 카드는 클릭할 수 없다', () => {
    mockRoomUpdatePlayers = [
      { name: '철수', character: 'Adventurer-강아지', isHost: true, socketId: 's1' },
      { name: '영희', character: 'Guardian-판다', isHost: false, socketId: 's2' },
    ]
    renderTeam()
    const myCard = screen.getByText('철수').closest('[role]')
    const otherCard = screen.getByText('영희').closest('[role]')
    expect(myCard).toHaveAttribute('role', 'button')
    expect(otherCard).toBeNull()
  })

  it('소켓이 재연결되면 저장된 프로필로 join-room을 다시 보낸다', () => {
    renderTeam()
    const socket = io()
    const [, connectHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'connect')

    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'ABC123', name: '철수', character: 'Adventurer-강아지', affiliation: '', isHost: true,
    }))
    sessionStorage.setItem('player_uuid', 'p1')
    socket.emit.mockClear()

    connectHandler()

    expect(socket.emit).toHaveBeenCalledWith('join-room', {
      code: 'ABC123', name: '철수', affiliation: '', character: 'Adventurer-강아지', isHost: true, playerUuid: 'p1',
    })
  })

  it('저장된 프로필의 방 코드가 다르면 재연결 시 join-room을 보내지 않는다', () => {
    renderTeam()
    const socket = io()
    const [, connectHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'connect')

    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'OTHER1', name: '철수', character: 'Adventurer-강아지', affiliation: '', isHost: true,
    }))
    sessionStorage.setItem('player_uuid', 'p1')
    socket.emit.mockClear()

    connectHandler()

    expect(socket.emit).not.toHaveBeenCalledWith('join-room', expect.anything())
  })

  it('추방당하면 저장된 프로필 정보를 담아 로비로 이동한다', () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'ABC123', name: '철수', character: 'Adventurer-강아지', affiliation: '경영학과', isHost: false, classId: 'class-1',
    }))
    renderTeam()
    const socket = io()
    const [, kickedHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'you-were-kicked')

    kickedHandler()

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/lobby?'))
    const [calledWith] = mockNavigate.mock.calls[0]
    expect(calledWith).toContain('classId=class-1')
    expect(calledWith).toContain('name=%EC%B2%A0%EC%88%98')
    expect(calledWith).toContain('character=Adventurer-%EA%B0%95%EC%95%84%EC%A7%80')
  })

  it('처음으로 돌아가는 아이콘 버튼은 더 이상 없다', () => {
    renderTeam()
    expect(screen.queryByLabelText('팀 나가기')).toBeNull()
  })

  it('뒤로가기 버튼을 누르면 바로 나가지 않고 확인 팝업이 뜬다', () => {
    renderTeam()
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByText(/현재 방을 나가시겠습니까/)).toBeInTheDocument()
    const socket = io()
    expect(socket.emit).not.toHaveBeenCalledWith('leave-room')
  })

  it('확인 팝업에서 취소를 누르면 방에 남는다', () => {
    renderTeam()
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    fireEvent.click(screen.getByText('취소'))
    expect(screen.queryByText(/현재 방을 나가시겠습니까/)).toBeNull()
    const socket = io()
    expect(socket.emit).not.toHaveBeenCalledWith('leave-room')
  })

  it('확인 팝업에서 나가기를 누르면 leave-room을 emit하고 저장된 프로필로 로비로 이동한다', () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'ABC123', name: '철수', character: 'Adventurer-강아지', affiliation: '', isHost: true, classId: 'class-1',
    }))
    renderTeam()
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    fireEvent.click(screen.getByText('나가기'))

    const socket = io()
    expect(socket.emit).toHaveBeenCalledWith('leave-room')
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/lobby?'))
    const [calledWith] = mockNavigate.mock.calls.at(-1)
    expect(calledWith).toContain('classId=class-1')
  })

  it('방장이 나가서 방이 삭제되면 안내 후 저장된 프로필로 로비로 이동한다', () => {
    vi.stubGlobal('alert', vi.fn())
    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'ABC123', name: '영희', character: 'Guardian-판다', affiliation: '', isHost: false, classId: 'class-1',
    }))
    renderTeam()
    const socket = io()
    const [, closedHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'room-closed')

    closedHandler()

    expect(alert).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/lobby?'))
    const [calledWith] = mockNavigate.mock.calls.at(-1)
    expect(calledWith).toContain('classId=class-1')
    vi.unstubAllGlobals()
  })
})

describe('Team readOnly mode', () => {
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

  function renderReadOnlyTeam() {
    return render(
      <SocketProvider>
        <MemoryRouter>
          <Team readOnly mockRoom={mockRoom} />
        </MemoryRouter>
      </SocketProvider>
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows mock room code and player names', () => {
    renderReadOnlyTeam()

    expect(screen.getByText('ZZ9999')).toBeInTheDocument()
    expect(screen.getByText('민서')).toBeInTheDocument()
  })

  it('does not show the leave button', () => {
    renderReadOnlyTeam()
    expect(screen.queryByLabelText('팀 나가기')).toBeNull()
  })

  it('does not fetch live room data', () => {
    vi.stubGlobal('fetch', vi.fn())
    renderReadOnlyTeam()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the QR card in readOnly mode', () => {
    renderReadOnlyTeam()
    expect(screen.getByText('QR 코드')).toBeInTheDocument()
  })

  it('renders the QR preview as an in-browser data image', async () => {
    renderReadOnlyTeam()

    const qrImage = screen.getByAltText('QR 코드')

    await waitFor(() => {
      expect(qrImage).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
    })
  })

  it('shows price and result actions in readOnly mode', () => {
    renderReadOnlyTeam()
    expect(screen.getByText('가격 설정')).toBeInTheDocument()
    expect(screen.getByText('결과 등록')).toBeInTheDocument()
  })
})

describe('Team price setting modal', () => {
  it('가격 설정 버튼을 누르면 팝업이 열리고 기본으로 주식 목록이 보인다', async () => {
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    expect(screen.getByText('반도체 IT')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
  })

  it('가격 pill을 누르면 숫자 입력 팝업이 열리고, 확인하면 가격이 갱신된다', async () => {
    renderTeam()
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

  it('가격 입력값이 100만원을 초과하면 확인 시 100만원으로 제한된다', async () => {
    renderTeam()
    await userEvent.click(screen.getByText('가격 설정'))
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체 IT' })).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    for (let i = 0; i < 7; i++) {
      await userEvent.click(screen.getByRole('button', { name: '9' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByRole('button', { name: /1,000,000 원/ })).toBeInTheDocument()
  })
})
