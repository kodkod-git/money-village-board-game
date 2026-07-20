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

  it('‹ 뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminSpectateModal rooms={ROOMS} initialIndex={0} onPlayerUpdate={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
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
})
