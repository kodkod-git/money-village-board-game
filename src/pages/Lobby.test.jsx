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

  it('조회된 팀을 카드로 렌더링한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 2, characters: ['c1', 'c2'] }],
    })
    renderLobby()
    expect(await screen.findByText('A3F9C1')).toBeInTheDocument()
  })

  it('팀 만들기와 코드로 참가 버튼을 렌더링한다', () => {
    renderLobby()
    expect(screen.getByText('+ 팀 만들기')).toBeInTheDocument()
    expect(screen.getByText('코드로 참가')).toBeInTheDocument()
  })

  it('코드로 참가 버튼 클릭 시 CodeModal이 열린다', () => {
    renderLobby()
    fireEvent.click(screen.getByText('코드로 참가'))
    expect(screen.getByPlaceholderText('팀 코드를 입력하세요')).toBeInTheDocument()
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
      json: async () => [{ code: 'A3F9C1', status: 'live', playerCount: 1, characters: ['c1'] }],
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(await screen.findByText('A3F9C1'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/team/A3F9C1'))
  })

  it('팀 만들기 클릭 시 방장으로 새 팀을 만들어 팀 화면으로 이동한다', async () => {
    fetch.mockImplementation((url, opts) => {
      if (opts?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ code: 'NEW001' }) })
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    const socket = io()
    socket.emit.mockImplementation((event, data, cb) => cb?.({ ok: true }))
    renderLobby()
    fireEvent.click(screen.getByText('+ 팀 만들기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/team/NEW001'))
  })
})
