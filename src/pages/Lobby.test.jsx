import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

import { io } from 'socket.io-client'
import { SocketProvider } from '../contexts/SocketContext'
import Lobby from './Lobby'

function renderLobby(path = '/lobby?classId=class-1&name=철수&character=c1') {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={[path]}>
        <Lobby />
      </MemoryRouter>
    </SocketProvider>
  )
}

describe('Lobby (team grid)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    fetch.mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('마운트 시 classId로 팀 목록을 조회한다', async () => {
    renderLobby()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/rooms?classId=class-1'))
  })

  it('조회된 팀을 방장 닉네임이 담긴 카드로 렌더링한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 2, characters: ['c1', 'c2'], hostName: '영희' }],
    })
    renderLobby()
    expect(await screen.findByText('영희님의 방')).toBeInTheDocument()
  })

  it('방 만들기 카드를 렌더링하고, 코드로 참가 버튼은 더 이상 없다', () => {
    renderLobby()
    expect(screen.getByText('방 만들기')).toBeInTheDocument()
    expect(screen.queryByText('코드로 참가')).toBeNull()
  })

  it('방 만들기 카드는 팀 목록 뒤 맨 마지막에 위치한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'], hostName: '영희' },
        { code: 'B1B1B1', status: 'live', playerCount: 1, characters: ['c1'], hostName: '민수' },
      ],
    })
    renderLobby()
    await screen.findByText('민수님의 방')
    const buttons = screen.getAllByRole('button').map(btn => btn.textContent)
    expect(buttons.at(-1)).toContain('방 만들기')
  })

  it('URL에 code가 있으면 CodeModal이 자동으로 열린다', () => {
    renderLobby('/lobby?classId=class-1&name=철수&character=c1&code=ABC123')
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
  })

  it('마운트 시 watch-class-rooms를 emit하고 언마운트 시 unwatch-class-rooms를 emit한다', () => {
    const socket = io()
    const { unmount } = renderLobby()
    expect(socket.emit).toHaveBeenCalledWith('watch-class-rooms', { classId: 'class-1' })
    unmount()
    expect(socket.emit).toHaveBeenCalledWith('unwatch-class-rooms', { classId: 'class-1' })
  })

  it('class-rooms-updated 이벤트를 받으면 목록을 다시 조회한다', async () => {
    renderLobby()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const socket = io()
    const [, updateHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'class-rooms-updated')
    fetch.mockClear()
    updateHandler()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/rooms?classId=class-1'))
  })

  it('카드를 클릭하면 join-room을 emit하고 팀 화면으로 이동한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'], hostName: '영희' }],
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(await screen.findByText('영희님의 방'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/team/A3F9C1'))
  })

  it('방 만들기 클릭 시 방장으로 새 팀을 만들어 팀 화면으로 이동한다', async () => {
    fetch.mockImplementation((url, opts) => {
      if (opts?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ code: 'NEW001' }) })
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(screen.getByText('방 만들기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/team/NEW001'))
  })

  it('이미 참여했던 방을 다시 클릭하면 기존 playerUuid를 재사용한다(중복 참가 방지)', async () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      name: '철수', character: 'c1', code: 'A3F9C1', isHost: false, classId: 'class-1',
    }))
    sessionStorage.setItem('player_uuid', 'existing-uuid')
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'], hostName: '영희' }],
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(await screen.findByText('영희님의 방'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())

    const [, payload] = socket.emit.mock.calls.find(([ev]) => ev === 'join-room')
    expect(payload.playerUuid).toBe('existing-uuid')
  })

  it('다른 방에서 왔거나 처음 참여하면 새 playerUuid를 발급한다', async () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      name: '철수', character: 'c1', code: 'OTHER1', isHost: false, classId: 'class-1',
    }))
    sessionStorage.setItem('player_uuid', 'stale-uuid')
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'], hostName: '영희' }],
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(await screen.findByText('영희님의 방'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())

    const [, payload] = socket.emit.mock.calls.find(([ev]) => ev === 'join-room')
    expect(payload.playerUuid).not.toBe('stale-uuid')
  })

  it('카드를 연속으로 두 번 클릭해도 join-room은 한 번만 emit된다(중복 클릭 방지)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'], hostName: '영희' }],
    })
    const socket = io()
    socket.emit.mockImplementation(() => {}) // ack never fires, simulating a still-pending request
    renderLobby()
    const card = await screen.findByText('영희님의 방')
    fireEvent.click(card)
    fireEvent.click(card)

    const joinCalls = socket.emit.mock.calls.filter(([ev]) => ev === 'join-room')
    expect(joinCalls).toHaveLength(1)
  })

  it('방 만들기를 연속으로 두 번 클릭해도 방은 한 번만 생성된다(중복 클릭 방지)', () => {
    fetch.mockImplementation((url, opts) => {
      if (opts?.method === 'POST') return new Promise(() => {}) // still-pending POST
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    renderLobby()
    const createBtn = screen.getByText('방 만들기')
    fireEvent.click(createBtn)
    fireEvent.click(createBtn)

    const postCalls = fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST')
    expect(postCalls).toHaveLength(1)
  })
})
