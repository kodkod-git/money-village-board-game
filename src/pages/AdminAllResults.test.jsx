import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminAllResults from './AdminAllResults'

const PRICES = {
  stockPrices: { semiconductor: 10000, finance: 10000, bio: 10000 },
  realEstatePrices: { gaon: 10000, dami: 10000, chorong: 10000 },
}

function row(name, cash, stockHoldings, realEstateHoldings) {
  return {
    name, cash, stockHoldings, realEstateHoldings, ...PRICES,
    affiliation: '서울중', character: 'Innovator-사자', className: '3학년 2반', teamName: '독수리 팀',
    sessionId: `session-${name}`, playerUuid: `uuid-${name}`,
    stockValue: 0, realEstateValue: 0, totalAssets: cash,
  }
}

// 기본 기준(투자 70% 초과, 한 종목 50% 이상)에서 그룹별로 한 명씩
const ROWS = [
  row('블루', 0, { semiconductor: 8 }, {}), // 투자 100%, 한 종목 100%
  row('오렌지', 20000, { semiconductor: 3, finance: 3, bio: 2 }, {}), // 투자 80%, 한 종목 37.5%
  row('레드', 80000, {}, { chorong: 2 }), // 투자 20%, 한 종목 100%
  row('그린', 70000, { semiconductor: 1, finance: 1 }, { gaon: 1 }), // 투자 30%, 한 종목 33%
]

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(ROWS) }))
})

describe('AdminAllResults', () => {
  it('테이블 뷰에 모든 참가자를 보여 주고 상태 대신 보고서 링크를 단다', async () => {
    render(<AdminAllResults />)
    expect(await screen.findByText('블루')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/rankings')
    expect(screen.queryByRole('columnheader', { name: /상태/ })).not.toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: '보고서' })
    expect(links).toHaveLength(4)
    expect(links[0]).toHaveAttribute('href', '/result/session-블루/report?player=uuid-%EB%B8%94%EB%A3%A8')
    expect(links[0]).toHaveAttribute('target', '_blank')
  })

  it('유형 분포 뷰는 기본 기준(70%, 50%)으로 게임 결과 유형 분포를 보여 준다', async () => {
    render(<AdminAllResults />)
    await screen.findByText('블루')
    await userEvent.click(screen.getByRole('tab', { name: '유형 분포 뷰' }))
    expect(screen.getByLabelText(/미래형 기준/)).toHaveValue('70')
    expect(screen.getByLabelText(/위험형 기준/)).toHaveValue('50')
    expect(screen.getByRole('img', { name: '유형 분포: Blue Group 1명, Orange Group 1명, Red Group 1명, Green Group 1명' })).toBeInTheDocument()
  })

  it('드래그 바로 기준값을 바꾸면 분포가 다시 계산되고 기본값으로 되돌릴 수 있다', async () => {
    render(<AdminAllResults />)
    await screen.findByText('블루')
    await userEvent.click(screen.getByRole('tab', { name: '유형 분포 뷰' }))

    // 미래형 기준을 85%로 올리면 투자 80%인 오렌지가 현재·안전(Green)으로
    fireEvent.change(screen.getByLabelText(/미래형 기준/), { target: { value: '85' } })
    expect(screen.getByRole('img', { name: '유형 분포: Blue Group 1명, Orange Group 0명, Red Group 1명, Green Group 2명' })).toBeInTheDocument()
    expect(screen.getByText('미래형 1명 : 현재형 3명')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '기본값 70%' }))
    expect(screen.getByLabelText(/미래형 기준/)).toHaveValue('70')

    // 위험형 기준을 30%로 내리면 오렌지(37.5%)와 그린(33%)도 위험형
    fireEvent.change(screen.getByLabelText(/위험형 기준/), { target: { value: '30' } })
    const chart = screen.getByRole('img', { name: /유형 분포/ })
    expect(chart).toHaveAccessibleName('유형 분포: Blue Group 2명, Orange Group 0명, Red Group 2명, Green Group 0명')
    expect(within(chart).getAllByText(/명/)).toHaveLength(4)
  })

  it('불러오기에 실패하면 오류 문구를 보여 준다', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }))
    render(<AdminAllResults />)
    expect(await screen.findByText('결과를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument()
  })
})
