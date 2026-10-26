import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CompetitionPlay from './CompetitionPlay'
import { SocketProvider } from '../contexts/SocketContext'
import { defaultGameState } from '../components/AssetInputSteps'

const { socket } = vi.hoisted(() => ({
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' },
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let joinResponse
beforeEach(() => {
  mockNavigate.mockClear()
  socket.on.mockClear()
  socket.emit.mockReset()
  socket.emit.mockImplementation((event, _data, callback) => {
    if (event === 'join-class-pool') callback(joinResponse)
  })
  joinResponse = { ok: true, state: 'pool', gameState: defaultGameState(), sessionId: null }
})

function renderPage(path = '/compete/class-1?name=철수&affiliation=서울초&character=Innovator-사자') {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/compete/:classId" element={<CompetitionPlay />} />
        </Routes>
      </MemoryRouter>
    </SocketProvider>
  )
}

function socketHandler(event) {
  return socket.on.mock.calls.findLast(([ev]) => ev === event)?.[1]
}

describe('CompetitionPlay', () => {
  it('대기 명단에 들어가 자산을 입력하고, 바뀔 때마다 서버에 저장한다', async () => {
    renderPage()
    expect(await screen.findByText('직업 선택')).toBeInTheDocument()
    expect(socket.emit).toHaveBeenCalledWith('join-class-pool', expect.objectContaining({
      classId: 'class-1', name: '철수', affiliation: '서울초', character: 'Innovator-사자', playerUuid: expect.any(String),
    }), expect.any(Function))

    await userEvent.click(screen.getByText('다음'))
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      classId: 'class-1', gameState: expect.objectContaining({ jobVisited: true }),
    }))
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식 가격' })).toBeInTheDocument()
  })

  it('가격이 없는 참여자는 기본 가격으로 채워서 보여준다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getAllByText('2,000')).toHaveLength(3)
  })

  it('다시 입력하기를 눌러도 정한 가격은 그대로 둔다', async () => {
    const prices = {
      stocks: { semiconductor: 7000, finance: 2000, bio: 2000 },
      realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
    }
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), prices, isCompleted: true } }
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '다시 입력하기' }))
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ isCompleted: false, prices }),
    }))
  })

  it('입력을 마친 상태면 캐릭터·이름·안내 문구가 있는 대기 화면을 보여준다', async () => {
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), isCompleted: true } }
    renderPage()
    expect(await screen.findByText('결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요')).toBeInTheDocument()
    expect(screen.getByText('철수')).toBeInTheDocument()
    expect(screen.getByAltText('철수')).toHaveAttribute('src', '/characters/Innovator-사자.png')
  })

  it('다시 입력하기를 누르면 입력 중으로 저장하고 입력 단계로 돌아간다', async () => {
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), isCompleted: true } }
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '다시 입력하기' }))
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ isCompleted: false }),
    }))
    expect(screen.getByText('직업 선택')).toBeInTheDocument()
  })

  it('현금 단계에서 완료를 누르면 대기 화면으로 바뀐다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    for (let i = 0; i < 6; i++) await userEvent.click(screen.getByText('다음'))
    await userEvent.click(screen.getByText('완료'))
    expect(screen.getByText('결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요')).toBeInTheDocument()
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ isCompleted: true }),
    }))
  })

  it('결과가 등록되면(game-submitted) 결과 화면으로 이동한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    act(() => socketHandler('game-submitted')({ sessionId: 'session-1' }))
    expect(mockNavigate).toHaveBeenCalledWith('/result/session-1')
  })

  it('다시 들어왔을 때 이미 결과가 등록됐으면 결과 화면으로 보낸다', async () => {
    joinResponse = { ok: true, state: 'submitted', gameState: null, sessionId: 'session-9' }
    renderPage()
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/result/session-9', { replace: true }))
  })

  it('일반 모드 수업이면 로비로 보낸다', async () => {
    joinResponse = { ok: false, error: 'NOT_COMPETITION' }
    renderPage()
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/lobby\?.*classId=class-1/), { replace: true }))
  })

  it('관리자가 명단에서 삭제하면 안내 후 QR 첫 화면으로 보낸다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    act(() => socketHandler('you-were-kicked')())
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(mockNavigate).toHaveBeenCalledWith('/join?classId=class-1')
  })

  it('재접속하면 서버의 예전 상태로 덮어쓰지 않고 화면의 최신 입력을 다시 저장한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '성공열쇠' })).toBeInTheDocument()

    // 서버는 끊긴 동안의 저장을 받지 못해 예전(기본) 상태를 돌려준다
    act(() => socketHandler('connect')())

    expect(screen.getByRole('heading', { name: '성공열쇠' })).toBeInTheDocument()
    expect(socket.emit).toHaveBeenLastCalledWith('update-pool-player-state', expect.objectContaining({
      gameState: expect.objectContaining({ jobVisited: true }),
    }))
  })

  it('관리자가 수정해 보낸 상태(player-state-updated)를 반영한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    act(() => socketHandler('player-state-updated')({ gameState: { ...defaultGameState(), isCompleted: true } }))
    expect(screen.getByText('결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요')).toBeInTheDocument()
  })

  it('재접속했을 때 서버가 입력 완료로 바꿔 놓았으면 화면 상태로 덮어쓰지 않고 서버 상태를 따른다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('다음'))
    socket.emit.mockClear()
    joinResponse = { ...joinResponse, gameState: { ...defaultGameState(), isCompleted: true } }

    act(() => socketHandler('connect')())

    expect(screen.getByText('결과가 곧 나올 예정이니, 나가거나 화면을 끄지 마시고 조금만 기다려주세요')).toBeInTheDocument()
    expect(socket.emit).not.toHaveBeenCalledWith('update-pool-player-state', expect.anything())
  })

  it('명단에서 삭제된 뒤 재접속해도 다시 들어가지 않는다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    act(() => socketHandler('you-were-kicked')())
    socket.emit.mockClear()
    act(() => socketHandler('connect')())
    expect(socket.emit).not.toHaveBeenCalledWith('join-class-pool', expect.anything(), expect.anything())
  })

  it('이름이나 캐릭터가 없으면 QR 첫 화면으로 보낸다', async () => {
    renderPage('/compete/class-1')
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/join?classId=class-1', { replace: true }))
  })
})
