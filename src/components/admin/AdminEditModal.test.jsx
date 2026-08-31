import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminEditModal from './AdminEditModal'

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

describe('AdminEditModal', () => {
  it('places the player name below the back button area', () => {
    const { container } = render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(container.querySelector('[class*="profileHeader"]')).toHaveTextContent('김민준')
  })

  it('shows owned real estate and stock quantities in the edit summary', () => {
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByTestId('admin-real-estate-holding-gaon')).toHaveTextContent('1개')
    expect(screen.getByTestId('admin-stock-holding-semiconductor')).toHaveTextContent('2주')
  })

  it('직업/현금/총자산 값을 보여준다', () => {
    const { container } = render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={vi.fn()} />)
    // 직업은 헤더(이름 아래)와 직업 카드 두 곳에 표시된다.
    expect(screen.getAllByText('경영·금융')).toHaveLength(2)
    expect(container.querySelector('img[src="/badges/job/경영금융.png"]')).toBeInTheDocument()
    expect(screen.getByText('125,000원')).toBeInTheDocument()
    // cash 125000 + stockValue(4000) + realEstateValue(10000) = 139000; badgeCount 1 → ×0.5 = 69,500원
    expect(screen.getByText('69,500원')).toBeInTheDocument()
  })

  it('직업 수정 버튼 클릭 후 직업 선택 및 확인 시 onSave("job", key)를 호출한다', async () => {
    const onSave = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByTestId('edit-job'))
    await userEvent.click(screen.getByText('보건·교육'))
    await userEvent.click(screen.getByText('확인'))
    expect(onSave).toHaveBeenCalledWith('job', 'c')
  })

  it('현금 수정 시 onSave("cash", value)를 호출한다', async () => {
    const onSave = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByTestId('edit-cash'))
    const input = screen.getByLabelText('현금')
    await userEvent.clear(input)
    await userEvent.type(input, '5')
    await userEvent.click(screen.getByText('확인'))
    expect(onSave).toHaveBeenCalledWith('cash', 5)
  })

  it('현금을 10억원 초과로 입력하면 10억원으로 클램프된다', async () => {
    const onSave = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByTestId('edit-cash'))
    const input = screen.getByLabelText('현금')
    await userEvent.clear(input)
    await userEvent.type(input, '9999999999')
    await userEvent.click(screen.getByText('확인'))
    expect(onSave).toHaveBeenCalledWith('cash', 1000000000)
  })

  it('뒤로 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })

  it('readOnly일 때는 모든 수정 버튼을 숨기지만 값과 뒤로가기는 그대로 보여준다', async () => {
    const onClose = vi.fn()
    render(<AdminEditModal player={PLAYER} prices={PRICES} onClose={onClose} readOnly />)

    expect(screen.queryByTestId('edit-job')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-badges')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-cash')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-realEstate')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-stocks')).not.toBeInTheDocument()

    expect(screen.getAllByText('경영·금융')).toHaveLength(2)
    expect(screen.getByText('125,000원')).toBeInTheDocument()

    await userEvent.click(screen.getByText('‹ 뒤로'))
    expect(onClose).toHaveBeenCalled()
  })

  it('readOnly 여부와 무관하게 같은 컬럼 레이아웃 클래스를 사용한다 (열 수는 컨테이너 폭에 따라 CSS가 반응형으로 결정)', () => {
    const { container: readOnlyContainer } = render(
      <AdminEditModal player={PLAYER} prices={PRICES} onClose={vi.fn()} readOnly />
    )
    const { container: editableContainer } = render(
      <AdminEditModal player={PLAYER} prices={PRICES} onSave={vi.fn()} onClose={vi.fn()} />
    )
    const readOnlyColumns = readOnlyContainer.querySelector('[class*="columns"]')
    const editableColumns = editableContainer.querySelector('[class*="columns"]')
    expect(readOnlyColumns.className).toBe(editableColumns.className)
  })
})
