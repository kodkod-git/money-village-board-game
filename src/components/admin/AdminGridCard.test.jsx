import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminGridCard from './AdminGridCard'
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makeRoom(overrides = {}) {
  return {
    code: 'AB1234',
    registered: false,
    prices: PRICES,
    players: [{ character: 'Adventurer-강아지', name: '김민준' }],
    ...overrides,
  }
}

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
})

afterEach(() => {
  clearAdminSession()
})

describe('AdminGridCard', () => {
  it('팀코드를 보여준다', () => {
    render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
    expect(screen.getByText('AB1234')).toBeInTheDocument()
  })

  it('room.title이 있으면 제목을 보여준다', () => {
    render(<AdminGridCard room={makeRoom({ title: 'TEAM 1' })} onSpectate={vi.fn()} />)
    expect(screen.getByText('TEAM 1')).toBeInTheDocument()
  })

  it('room.title이 없으면 팀 순번으로 표시한다', () => {
    render(<AdminGridCard room={makeRoom()} index={2} onSpectate={vi.fn()} />)
    expect(screen.getByText('팀 3')).toBeInTheDocument()
    expect(screen.queryByText(/^TEAM /)).not.toBeInTheDocument()
  })

  it('플레이어 이름을 보여준다', () => {
    render(<AdminGridCard room={makeRoom({
      players: [
        { character: 'Innovator-코끼리', name: '이서연' },
        { character: 'Planner-개미', name: '박도윤' },
      ],
    })} onSpectate={vi.fn()} />)
    expect(screen.getByText('이서연')).toBeInTheDocument()
    expect(screen.getByText('박도윤')).toBeInTheDocument()
  })

  it('4개의 고정된 플레이어 슬롯을 보여준다', () => {
    const { container } = render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
    expect(container.querySelectorAll('[data-testid="admin-player-slot"]')).toHaveLength(4)
  })

  it('로비 탭(기본)에서 카드를 클릭하면 onSpectate를 호출한다', async () => {
    const onSpectate = vi.fn()
    const room = makeRoom()
    render(<AdminGridCard room={room} onSpectate={onSpectate} />)
    await userEvent.click(screen.getByRole('button', { name: /김민준/ }))
    expect(onSpectate).toHaveBeenCalledWith(room)
  })

  it('stale 상태 방에는 정체 배지를 보여준다', () => {
    render(<AdminGridCard room={makeRoom({ status: 'stale' })} onSpectate={vi.fn()} />)
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  it('abandoned 상태 방에는 방치 배지를 보여준다', () => {
    render(<AdminGridCard room={makeRoom({ status: 'abandoned' })} onSpectate={vi.fn()} />)
    expect(screen.getByText('방치')).toBeInTheDocument()
  })

  it('completed-but-unregistered 상태 방에는 등록 대기 배지를 보여준다', () => {
    render(<AdminGridCard room={makeRoom({ status: 'completed-but-unregistered' })} onSpectate={vi.fn()} />)
    expect(screen.getByText('등록 대기')).toBeInTheDocument()
  })

  it('live 상태 방에는 미입력 배지를 보여준다', () => {
    render(<AdminGridCard room={makeRoom({ status: 'live' })} onSpectate={vi.fn()} />)
    expect(screen.getByText('미입력')).toBeInTheDocument()
  })

  it('등록 완료된 방에는 등록 완료 배지를 보여준다', () => {
    render(<AdminGridCard room={makeRoom({ registered: true })} onSpectate={vi.fn()} />)
    expect(screen.getByText('등록 완료')).toBeInTheDocument()
  })

  it('등록 완료된 방이라도 주식/부동산 탭에서는 등록 완료 배지를 보여주지 않는다', async () => {
    render(<AdminGridCard room={makeRoom({ registered: true })} onSpectate={vi.fn()} />)
    await userEvent.click(screen.getByText('주식'))
    expect(screen.queryByText('등록 완료')).not.toBeInTheDocument()
  })

  it('연결이 끊긴 플레이어에는 연결 끊김 표시를 보여준다', () => {
    render(<AdminGridCard room={makeRoom({
      players: [{ character: 'Adventurer-강아지', name: '김민준', connected: false }],
    })} onSpectate={vi.fn()} />)
    expect(screen.getByText('연결 끊김')).toBeInTheDocument()
  })

  it('연결이 유지된 플레이어에는 연결 끊김 표시를 보여주지 않는다', () => {
    render(<AdminGridCard room={makeRoom({
      players: [{ character: 'Adventurer-강아지', name: '김민준', connected: true }],
    })} onSpectate={vi.fn()} />)
    expect(screen.queryByText('연결 끊김')).not.toBeInTheDocument()
  })

  describe('가격 탭', () => {
    it('주식 탭을 누르면 주식 가격 목록으로 바뀐다', async () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      await userEvent.click(screen.getByText('주식'))
      expect(screen.getByText('반도체 IT')).toBeInTheDocument()
      expect(screen.getAllByText('2,000원').length).toBeGreaterThan(0)
    })

    it('부동산 탭을 누르면 부동산 가격 목록으로 바뀐다', async () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      await userEvent.click(screen.getByText('부동산'))
      expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
      expect(screen.getAllByText('10,000원').length).toBeGreaterThan(0)
    })

    it('주식 탭에서 카드를 클릭하면 onSpectate 대신 가격 설정 팝업이 열린다', async () => {
      const onSpectate = vi.fn()
      render(<AdminGridCard room={makeRoom()} onSpectate={onSpectate} />)
      await userEvent.click(screen.getByText('주식'))
      await userEvent.click(screen.getByText('반도체 IT'))
      expect(onSpectate).not.toHaveBeenCalled()
      expect(screen.getByText('가격 설정')).toBeInTheDocument()
    })

    it('부동산 탭에서 카드를 클릭하면 부동산 카테고리가 선택된 가격 설정 팝업이 열린다', async () => {
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} />)
      await userEvent.click(screen.getByText('부동산'))
      await userEvent.click(screen.getAllByText('공동 가온개미')[0])
      expect(screen.getByText('가격 설정')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /10,000 원/ }).length).toBe(6)
      expect(screen.queryByText('반도체 IT')).not.toBeInTheDocument()
    })

    it('가격 설정 팝업에서 확인하면 PATCH 요청을 보내고 onRoomChanged를 호출한다', async () => {
      const onRoomChanged = vi.fn()
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ prices: PRICES }) })
      render(<AdminGridCard room={makeRoom()} onSpectate={vi.fn()} onRoomChanged={onRoomChanged} />)

      await userEvent.click(screen.getByText('주식'))
      await userEvent.click(screen.getByText('반도체 IT'))
      await userEvent.click(screen.getByText('확인하기'))

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/rooms/AB1234/prices',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify(PRICES),
        })
      )
      expect(onRoomChanged).toHaveBeenCalled()
    })
  })
})
