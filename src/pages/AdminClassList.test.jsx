import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminClassList from './AdminClassList'
import { setAdminSession, clearAdminSession } from '../utils/adminAuth'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

const CLASSES = [
  { id: 'class-1', name: '3학년 2반', kind: 'class', createdAt: '2026-07-27T00:00:00.000Z' },
  { id: 'contest-1', name: '2026 시즌1', kind: 'official', boardCount: 5, createdAt: '2026-11-12T00:00:00.000Z' },
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
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'class-1', name: '3학년 2반', kind: 'class', boardCount: 6 })
  })

  it('생성하기로 새 게임을 만들면 기본값(일반·6판)으로 생성하고 목록을 새로고침한다', async () => {
    global.fetch = vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'class-2', name: '3학년 3반' }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CLASSES) })
    })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    await userEvent.type(screen.getByPlaceholderText('새 게임 이름'), '3학년 3반')
    await userEvent.click(screen.getByRole('button', { name: '생성하기' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '3학년 3반', kind: 'class', boardCount: 6 }),
      }))
    )
  })

  it('로그아웃 버튼 클릭 시 onLogout을 호출한다', async () => {
    const onLogout = vi.fn()
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={onLogout} />)
    await userEvent.click(screen.getByText('로그아웃'))
    expect(onLogout).toHaveBeenCalled()
  })

  it('목록 행에는 만족도 조사 버튼이 없다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    expect(screen.queryByRole('button', { name: '만족도 조사' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'QR' })).toHaveLength(2)
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

  it('빈 이름으로 생성하기를 누르면 경고 팝업을 보여주고 API를 호출하지 않는다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('3학년 2반')
    global.fetch.mockClear()

    await userEvent.click(screen.getByRole('button', { name: '생성하기' }))

    expect(screen.getByText('게임 이름을 입력해주세요')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('확인'))
    expect(screen.queryByText('게임 이름을 입력해주세요')).not.toBeInTheDocument()
  })
})

describe('AdminClassList 대회', () => {
  it('일반 게임과 대회를 한 목록에 보여 주고, 대회만 제목 옆 뱃지로 구분한다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('2026 시즌1')
    expect(screen.queryByText('수업 목록')).not.toBeInTheDocument()
    expect(screen.queryByText('대회 목록')).not.toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items.map(li => within(li).getAllByRole('button')[0].querySelector('span span').textContent))
      .toEqual(['3학년 2반', '2026 시즌1', '미배정 수업'])
    expect(within(items[1]).getByText('대회')).toBeInTheDocument()
    expect(within(items[0]).queryByText('대회')).not.toBeInTheDocument()
  })

  it('목록에 진행 방식(5판/6판)을 함께 보여 준다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await screen.findByText('2026 시즌1')
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('6판')).toBeInTheDocument()
    expect(within(items[1]).getByText('5판')).toBeInTheDocument()
  })

  it('게임이 하나도 없으면 빈 상태 문구를 보여준다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('아직 만든 게임이 없어요')).toBeInTheDocument()
  })

  it('게임 종류(대회)와 진행 방식(5판)을 골라 생성한다', async () => {
    render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('새 게임 이름'), '2026 시즌2')
    const kindGroup = screen.getByRole('radiogroup', { name: '게임 종류' })
    const boardGroup = screen.getByRole('radiogroup', { name: '진행 방식' })
    expect(within(kindGroup).getByRole('radio', { name: '일반' })).toHaveAttribute('aria-checked', 'true')
    expect(within(boardGroup).getByRole('radio', { name: /6판/ })).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(within(kindGroup).getByRole('radio', { name: '대회' }))
    await userEvent.click(within(boardGroup).getByRole('radio', { name: /5판/ }))
    expect(within(kindGroup).getByRole('radio', { name: '대회' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: '생성하기' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/classes', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '2026 시즌2', kind: 'official', boardCount: 5 }),
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
    expect(onSelectClass).toHaveBeenCalledWith({ id: 'contest-1', name: '2026 시즌1', kind: 'official', boardCount: 5 })
  })
})

describe('AdminClassList 모바일', () => {
  afterEach(restoreViewport)

  function renderList() {
    return render(<AdminClassList profile={{ username: 'admin', isSuper: true }} onSelectClass={vi.fn()} onLogout={vi.fn()} />)
  }

  it('행의 버튼을 메뉴로 옮기고, 미배정 수업에는 메뉴를 두지 않는다', async () => {
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
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['QR', '삭제'])
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(screen.getByText('게임 삭제')).toBeInTheDocument()
  })
})
