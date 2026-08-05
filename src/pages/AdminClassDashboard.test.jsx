import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassDashboard from './AdminClassDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { SocketProvider } from '../contexts/SocketContext'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}))

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

import { io } from 'socket.io-client'

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

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'class-1', name: '새이름' }) })
    }
    return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
  })
})

afterEach(() => {
  document.body.classList.remove('admin-mode')
  clearAdminSession()
})

function renderDashboard(onBack = vi.fn()) {
  return render(
    <SocketProvider>
      <AdminClassDashboard classId="class-1" initialName="3학년 2반" onBack={onBack} />
    </SocketProvider>
  )
}

describe('AdminClassDashboard', () => {
  it('classId 쿼리와 함께 /api/admin/rooms를 호출하고 받은 팀을 그리드 뷰에 보여준다', async () => {
    renderDashboard()
    expect(await screen.findByText('홍길동')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms?classId=class-1',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
    )
  })

  it('제목이 처음엔 initialName을 보여주는 입력란이다', () => {
    renderDashboard()
    expect(screen.getByDisplayValue('3학년 2반')).toBeInTheDocument()
  })

  it('제목 옆에 편집 가능 표시 아이콘을 보여준다', () => {
    renderDashboard()
    expect(screen.getByText('✏️')).toBeInTheDocument()
  })

  it('QR 코드 버튼 클릭 시 ClassQRModal을 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('QR 코드'))
    expect(screen.getByText('3학년 2반 수업 QR 코드')).toBeInTheDocument()
  })

  it('제목을 수정하고 포커스를 벗어나면 PATCH로 저장한다', async () => {
    renderDashboard()
    const titleInput = screen.getByDisplayValue('3학년 2반')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '새이름')
    await userEvent.tab()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/classes/class-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ name: '새이름' }),
      })
    )
  })

  it('테이블 뷰 탭 클릭 시 테이블을 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('테이블 뷰'))
    expect(screen.getByText('이름')).toBeInTheDocument()
  })

  it('팀 카드 클릭 시 관전 팝업을 연다', async () => {
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /홍길동/ }))
    expect(screen.getByText('1팀')).toBeInTheDocument()
  })

  it('배경 클릭 시 팝업을 닫는다', async () => {
    const { container } = renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /홍길동/ }))
    await userEvent.click(container.querySelector('[class*="overlay"]'))
    expect(screen.queryByText('1팀')).toBeNull()
  })

  it('새로고침 버튼 클릭 시 /api/admin/rooms를 다시 호출한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    global.fetch.mockClear()
    await userEvent.click(screen.getByText('↻ 새로고침'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms?classId=class-1',
      expect.anything()
    )
  })

  it('← 수업 목록 버튼 클릭 시 onBack을 호출한다', async () => {
    const onBack = vi.fn()
    renderDashboard(onBack)
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('← 수업 목록'))
    expect(onBack).toHaveBeenCalled()
  })

  it('수업 삭제 버튼 클릭 시 확인 팝업을 보여주고, 확인 시 DELETE 요청 후 onBack을 호출한다', async () => {
    const onBack = vi.fn()
    renderDashboard(onBack)
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })

    await userEvent.click(screen.getByText('수업 삭제'))
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('정말 삭제'))

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1', expect.objectContaining({
      method: 'DELETE',
    }))
    expect(onBack).toHaveBeenCalled()
  })

  it('삭제 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    global.fetch.mockClear()

    await userEvent.click(screen.getByText('수업 삭제'))
    await userEvent.click(screen.getByText('취소'))

    expect(screen.queryByText(/되돌릴 수 없습니다/)).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('미배정 수업(unassigned)에는 삭제 버튼을 보여주지 않는다', async () => {
    render(
      <SocketProvider>
        <AdminClassDashboard classId="unassigned" initialName="미배정 수업" onBack={vi.fn()} />
      </SocketProvider>
    )
    await screen.findByText('홍길동')
    expect(screen.queryByText('수업 삭제')).not.toBeInTheDocument()
  })

  it('마운트 시 watch-class-rooms를 emit하고 언마운트 시 unwatch-class-rooms를 emit한다', async () => {
    const socket = io()
    const { unmount } = renderDashboard()
    await screen.findByText('홍길동')
    expect(socket.emit).toHaveBeenCalledWith('watch-class-rooms', { classId: 'class-1' })
    unmount()
    expect(socket.emit).toHaveBeenCalledWith('unwatch-class-rooms', { classId: 'class-1' })
  })

  it('class-rooms-updated 이벤트를 받으면 팀 목록을 다시 조회한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    const socket = io()
    const [, updateHandler] = socket.on.mock.calls.findLast(([ev]) => ev === 'class-rooms-updated')
    global.fetch.mockClear()

    updateHandler()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms?classId=class-1',
      expect.anything()
    )
  })
})
