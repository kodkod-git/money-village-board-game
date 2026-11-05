import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminRankingView from './AdminRankingView'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

const ROWS = ['가나', '다라', '마바', '사아'].map((name, i) => ({
  rank: i + 1, playerUuid: `p${i}`, name, character: 'Innovator-사자', affiliation: '서울중',
  teamName: `${i + 1}조`, teamCode: 'AB1234', className: '3학년 2반',
  cash: 100, stockValue: 200, realEstateValue: 300, netWorth: 600, totalAssets: 1000 - i,
  stockHoldings: {}, realEstateHoldings: {}, badges: [false, false, false, false, false, false],
  stockPrices: {}, realEstatePrices: {},
}))

function renderView() {
  return render(<AdminRankingView classId="class-1" classDisplayName="3학년 2반" onGoToTeamStatus={vi.fn()} />)
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ROWS) })
})

afterEach(restoreViewport)

describe('AdminRankingView', () => {
  it('PC에서는 표를 보여 준다', async () => {
    mockViewport(1280)
    renderView()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('★ 관리자 모드')).toBeInTheDocument()
  })

  it('모바일에서는 표 없이 팀 이름이 있는 목록과 시상대를 보여 준다', async () => {
    mockViewport(390)
    renderView()
    expect(await screen.findByText('4조')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('★ 관리자 모드')).not.toBeInTheDocument()
    expect(screen.getAllByText('가나')).toHaveLength(2)
  })

  it('시상대 왼쪽은 2위, 가운데는 1위다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    const names = screen.getAllByText(/^(가나|다라|마바)$/).slice(0, 3).map(el => el.textContent)
    expect(names).toEqual(['다라', '가나', '마바'])
  })

  it('검색 중에는 시상대를 숨긴다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    await userEvent.type(screen.getByPlaceholderText('이름 또는 팀 검색...'), '가나')
    await waitFor(() => expect(screen.getAllByText('가나')).toHaveLength(1))
    expect(screen.queryByText('4조')).not.toBeInTheDocument()
  })

  it('줄을 누르면 읽기 전용 학생 정보를 연다', async () => {
    mockViewport(390)
    renderView()
    await userEvent.click(await screen.findByText('4조'))
    expect(screen.getByRole('button', { name: '‹ 뒤로' })).toBeInTheDocument()
    expect(screen.queryByTestId('edit-cash')).not.toBeInTheDocument()
  })

  it('시상대의 이름을 누르면 그 학생의 정보를 연다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    // 이름이 시상대와 목록에 두 번 나오고, 시상대가 먼저다.
    const podiumName = screen.getAllByText('다라')[0]
    expect(podiumName.className).toMatch(/name/)
    expect(podiumName.closest('[class*="podium"]')).not.toBeNull()
    await userEvent.click(podiumName)
    expect(screen.getByRole('button', { name: '‹ 뒤로' })).toBeInTheDocument()
    expect(screen.getAllByText('다라').length).toBeGreaterThan(2)
  })

  it('모바일에서는 팀 이름으로도 검색된다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    await userEvent.type(screen.getByPlaceholderText('이름 또는 팀 검색...'), '4조')
    await waitFor(() => expect(screen.queryByText('1조')).not.toBeInTheDocument())
    expect(screen.getByText('4조')).toBeInTheDocument()
    expect(screen.getByText('사아')).toBeInTheDocument()
  })

  it('모바일에서 검색 결과가 없으면 안내 문구를 보여 준다', async () => {
    mockViewport(390)
    renderView()
    await screen.findByText('4조')
    await userEvent.type(screen.getByPlaceholderText('이름 또는 팀 검색...'), '없는이름')
    expect(await screen.findByText('검색 결과가 없습니다.')).toBeInTheDocument()
  })
})

describe('AdminRankingView PC 검색', () => {
  it('PC에서는 팀 이름으로 검색해도 찾지 못한다', async () => {
    mockViewport(1280)
    renderView()
    await screen.findByRole('table')
    expect(screen.getByText('4조')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('이름 또는 팀 검색...'), '4조')
    await waitFor(() => expect(screen.queryByText('4조')).not.toBeInTheDocument())
    expect(screen.queryByText('사아')).not.toBeInTheDocument()
    expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument()
  })
})
