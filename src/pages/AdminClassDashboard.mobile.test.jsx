import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassDashboard from './AdminClassDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { SocketProvider } from '../contexts/SocketContext'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') } }))
vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}
const ROOMS = [{
  code: 'CD5678', status: 'live', registered: false, prices: PRICES, classId: 'class-1',
  players: [{
    playerUuid: 'p1', name: '홍길동', character: 'Adventurer-강아지', affiliation: '서울중',
    gameState: {
      cash: 15000, job: 'a',
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [false, false, false, false, false, false],
      isCompleted: false,
    },
  }],
}]

function renderDashboard() {
  return render(<SocketProvider><AdminClassDashboard classId="class-1" initialName="3학년 2반" /></SocketProvider>)
}

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ROOMS) })
})

afterEach(() => {
  restoreViewport()
  clearAdminSession()
})

describe('AdminClassDashboard 모바일', () => {
  it('보기 탭과 헤더의 개별 버튼을 숨기고 전체 등록은 남긴다', async () => {
    mockViewport(390)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    expect(screen.queryByRole('button', { name: '테이블 뷰' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'QR 코드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '전체 삭제' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '전체 등록' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('이름 또는 팀 검색...')).toBeInTheDocument()
  })

  it('표를 보다가 좁히면 그리드가 나오고, 넓히면 표로 돌아온다', async () => {
    const viewport = mockViewport(1280)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    await userEvent.click(screen.getByRole('button', { name: '테이블 뷰' }))
    expect(screen.queryByTestId('admin-player-slot')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()

    viewport.resize(390)
    expect(screen.getAllByTestId('admin-player-slot').length).toBeGreaterThan(0)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    viewport.resize(1280)
    expect(screen.queryByTestId('admin-player-slot')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('유형 분포 뷰를 보다가 좁히면 결과를 불러오지 않고, 넓히면 다시 한 번 불러온다', async () => {
    const baseFetch = global.fetch
    global.fetch = vi.fn((url, options) => url.startsWith('/api/rankings')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
      : baseFetch(url, options))
    const rankingCalls = () => global.fetch.mock.calls.filter(([url]) => url.startsWith('/api/rankings')).length
    const viewport = mockViewport(1280)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    await userEvent.click(screen.getByRole('button', { name: '유형 분포 뷰' }))
    await screen.findByText('등록된 게임 결과가 없습니다.')
    expect(rankingCalls()).toBe(1)

    viewport.resize(390)
    expect(rankingCalls()).toBe(1)

    viewport.resize(1280)
    expect(rankingCalls()).toBe(2)
    await screen.findByText('등록된 게임 결과가 없습니다.')
  })

  it('전체 삭제는 메뉴를 거쳐 확인 창을 띄운다', async () => {
    mockViewport(390)
    renderDashboard()
    await screen.findAllByTestId('admin-player-slot')
    await userEvent.click(screen.getByRole('button', { name: '수업 메뉴' }))
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['QR 코드', '만족도 조사', '전체 삭제'])
    await userEvent.click(screen.getByRole('menuitem', { name: '전체 삭제' }))
    expect(screen.getByText(/모든 팀을 삭제하면 되돌릴 수 없습니다/)).toBeInTheDocument()
  })
})
