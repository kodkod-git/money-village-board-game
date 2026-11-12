import { render, screen, waitFor, within } from '@testing-library/react'
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
  it('기본은 누적 범위의 포인트 순위다. 이름 옆에 대회 이름을 붙이고 점수와 게임 수를 보여 준다', async () => {
    renderAt()
    expect(await screen.findAllByText('박병윤 (2026 시즌1)')).not.toHaveLength(0)
    expect(screen.getAllByText('24.5점').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3게임 · 1위 1회').length).toBeGreaterThan(0)
    expect(global.fetch).toHaveBeenCalledWith('/api/official-rankings')
  })

  it('최고 자산 탭은 원 단위와 참고용 안내를 보여 준다', async () => {
    renderAt()
    await screen.findAllByText('박병윤 (2026 시즌1)')
    await userEvent.click(screen.getByRole('button', { name: '최고 자산' }))
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
})
