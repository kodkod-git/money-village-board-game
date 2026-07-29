import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RankingPage from './RankingPage'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/result/:sessionId" element={<RankingPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.startsWith('/api/rankings?category=stock')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '정우성', affiliation: '수도고', teamCode: 'EF9012', character: 'tiger', stockValue: 172000, totalAssets: 300000, playerUuid: 'p1' },
      ]) })
    }
    if (url.startsWith('/api/rankings?category=realEstate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { rank: 1, name: '한소희', affiliation: '미래고', teamCode: 'GH3456', character: 'toucan', realEstateValue: 90000, totalAssets: 250000, playerUuid: 'p2' },
      ]) })
    }
    if (url.startsWith('/api/results/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        teamCode: 'AB1234',
        players: [
          { rank: 1, name: '홍길동', affiliation: '서울중', teamCode: 'AB1234', character: 'fox', totalAssets: 50000, playerUuid: 'p3' },
        ],
      }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([
      { rank: 1, name: '김민준', affiliation: '서울중', teamCode: 'AB1234', character: 'lion', totalAssets: 200000, playerUuid: 'p4' },
    ]) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RankingPage', () => {
  it('홈 진입(sessionId 없음)에서 부스 랭킹 탭 선택 시 서브탭 없이 카테고리 피커만 보인다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.queryByText('소속')).toBeNull()
  })

  it('결과등록 후 진입(sessionId 있음)에서 전체 랭킹 탭은 기존 소속/팀 서브탭을 유지한다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByText('소속')).toBeInTheDocument()
    expect(screen.getByText('팀')).toBeInTheDocument()
  })

  it('부스 랭킹 + 주식 카테고리 선택 시 /api/rankings?category=stock을 호출한다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=stock')
    })
    expect(await screen.findByText('정우성')).toBeInTheDocument()
  })

  it('부스 랭킹에서 부동산 카테고리를 선택하면 /api/rankings?category=realEstate를 호출한다', async () => {
    renderAt('/ranking')
    await userEvent.click(screen.getByText('부스 랭킹'))
    await userEvent.click(screen.getByText('부동산'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rankings?category=realEstate')
    })
    expect(await screen.findByText('한소희')).toBeInTheDocument()
  })

  it('홈 진입(sessionId 없음)에서는 나의 기록(pinned row)이 보이지 않는다', async () => {
    renderAt('/ranking')
    expect(await screen.findByText('김민준')).toBeInTheDocument()
    expect(screen.queryByTestId('pinned-row')).toBeNull()
    expect(screen.queryByTestId('pinned-row-empty')).toBeNull()
  })

  it('홈 진입(sessionId 없음)에서는 뒤로가기 버튼이 보인다', async () => {
    renderAt('/ranking')
    await screen.findByText('김민준')
    expect(screen.getByLabelText('뒤로 가기')).toBeInTheDocument()
  })

  it('결과등록 후 진입(sessionId 있음)에서는 뒤로가기 버튼이 보이지 않는다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.queryByLabelText('뒤로 가기')).not.toBeInTheDocument()
  })

  it('결과등록 후 진입(sessionId 있음)에서는 처음으로 버튼이 보인다', async () => {
    renderAt('/result/session-1')
    await waitFor(() => expect(screen.getByText('전체')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument()
  })

  it('플레이어 행 클릭 시 관리자 수정화면과 동일한 읽기전용 상세보기를 연다', async () => {
    renderAt('/ranking')
    await userEvent.click(await screen.findByText('김민준'))
    expect(screen.getByText('‹ 뒤로')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-job')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-cash')).not.toBeInTheDocument()
  })

  it('상세보기에서 뒤로 버튼 클릭 시 닫힌다', async () => {
    renderAt('/ranking')
    await userEvent.click(await screen.findByText('김민준'))
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(screen.queryByText('‹ 뒤로')).not.toBeInTheDocument()
  })
})
