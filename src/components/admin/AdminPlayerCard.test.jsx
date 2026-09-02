import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminPlayerCard from './AdminPlayerCard'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

const PLAYER = {
  playerUuid: 'p1', name: '김민준', character: 'Innovator-사자', affiliation: '서울중',
  gameState: {
    cash: 125000, job: 'a',
    stocks: { semiconductor: 2, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [true, false, false, false, false, false],
    isCompleted: true,
  },
}

describe('AdminPlayerCard', () => {
  it('이름/직업/총자산을 보여준다', () => {
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('김민준')).toBeInTheDocument()
    expect(screen.getByText('경영·금융')).toBeInTheDocument()
    // cash 125000 + stockValue(2*2000=4000) + realEstateValue(1*10000=10000) = 139000
    // totalAssets = 139000 * (badgeCount(1) * 0.5) = 69500 per calculateAssetBreakdown's real formula
    expect(screen.getByText('69,500원')).toBeInTheDocument()
  })

  it('직업 미입력 시 안내 문구를 보여준다', () => {
    const player = { ...PLAYER, gameState: { ...PLAYER.gameState, job: null } }
    render(<AdminPlayerCard player={player} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('직업 미입력')).toBeInTheDocument()
  })

  it('무직(job:null, jobVisited:true)이면 "무직"을 보여준다', () => {
    const player = { ...PLAYER, gameState: { ...PLAYER.gameState, job: null, jobVisited: true } }
    render(<AdminPlayerCard player={player} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('무직')).toBeInTheDocument()
  })

  it('수정 버튼 클릭 시 onEdit을 호출한다', async () => {
    const onEdit = vi.fn()
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={onEdit} />)
    await userEvent.click(screen.getByText('수정'))
    expect(onEdit).toHaveBeenCalled()
  })

  it('connected가 false면 연결 끊김 뱃지를 표시한다', () => {
    const player = { ...PLAYER, connected: false }
    render(<AdminPlayerCard player={player} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.getByText('연결 끊김')).toBeInTheDocument()
  })

  it('connected가 명시되지 않으면 연결 끊김 뱃지를 표시하지 않는다', () => {
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.queryByText('연결 끊김')).toBeNull()
  })

  it('onKick이 주어지면 퇴장 버튼을 렌더링하고 클릭 시 호출한다', async () => {
    const onKick = vi.fn()
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={vi.fn()} onKick={onKick} />)
    await userEvent.click(screen.getByText('퇴장'))
    expect(onKick).toHaveBeenCalled()
  })

  it('onKick이 없으면 퇴장 버튼을 렌더링하지 않는다', () => {
    render(<AdminPlayerCard player={PLAYER} prices={PRICES} onEdit={vi.fn()} />)
    expect(screen.queryByText('퇴장')).toBeNull()
  })
})
