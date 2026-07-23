import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminSpectateModal from './AdminSpectateModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makeRoom(code, name) {
  return {
    code, status: 'live', registered: false, prices: PRICES,
    players: [{
      playerUuid: `${code}-p1`, name, character: 'Innovator-사자', affiliation: '서울중',
      gameState: {
        cash: 10000, job: 'a',
        stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
        realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
        badges: [false, false, false, false, false, false],
        isCompleted: false,
      },
    }],
  }
}

const ROOMS = [makeRoom('AB1234', '김민준'), makeRoom('CD5678', '이서연')]

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
})

describe('AdminSpectateModal', () => {
  it('does not render waiting cards for empty player slots', () => {
    const { container } = render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(container.querySelector('[class*="emptySlot"]')).not.toBeInTheDocument()
  })

  it('1팀 관전 화면을 보여주고 팀원 카드를 렌더링한다', () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('1팀')).toBeInTheDocument()
    expect(screen.getByText('김민준')).toBeInTheDocument()
  })

  it('다음 화살표 클릭 시 다음 팀으로 이동한다', async () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('다음 팀'))
    expect(screen.getByText('2팀')).toBeInTheDocument()
    expect(screen.getByText('이서연')).toBeInTheDocument()
  })

  it('플레이어 카드의 수정 버튼 클릭 시 AdminEditModal로 전환된다', async () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('수정'))
    expect(screen.getByTestId('edit-job')).toBeInTheDocument()
  })

  it('닫기 버튼을 렌더링하지 않는다', () => {
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
  })

  it('필드 수정 시 PATCH 요청을 보내고 응답으로 onPlayerUpdate를 호출한다', async () => {
    const onPlayerUpdate = vi.fn()
    const updatedPlayer = {
      playerUuid: 'AB1234-p1', name: '김민준', character: 'Innovator-사자', affiliation: '서울중',
      gameState: {
        cash: 10000, job: 'c',
        stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
        realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
        badges: [false, false, false, false, false, false],
        isCompleted: false,
      },
    }
    global.fetch = vi.fn((_url, options) => {
      if (options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(updatedPlayer) })
      }
      return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
    })

    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={onPlayerUpdate} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('수정'))
    await userEvent.click(screen.getByTestId('edit-job'))
    await userEvent.click(screen.getByText('보건·교육'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms/AB1234/players/AB1234-p1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: 'c' }),
      })
    )
    expect(onPlayerUpdate).toHaveBeenCalledWith('AB1234', updatedPlayer)
  })

  it('필드 수정 저장 시 onRoomChanged도 호출해 방 목록(상태 배지)을 새로고침한다', async () => {
    const onRoomChanged = vi.fn()
    global.fetch = vi.fn((_url, options) => {
      if (options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ playerUuid: 'AB1234-p1', gameState: {} }) })
      }
      return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
    })

    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={onRoomChanged} />)
    await userEvent.click(screen.getByText('수정'))
    await userEvent.click(screen.getByTestId('edit-job'))
    await userEvent.click(screen.getByText('보건·교육'))

    expect(onRoomChanged).toHaveBeenCalled()
  })
})

it('onRoomChanged로 방 목록 순서가 바뀌어도 보고 있던 팀을 코드로 계속 추적한다', () => {
  const roomA = makeRoom('AB1234', '김민준')
  const roomB = makeRoom('CD5678', '이서연')
  const { rerender } = render(
    <AdminSpectateModal rooms={[roomA, roomB]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />
  )
  expect(screen.getByText('1팀')).toBeInTheDocument()
  expect(screen.getByText('김민준')).toBeInTheDocument()

  // 목록이 다시 정렬돼 순서가 바뀌어도(AB1234가 이제 index 1) 같은 방을 계속 보여줘야 한다.
  rerender(
    <AdminSpectateModal rooms={[roomB, roomA]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />
  )
  expect(screen.getByText('2팀')).toBeInTheDocument()
  expect(screen.getByText('김민준')).toBeInTheDocument()
})

it('stale 상태(미등록 라이브 룸)에서도 계속 폴링한다', async () => {
  vi.useFakeTimers()
  const staleRoom = { ...makeRoom('AB1234', '김민준'), status: 'stale' }
  const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  global.fetch = fetchMock

  render(<AdminSpectateModal rooms={[staleRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  fetchMock.mockClear()
  await vi.advanceTimersByTimeAsync(3000)

  expect(fetchMock).toHaveBeenCalledWith('/api/rooms/AB1234')
  vi.useRealTimers()
})

it('등록 완료된 방은 폴링하지 않는다', async () => {
  vi.useFakeTimers()
  const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
  const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  global.fetch = fetchMock

  render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  fetchMock.mockClear()
  await vi.advanceTimersByTimeAsync(3000)

  expect(fetchMock).not.toHaveBeenCalled()
  vi.useRealTimers()
})

it('라이브 룸(미등록)에는 삭제 버튼을 보여준다', () => {
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.getByText('삭제')).toBeInTheDocument()
})

it('등록 완료된 팀에도 삭제 버튼을 보여준다', () => {
  const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
  render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.getByText('삭제')).toBeInTheDocument()
})

it('등록 대기(전원 입력완료) 상태에는 결과 등록 버튼을 보여준다', () => {
  const pendingRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed-but-unregistered' }
  render(<AdminSpectateModal rooms={[pendingRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.getByText('결과 등록')).toBeInTheDocument()
})

it('live/등록완료 상태에는 결과 등록 버튼을 보여주지 않는다', () => {
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.queryByText('결과 등록')).not.toBeInTheDocument()

  const registeredRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed', registered: true }
  render(<AdminSpectateModal rooms={[registeredRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  expect(screen.queryByText('결과 등록')).not.toBeInTheDocument()
})

it('결과 등록 버튼 클릭 시 확인 팝업 없이 바로 등록 요청 후 onRoomChanged와 onClose를 호출한다', async () => {
  const onClose = vi.fn()
  const onRoomChanged = vi.fn()
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessionId: 'session-1' }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })

  const pendingRoom = { ...makeRoom('AB1234', '김민준'), status: 'completed-but-unregistered' }
  render(<AdminSpectateModal rooms={[pendingRoom]} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={onClose} onRoomChanged={onRoomChanged} />)
  await userEvent.click(screen.getByText('결과 등록'))

  expect(global.fetch).toHaveBeenCalledWith('/api/rooms/AB1234/submit', expect.objectContaining({ method: 'POST' }))
  expect(onRoomChanged).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

it('삭제 버튼 클릭 시 확인 팝업을 보여주고, 확인 시 DELETE 요청 후 onRoomChanged와 onClose를 호출한다', async () => {
  const onClose = vi.fn()
  const onRoomChanged = vi.fn()
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  })

  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={onClose} onRoomChanged={onRoomChanged} />)
  await userEvent.click(screen.getByText('삭제'))
  expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument()

  await userEvent.click(screen.getByText('정말 삭제'))

  expect(global.fetch).toHaveBeenCalledWith('/api/admin/rooms/AB1234', expect.objectContaining({ method: 'DELETE' }))
  expect(onRoomChanged).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

it('삭제 확인 팝업에서 취소를 누르면 요청을 보내지 않는다', async () => {
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ players: [], prices: PRICES }) })
  render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={vi.fn()} onRoomChanged={vi.fn()} />)
  await userEvent.click(screen.getByText('삭제'))
  await userEvent.click(screen.getByText('취소'))
  expect(screen.queryByText(/되돌릴 수 없습니다/)).not.toBeInTheDocument()
})
