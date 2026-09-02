import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { io } from 'socket.io-client'
import IndividualPage from './IndividualPage'
import { SocketProvider } from '../contexts/SocketContext'

const PLAYER = {
  socketId: 's1', playerUuid: 'p1', name: '김민준', character: 'Innovator-사자',
  gameState: {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    badgesVisited: false, stocksVisited: false, realEstateVisited: false, isCompleted: false,
  },
}

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  mockNavigate.mockClear()
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ players: [PLAYER], prices: {} }),
  })
})

function renderPage() {
  return render(
    <SocketProvider>
      <MemoryRouter initialEntries={['/team/AB1234/individual']}>
        <Routes>
          <Route path="/team/:code/individual" element={<IndividualPage />} />
        </Routes>
      </MemoryRouter>
    </SocketProvider>
  )
}

describe('IndividualPage', () => {
  it('직업 선택 단계를 먼저 보여준다', async () => {
    renderPage()
    expect(await screen.findByText('직업 선택')).toBeInTheDocument()
  })

  it('직업을 선택하면 다음 단계로 진행할 수 있다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('경영·금융'))
    await userEvent.click(screen.getByText('다음'))
    expect(await screen.findByRole('heading', { name: '성공카드' })).toBeInTheDocument()
  })

  it('직업을 선택하지 않아도 "다음"이 활성화되어 있고, 눌러서 진행할 수 있다 (무직)', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    const next = screen.getByText('다음')
    expect(next).not.toBeDisabled()
    await userEvent.click(next)
    expect(await screen.findByRole('heading', { name: '성공카드' })).toBeInTheDocument()
  })

  it('직업 미선택으로 "다음"을 누르면 jobVisited: true, job: null을 emit한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('다음'))
    await screen.findByRole('heading', { name: '성공카드' })

    const socket = io()
    const emitted = socket.emit.mock.calls
      .filter(([event]) => event === 'update-player-state')
      .map(([, payload]) => payload.gameState)
    expect(emitted.some(gs => gs.jobVisited === true && gs.job === null)).toBe(true)
  })

  it('소켓이 재연결되면 참가자 정보를 다시 불러온다', async () => {
    renderPage()
    await screen.findByText('직업 선택')

    const socket = io()
    const [, connectHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'connect')

    fetch.mockClear()
    connectHandler()

    expect(fetch).toHaveBeenCalledWith('/api/rooms/AB1234')
  })

  it('추방당하면 안내 모달을 띄우고, 확인을 눌러야 저장된 프로필로 로비로 이동한다', async () => {
    sessionStorage.setItem('player_profile', JSON.stringify({
      code: 'AB1234', name: '김민준', character: 'Innovator-사자', affiliation: '', classId: 'class-1',
    }))
    renderPage()
    await screen.findByText('직업 선택')

    const socket = io()
    const [, kickedHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'you-were-kicked')
    act(() => kickedHandler())

    expect(screen.getByText(/내보냈어요|강퇴/)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringMatching(/^\/lobby\?/))

    await userEvent.click(screen.getByRole('button', { name: '확인' }))

    const [calledWith] = mockNavigate.mock.calls.find(([url]) => url.startsWith('/lobby?'))
    expect(calledWith).toContain('classId=class-1')
  })

  it('직업만 선택한 상태로 재입장하면 아직 방문하지 않은 단계는 완료 표시되지 않는다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        players: [{ ...PLAYER, gameState: { ...PLAYER.gameState, job: 'a' } }],
        prices: {},
      }),
    })
    renderPage()
    await screen.findByText('직업 선택')
    expect(screen.getByText('현금').closest('button')).toBeDisabled()
    expect(screen.getByText('성공카드').closest('button')).toBeDisabled()
  })

  it('무직(job:null, jobVisited:true)으로 재입장하면 직업 단계가 완료로 표시된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        players: [{ ...PLAYER, gameState: { ...PLAYER.gameState, job: null, jobVisited: true } }],
        prices: {},
      }),
    })
    renderPage()
    await screen.findByText('직업 선택')
    expect(screen.getByText('직업').closest('button')).not.toBeDisabled()
    expect(screen.getByText('성공카드').closest('button')).toBeDisabled()
  })

  it('값 변경 없이 "다음"만 눌러 성공카드 단계를 지나가도 badgesVisited가 저장된다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByText('경영·금융'))
    await userEvent.click(screen.getByText('다음'))
    await screen.findByRole('heading', { name: '성공카드' })
    await userEvent.click(screen.getByText('다음'))
    await screen.findByRole('heading', { name: '부동산' })

    const socket = io()
    const emittedStates = socket.emit.mock.calls
      .filter(([event]) => event === 'update-player-state')
      .map(([, payload]) => payload.gameState)
    expect(emittedStates.some(gs => gs.badgesVisited === true)).toBe(true)
  })

  it('뒤로가기 버튼을 누르면 바로 이동하지 않고 확인 팝업이 뜬다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByText(/입력 도중에 뒤로가기 버튼을 누르는 경우/)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('확인 팝업에서 취소를 누르면 화면에 남는다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    await userEvent.click(screen.getByText('취소'))
    expect(screen.queryByText(/입력 도중에 뒤로가기 버튼을 누르는 경우/)).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('확인 팝업에서 이동을 누르면 이전 화면으로 이동한다', async () => {
    renderPage()
    await screen.findByText('직업 선택')
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    await userEvent.click(screen.getByText('이동'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
