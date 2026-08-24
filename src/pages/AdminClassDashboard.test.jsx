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

function renderDashboard() {
  return render(
    <SocketProvider>
      <AdminClassDashboard classId="class-1" initialName="3학년 2반" />
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

  it('등록된 팀이 있으면 전체 팀/미등록/등록 완료/전체 팀원 현황판을 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    expect(screen.getByText('전체 팀')).toBeInTheDocument()
    expect(screen.getByText('미등록')).toBeInTheDocument()
    expect(screen.getByText('등록 완료')).toBeInTheDocument()
    expect(screen.getByText('전체 팀원')).toBeInTheDocument()
  })

  it('등록된 팀이 없으면 현황판을 숨긴다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) })
    renderDashboard()
    await screen.findByText('등록된 팀 정보가 없습니다.')
    expect(screen.queryByText('전체 팀')).not.toBeInTheDocument()
    expect(screen.queryByText('미등록')).not.toBeInTheDocument()
    expect(screen.queryByText('등록 완료')).not.toBeInTheDocument()
    expect(screen.queryByText('전체 팀원')).not.toBeInTheDocument()
  })

  it('테이블 뷰 탭 클릭 시 테이블을 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByRole('button', { name: '테이블 뷰' }))
    expect(screen.getByText('참가자')).toBeInTheDocument()
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

  it('전체 삭제 버튼 클릭 시 확인 팝업을 보여주고, 확인 시 모든 방을 삭제한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })

    await userEvent.click(screen.getByText('전체 삭제'))
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('예'))

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms/CD5678', expect.objectContaining({
      method: 'DELETE',
    }))
  })

  it('전체 삭제 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    global.fetch.mockClear()

    await userEvent.click(screen.getByText('전체 삭제'))
    await userEvent.click(screen.getByText('아니요'))

    expect(screen.queryByText(/되돌릴 수 없습니다/)).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
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

  it('classId가 있는 수업 탭에는 방 만들기 카드를 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    expect(screen.getByText('방 만들기')).toBeInTheDocument()
  })

  it('미배정 수업(unassigned)에는 방 만들기 카드를 보여주지 않는다', async () => {
    render(
      <SocketProvider>
        <AdminClassDashboard classId="unassigned" initialName="미배정 수업" />
      </SocketProvider>
    )
    await screen.findByText('홍길동')
    expect(screen.queryByText('방 만들기')).not.toBeInTheDocument()
  })

  it('방 만들기 카드 클릭 시 현재 classId로 방을 생성하고 목록을 새로고침한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'NEW123' }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })

    await userEvent.click(screen.getByText('방 만들기'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ classId: 'class-1' }),
      })
    )
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms?classId=class-1', expect.anything())
  })

  it('방 생성에 실패하면 alert로 안내한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: '방 생성에 실패했습니다' }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    alertSpy.mockClear()

    await userEvent.click(screen.getByText('방 만들기'))

    expect(alertSpy).toHaveBeenCalledWith('방 생성에 실패했습니다')
  })

  it('네트워크 오류로 요청이 실패해도 alert를 보여준다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.reject(new Error('network error'))
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    alertSpy.mockClear()

    await userEvent.click(screen.getByText('방 만들기'))

    expect(alertSpy).toHaveBeenCalledWith('방 생성에 실패했습니다')
  })

  it('일괄 결과등록 버튼 클릭 시 현재 classId로 등록 대기 팀들을 일괄 등록하고 목록을 새로고침한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ registered: 2, total: 2 }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })

    await userEvent.click(screen.getByText('전체 등록'))
    expect(screen.getByText(/결과 등록하시겠습니까/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('예'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/classes/class-1/submit-pending',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms?classId=class-1', expect.anything())
  })

  it('전체 등록 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')
    global.fetch.mockClear()

    await userEvent.click(screen.getByText('전체 등록'))
    await userEvent.click(screen.getByText('아니요'))

    expect(screen.queryByText(/결과 등록하시겠습니까/)).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('등록 대기 중인 팀이 없으면 alert로 안내한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ registered: 0, total: 0 }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    alertSpy.mockClear()

    await userEvent.click(screen.getByText('전체 등록'))
    await userEvent.click(screen.getByText('예'))

    expect(alertSpy).toHaveBeenCalledWith('등록 대기 중인 팀이 없습니다')
  })

  it('연결 끊긴 팀원이 있는 팀은 제외되었다고 alert로 안내한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ registered: 1, total: 1, skipped: 2 }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    alertSpy.mockClear()

    await userEvent.click(screen.getByText('전체 등록'))
    await userEvent.click(screen.getByText('예'))

    expect(alertSpy).toHaveBeenCalledWith('2개 팀은 연결이 끊긴 팀원이 있어 등록되지 않았습니다')
  })

  it('일괄 결과등록이 실패하면 alert로 안내한다', async () => {
    renderDashboard()
    await screen.findByText('홍길동')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: '일괄 결과등록에 실패했습니다' }) })
      }
      return Promise.resolve({ json: () => Promise.resolve(ROOMS) })
    })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    alertSpy.mockClear()

    await userEvent.click(screen.getByText('전체 등록'))
    await userEvent.click(screen.getByText('예'))

    expect(alertSpy).toHaveBeenCalledWith('일괄 결과등록에 실패했습니다')
  })
})
