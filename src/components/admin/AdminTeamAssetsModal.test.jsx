import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminTeamAssetsModal from './AdminTeamAssetsModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function makePlayer(uuid, name) {
  return {
    playerUuid: uuid, name, character: 'Innovator-사자',
    gameState: {
      cash: 10000, job: 'a', jobVisited: true,
      stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
      realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
      badges: [true, false, false, false, false, false],
    },
  }
}

function makeRoom(players) {
  return { code: 'AB1234', prices: PRICES, players }
}

describe('AdminTeamAssetsModal', () => {
  it('null이 아닌 팀원 수만큼 영수증 카드를 렌더한다', () => {
    const room = makeRoom([makePlayer('p1', '김민준'), null, makePlayer('p3', '이서연')])
    render(<AdminTeamAssetsModal room={room} prices={PRICES} teamLabel="1팀" onClose={vi.fn()} />)
    expect(screen.getByTestId('asset-receipt-p1')).toBeInTheDocument()
    expect(screen.getByTestId('asset-receipt-p3')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^asset-receipt-/)).toHaveLength(2)
  })

  it('팀 라벨을 제목에 보여준다', () => {
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="3팀" onClose={vi.fn()} />)
    expect(screen.getByText('3팀 · 팀원 자산 상세')).toBeInTheDocument()
  })

  it('팀원이 한 명도 없으면 빈 상태 문구를 보여준다', () => {
    render(<AdminTeamAssetsModal room={makeRoom([null, null])} prices={PRICES} teamLabel="1팀" onClose={vi.fn()} />)
    expect(screen.getByText('표시할 팀원이 없습니다')).toBeInTheDocument()
  })

  it('✕ 버튼으로 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '자세히 보기 닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('하단 닫기 버튼으로 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('오버레이 클릭·ESC로 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />
    )
    fireEvent.click(container.firstChild)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('패널 내부 클릭은 onClose를 호출하지 않는다', async () => {
    const onClose = vi.fn()
    render(<AdminTeamAssetsModal room={makeRoom([makePlayer('p1', '김민준')])} prices={PRICES} teamLabel="1팀" onClose={onClose} />)
    await userEvent.click(screen.getByText('1팀 · 팀원 자산 상세'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
