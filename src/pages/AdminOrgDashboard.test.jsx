import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminOrgDashboard from './AdminOrgDashboard'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const ROOMS = [{
  code: 'CD5678', status: 'live', registered: false, prices: PRICES, affiliation: '경영학과',
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
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(ROOMS) })
})

afterEach(() => {
  document.body.classList.remove('admin-mode')
  clearAdminSession()
})

function renderDashboard(onBack = vi.fn()) {
  return render(<AdminOrgDashboard org="경영학과" onBack={onBack} />)
}

describe('AdminOrgDashboard', () => {
  it('마운트 시 admin-mode 바디 클래스를 추가한다', async () => {
    renderDashboard()
    expect(document.body.classList.contains('admin-mode')).toBe(true)
    await screen.findByText('홍길동')
  })

  it('언마운트 시 admin-mode 바디 클래스를 제거한다', () => {
    const { unmount } = renderDashboard()
    unmount()
    expect(document.body.classList.contains('admin-mode')).toBe(false)
  })

  it('org 쿼리와 함께 /api/admin/rooms를 호출하고 받은 팀을 그리드 뷰에 보여준다', async () => {
    renderDashboard()
    expect(await screen.findByText('홍길동')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms?org=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
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
      '/api/admin/rooms?org=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC',
      expect.anything()
    )
  })

  it('← 소속 목록 버튼 클릭 시 onBack을 호출한다', async () => {
    const onBack = vi.fn()
    renderDashboard(onBack)
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByText('← 소속 목록'))
    expect(onBack).toHaveBeenCalled()
  })
})
