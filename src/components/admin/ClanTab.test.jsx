import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ClanTab from './ClanTab'
import Toaster from '../Toaster'
import { _resetToasts } from '../../utils/toast'
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'
import { SocketProvider } from '../../contexts/SocketContext'
import { CLAN_MEMBER_DRAG_TYPE } from '../../constants/clan'

vi.mock('socket.io-client', () => {
  const socket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: 's1' }
  return { io: vi.fn(() => socket) }
})

const VIEW = {
  participants: [{ resultId: 'r1', name: '홍길동', character: 'Adventurer-강아지', teamName: 'AB1234' }],
  clans: [{ id: 'k1', name: '팀 1', members: [] }],
}

let assignOk
beforeEach(() => {
  assignOk = true
  setAdminSession('test-token', { username: 'admin', isSuper: true })
  global.fetch = vi.fn((url, options = {}) => {
    if (url.endsWith('/clans/assign')) {
      return Promise.resolve({ ok: assignOk, json: () => Promise.resolve(assignOk ? { ok: true } : { error: '참여자를 찾을 수 없어요' }) })
    }
    if (options.method === 'POST' || options.method === 'PATCH' || options.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(VIEW) })
  })
})

afterEach(() => {
  clearAdminSession()
  _resetToasts()
})

function renderTab() {
  return render(
    <SocketProvider>
      <ClanTab classId="class-1" />
      <Toaster />
    </SocketProvider>
  )
}

const drop = (el, id) => fireEvent.drop(el, { dataTransfer: { getData: t => (t === CLAN_MEMBER_DRAG_TYPE ? id : '') } })
const callsTo = suffix => global.fetch.mock.calls.filter(([url]) => url.endsWith(suffix))

describe('ClanTab', () => {
  it('클랜 목록을 불러와 참여자와 클랜 카드를 보여준다', async () => {
    renderTab()
    expect(await screen.findByText('홍길동')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '팀 1' })).toBeInTheDocument()
    expect(callsTo('/api/admin/classes/class-1/clans')).toHaveLength(1)
  })

  it('참여자를 클랜에 놓으면 바로 옮겨 보이고 assign API를 부른다', async () => {
    renderTab()
    await screen.findByText('홍길동')
    const card = screen.getByRole('region', { name: '팀 1' })
    expect(within(card).queryByText('홍길동')).not.toBeInTheDocument()
    drop(card, 'r1')
    expect(within(card).getByText('홍길동')).toBeInTheDocument()
    await waitFor(() => expect(callsTo('/clans/assign')).toHaveLength(1))
    expect(JSON.parse(callsTo('/clans/assign')[0][1].body)).toEqual({ resultId: 'r1', toClanId: 'k1' })
  })

  it('배정이 실패하면 서버 오류를 토스트로 보여주고 다시 불러온다', async () => {
    assignOk = false
    renderTab()
    await screen.findByText('홍길동')
    drop(screen.getByRole('region', { name: '팀 1' }), 'r1')
    expect(await screen.findByText('참여자를 찾을 수 없어요')).toBeInTheDocument()
    await waitFor(() => expect(callsTo('/api/admin/classes/class-1/clans')).toHaveLength(2))
  })

  it('"팀 만들기"는 POST 후 다시 불러온다', async () => {
    renderTab()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByRole('button', { name: /팀 만들기/ }))
    await waitFor(() => expect(callsTo('/api/admin/classes/class-1/clans')).toHaveLength(3))
    expect(callsTo('/api/admin/classes/class-1/clans')[1][1].method).toBe('POST')
  })

  it('삭제는 확인 후 DELETE를 보낸다', async () => {
    renderTab()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByRole('button', { name: '팀 1 삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '예' }))
    await waitFor(() => expect(callsTo('/clans/k1')).toHaveLength(1))
    expect(callsTo('/clans/k1')[0][1].method).toBe('DELETE')
  })

  it('이름을 바꾸면 PATCH를 보낸다', async () => {
    renderTab()
    await screen.findByText('홍길동')
    await userEvent.click(screen.getByRole('button', { name: '팀 1 이름 바꾸기' }))
    const input = screen.getByRole('textbox', { name: '팀 이름' })
    await userEvent.clear(input)
    await userEvent.type(input, '호랑이반{Enter}')
    await waitFor(() => expect(callsTo('/clans/k1')).toHaveLength(1))
    expect(JSON.parse(callsTo('/clans/k1')[0][1].body)).toEqual({ name: '호랑이반' })
  })
})
