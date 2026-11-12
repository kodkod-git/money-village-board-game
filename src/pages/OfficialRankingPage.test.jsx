import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OfficialRankingPage from './OfficialRankingPage'

const CONTESTS = [
  { id: 'c2', name: '2026 시즌2', createdAt: '2026-11-10T00:00:00.000Z' },
  { id: 'c1', name: '2026 시즌1', createdAt: '2026-10-01T00:00:00.000Z' },
]

function player(id, realName, contestName, points, bestAssets, rank) {
  return { officialPlayerId: id, realName, contestId: contestName === '2026 시즌1' ? 'c1' : 'c2', contestName, character: 'fox', points, games: 3, wins: 1, bestAssets, rank }
}

const ALL = {
  contests: CONTESTS,
  points: [
    player('op1', '박병윤', '2026 시즌1', 24.5, 1200000, 1),
    player('op2', '김철수', '2026 시즌2', 20, 900000, 2),
    player('op3', '이영희', '2026 시즌1', 10, 1500000, 3),
    player('op4', '최민수', '2026 시즌2', 5, 100000, 4),
  ],
  bestAssets: [
    player('op3', '이영희', '2026 시즌1', 10, 1500000, 1),
    player('op1', '박병윤', '2026 시즌1', 24.5, 1200000, 2),
    player('op2', '김철수', '2026 시즌2', 20, 900000, 3),
    player('op4', '최민수', '2026 시즌2', 5, 100000, 4),
  ],
}

function renderAt(path = '/ranking/official') {
  return render(
    <MemoryRouter initialEntries={['/ranking', path]} initialIndex={1}>
      <Routes>
        <Route path="/ranking" element={<div>일반 랭킹 화면</div>} />
        <Route path="/ranking/official" element={<OfficialRankingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn(url => {
    if (url === '/api/official-rankings') return Promise.resolve({ ok: true, json: () => Promise.resolve(ALL) })
    if (url === '/api/official-rankings?classId=c1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ contests: CONTESTS, points: [], bestAssets: [] }) })
    }
    return Promise.reject(new Error(url))
  })
})

describe('OfficialRankingPage', () => {
  it('기본은 전체 대회의 총자산 탭이다', async () => {
    renderAt()
    expect(await screen.findAllByText('박병윤 (2026 시즌1)')).not.toHaveLength(0)
    expect(screen.getByRole('combobox', { name: '대회 선택' })).toHaveValue('')
    expect(screen.getByRole('option', { name: '전체 대회' })).toBeInTheDocument()
    expect(screen.getAllByText('1,500,000원').length).toBeGreaterThan(0)
    expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings')
  })

  it('탭은 총자산, 승점 순서이고 소제목은 대회 순위 안내다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    const tabs = screen.getAllByRole('button', { name: /^(총자산|승점)$/ })
    expect(tabs.map(t => t.textContent)).toEqual(['총자산', '승점'])
    expect(screen.getByText('대회 순위를 확인하세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '누적' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '대회별 보기' })).not.toBeInTheDocument()
  })

  it('승점 탭은 이름 옆에 대회 이름을 붙이고 점수와 게임 수를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.click(screen.getByRole('button', { name: '승점' }))
    expect(screen.getAllByText('24.5점').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3게임 · 1위 1회').length).toBeGreaterThan(0)
    expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings')
  })

  it('총자산 탭은 원 단위와 참고용 안내를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    expect(screen.getByText('테이블마다 가격이 달라 참고용 기록이에요.')).toBeInTheDocument()
    expect(screen.getAllByText('1,500,000원').length).toBeGreaterThan(0)
  })

  it('대회를 고르면 그 대회만 조회하고, 비어 있으면 빈 상태 문구를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '대회 선택' }), 'c1')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings?classId=c1'))
    expect(await screen.findByText('아직 집계된 공식 게임이 없어요')).toBeInTheDocument()
  })

  it('쿼리 classId로 들어오면 그 대회로 시작한다', async () => {
    renderAt('/ranking/official?classId=c1')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings?classId=c1'))
  })

  it('기억된 공식 참가자 id가 있으면 내 행을 맨 아래에 고정한다', async () => {
    localStorage.setItem('official_player_ids', JSON.stringify({ c2: 'op4' }))
    renderAt()
    const pinned = await screen.findByTestId('pinned-row')
    expect(within(pinned).getByText('최민수 (2026 시즌2)')).toBeInTheDocument()
  })

  it('뒤로가기를 누르면 이전 랭킹 화면으로 돌아간다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.click(screen.getByRole('button', { name: /뒤로/ }))
    expect(await screen.findByText('일반 랭킹 화면')).toBeInTheDocument()
  })

  it('늦게 도착한 이전 범위 응답은 나중에 고른 범위의 결과를 덮어쓰지 않는다', async () => {
    let resolveContest
    const STALE = { contests: CONTESTS, points: [player('op9', '늦은응답', '2026 시즌1', 99, 1, 1)], bestAssets: [] }
    global.fetch = vi.fn(url => {
      if (url === '/api/official-rankings?classId=c1') {
        return new Promise(resolve => { resolveContest = () => resolve({ ok: true, json: () => Promise.resolve(STALE) }) })
      }
      if (url === '/api/official-rankings') return Promise.resolve({ ok: true, json: () => Promise.resolve(ALL) })
      return Promise.reject(new Error(url))
    })
    renderAt('/ranking/official?classId=c1')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings?classId=c1'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '대회 선택' }), '')
    expect(await screen.findAllByText('박병윤 (2026 시즌1)')).not.toHaveLength(0)
    await act(async () => { resolveContest() })
    expect(screen.getAllByText('박병윤 (2026 시즌1)').length).toBeGreaterThan(0)
    expect(screen.queryByText(/늦은응답/)).not.toBeInTheDocument()
  })

  it('불러오기에 실패하면 안내와 다시 시도 버튼을 보여 주고, 누르면 다시 불러온다', async () => {
    let fail = false
    global.fetch = vi.fn(url => {
      if (fail) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      if (url === '/api/official-rankings') return Promise.resolve({ ok: true, json: () => Promise.resolve(ALL) })
      return Promise.reject(new Error(url))
    })
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    fail = true
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '대회 선택' }), 'c1')
    expect(await screen.findByText('랭킹을 불러오지 못했어요')).toBeInTheDocument()
    // 이전에 받은 대회 목록은 그대로 남는다
    expect(screen.getByRole('option', { name: '2026 시즌2' })).toBeInTheDocument()
    fail = false
    global.fetch.mockClear()
    global.fetch.mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ contests: CONTESTS, points: [], bestAssets: [] }) }))
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings?classId=c1')
    expect(await screen.findByText('아직 집계된 공식 게임이 없어요')).toBeInTheDocument()
  })

  it('전체 대회 범위의 총자산 탭은 보조 줄에 대회 이름 대신 게임 수를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    expect(screen.getAllByText('3게임').length).toBeGreaterThan(0)
    // 드롭다운 옵션을 빼면 대회 이름만 단독으로 쓰인 보조 줄은 없어야 한다
    expect(screen.queryAllByText('2026 시즌1').filter(el => el.tagName !== 'OPTION')).toHaveLength(0)
  })

  it('탭 버튼은 선택 상태를 aria-pressed로 알린다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    expect(screen.getByRole('button', { name: '총자산' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '승점' })).toHaveAttribute('aria-pressed', 'false')
  })
})
