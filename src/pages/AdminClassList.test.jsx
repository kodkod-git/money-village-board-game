import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassList from './AdminClassList'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

const CLASSES = [
  { id: 'class-1', name: '3학년 2반', kind: 'class', createdAt: '2026-07-27T00:00:00.000Z' },
  { id: 'contest-1', name: '2026 시즌1', kind: 'official', createdAt: '2026-11-12T00:00:00.000Z' },
  { id: 'unassigned', name: '미배정 수업', kind: 'class' },
]

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(CLASSES) })
})

afterEach(() => clearAdminSession())

describe('AdminClassList', () => {
  it('제목은 게임 목록이다', () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    expect(screen.getByText('게임 목록')).toBeInTheDocument()
  })

  it('마운트 시 /api/admin/classes를 호출해 수업 목록을 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('3학년 2반')).toBeInTheDocument()
    expect(screen.getByText('미배정 수업')).toBeInTheDocument()
  })

  it('수업 항목에 생성일을 함께 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    expect(screen.getByText(new Date('2026-07-27T00:00:00.000Z').toLocaleDateString('ko-KR'))).toBeInTheDocument()
  })

  it('수업 클릭 시 onSelectClass를 {id,name}과 함께 호출한다', async () => {
    const onSelectClass = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={onSelectClass} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('3학년 2반'))
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'class-1', name: '3학년 2반', kind: 'class' })
  })

  it('수업 생성하기로 새 수업을 만들면 목록을 새로고침한다', async () => {
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'class-2', name: '3학년 3반' }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CLASSES) })
    })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    await userEvent.type(screen.getByPlaceholderText('새 수업 이름'), '3학년 3반')
    await userEvent.click(screen.getByText('수업 생성하기'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '3학년 3반' }),
      }))
    )
  })

  it('로그아웃 버튼 클릭 시 onLogout을 호출한다', async () => {
    const onLogout = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={onLogout} />)
    await userEvent.click(screen.getByText('로그아웃'))
    expect(onLogout).toHaveBeenCalled()
  })

  it('수업마다 QR 버튼 왼쪽에 만족도 조사 버튼이 있고, 누르면 만족도 조사 QR 팝업을 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    const surveyBtns = screen.getAllByRole('button', { name: '만족도 조사' })
    expect(surveyBtns).toHaveLength(2) // 수업과 대회 행에만 있고, 미배정 수업에는 QR 버튼과 마찬가지로 없다
    expect(surveyBtns[0].nextElementSibling).toBe(screen.getAllByRole('button', { name: 'QR' })[0])
    await userEvent.click(surveyBtns[0])
    expect(screen.getByText('만족도 조사 QR 코드')).toBeInTheDocument()
  })

  it('미배정 수업에는 삭제 버튼을 보여주지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('미배정 수업')
    expect(screen.getAllByText('삭제')).toHaveLength(2)
  })

  it('삭제 버튼 클릭 시 확인 팝업을 보여주고, 확인 시 DELETE 요청 후 목록을 새로고침한다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')

    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })

    await userEvent.click(screen.getAllByText('삭제')[0])
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('예'))

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes/class-1', expect.objectContaining({
      method: 'DELETE',
    }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.anything())
    )
  })

  it('삭제 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    global.fetch.mockClear()

    await userEvent.click(screen.getAllByText('삭제')[0])
    await userEvent.click(screen.getByText('아니요'))

    expect(screen.queryByText(/되돌릴 수 없습니다/)).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('빈 이름으로 수업 생성하기를 누르면 경고 팝업을 보여주고 API를 호출하지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    global.fetch.mockClear()

    await userEvent.click(screen.getByText('수업 생성하기'))

    expect(screen.getByText('수업 이름을 입력해주세요')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('확인'))
    expect(screen.queryByText('수업 이름을 입력해주세요')).not.toBeInTheDocument()
  })
})

describe('AdminClassList 대회', () => {
  it('수업과 대회를 각자의 목록에 나눠 보여준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('2026 시즌1')
    const classList = screen.getByRole('region', { name: '수업 목록' })
    const contestList = screen.getByRole('region', { name: '대회 목록' })
    expect(within(classList).getByText('3학년 2반')).toBeInTheDocument()
    expect(within(classList).getByText('미배정 수업')).toBeInTheDocument()
    expect(within(classList).queryByText('2026 시즌1')).not.toBeInTheDocument()
    expect(within(contestList).getByText('2026 시즌1')).toBeInTheDocument()
    expect(within(contestList).queryByText('3학년 2반')).not.toBeInTheDocument()
  })

  it('각 목록 칼럼에 자기 생성 폼이 있다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('2026 시즌1')
    expect(within(screen.getByRole('region', { name: '수업 목록' })).getByPlaceholderText('새 수업 이름')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '대회 목록' })).getByPlaceholderText('새 대회 이름')).toBeInTheDocument()
  })

  it('대회가 없으면 대회 목록에 빈 상태 문구를 보여준다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(CLASSES.filter(c => c.kind !== 'official')) })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    expect(within(screen.getByRole('region', { name: '대회 목록' })).getByText('아직 만든 대회가 없어요')).toBeInTheDocument()
  })

  it('대회 생성하기는 kind official로 생성한다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('새 대회 이름'), '2026 시즌2')
    await userEvent.click(screen.getByRole('button', { name: '대회 생성하기' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '2026 시즌2', kind: 'official' }),
      })),
    )
  })

  it('대회 삭제 버튼은 대회 삭제 확인 창을 띄운다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('2026 시즌1')
    await userEvent.click(screen.getAllByText('삭제')[1])
    expect(screen.getByText('대회 삭제')).toBeInTheDocument()
    expect(screen.getByText(/'2026 시즌1' 대회를 삭제하면/)).toBeInTheDocument()
  })

  it('대회를 고르면 kind를 함께 넘긴다', async () => {
    const onSelectClass = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={onSelectClass} onLogout={vi.fn()} />)
    await userEvent.click(await screen.findByText('2026 시즌1'))
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'contest-1', name: '2026 시즌1', kind: 'official' })
  })
})

describe('AdminClassList 모바일', () => {
  afterEach(restoreViewport)

  function renderList() {
    return render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
  }

  it('행의 버튼 3개를 메뉴로 옮기고, 미배정 수업에는 메뉴를 두지 않는다', async () => {
    mockViewport(390)
    renderList()
    await screen.findByText('3학년 2반')
    expect(screen.queryByRole('button', { name: 'QR' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3학년 2반 메뉴' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '미배정 수업 메뉴' })).not.toBeInTheDocument()
  })

  it('삭제는 메뉴를 거쳐 확인 창을 띄운다', async () => {
    mockViewport(390)
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: '3학년 2반 메뉴' }))
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['만족도 조사', 'QR', '삭제'])
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(screen.getByText('수업 삭제')).toBeInTheDocument()
  })
})
