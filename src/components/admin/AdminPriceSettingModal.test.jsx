import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminPriceSettingModal from './AdminPriceSettingModal'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

describe('AdminPriceSettingModal', () => {
  it('기본으로 주식 목록이 보인다', () => {
    render(<AdminPriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('반도체 IT')).toBeInTheDocument()
  })

  it('부동산 탭을 누르면 부동산 목록으로 바뀐다', async () => {
    render(<AdminPriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('부동산'))
    expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
  })

  it('가격 pill을 누르면 숫자 입력 팝업이 열리고, 확인하면 onConfirm에 갱신된 가격이 전달된다', async () => {
    const onConfirm = vi.fn()
    render(<AdminPriceSettingModal prices={PRICES} onConfirm={onConfirm} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /2,000 원/ })[0])
    expect(screen.getByRole('heading', { name: '반도체 IT' })).toBeInTheDocument()

    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: '←' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '9' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '00' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    await userEvent.click(screen.getByText('확인하기'))

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      stocks: expect.objectContaining({ semiconductor: 9000 }),
    }))
  })

  it('초기화 버튼을 누르면 현재 탭의 가격이 기본값으로 되돌아간다', async () => {
    const customPrices = { ...PRICES, stocks: { ...PRICES.stocks, semiconductor: 5000 } }
    render(<AdminPriceSettingModal prices={customPrices} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /5,000 원/ })).toBeInTheDocument()
    await userEvent.click(screen.getByText('초기화'))
    expect(screen.getAllByRole('button', { name: /2,000 원/ })[0]).toBeInTheDocument()
  })

  it('initialCategory가 realEstate이면 부동산 목록을 먼저 보여준다', () => {
    render(<AdminPriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={vi.fn()} initialCategory="realEstate" />)
    expect(screen.getByText('공동 가온개미')).toBeInTheDocument()
  })

  it('뒤로 버튼을 누르면 onClose가 호출된다', async () => {
    const onClose = vi.fn()
    render(<AdminPriceSettingModal prices={PRICES} onConfirm={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })
})
