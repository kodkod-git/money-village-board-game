import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BoothCategoryTabs from './BoothCategoryTabs'

describe('BoothCategoryTabs', () => {
  it('주식, 부동산 2개 카테고리만 렌더링한다', () => {
    render(<BoothCategoryTabs activeCategory="stock" onSelect={vi.fn()} />)
    expect(screen.getByText('주식')).toBeInTheDocument()
    expect(screen.getByText('부동산')).toBeInTheDocument()
    expect(screen.queryByText('노동')).toBeNull()
    expect(screen.queryByText('직업')).toBeNull()
    expect(screen.queryByText('은행')).toBeNull()
    expect(screen.queryByText('행운')).toBeNull()
  })

  it('카테고리를 클릭하면 onSelect가 해당 key로 호출된다', async () => {
    const handleSelect = vi.fn()
    render(<BoothCategoryTabs activeCategory="stock" onSelect={handleSelect} />)
    await userEvent.click(screen.getByText('부동산'))
    expect(handleSelect).toHaveBeenCalledWith('realEstate')
  })
})
