import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BoothCategoryTabs from './BoothCategoryTabs'

describe('BoothCategoryTabs', () => {
  it('6개 카테고리를 모두 렌더링한다', () => {
    render(<BoothCategoryTabs activeCategory="stock" onSelect={vi.fn()} />)
    ;['노동', '직업', '은행', '주식', '부동산', '행운'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('비활성 카테고리를 클릭해도 onSelect가 호출되지 않는다', async () => {
    const handleSelect = vi.fn()
    render(<BoothCategoryTabs activeCategory="stock" onSelect={handleSelect} />)
    await userEvent.click(screen.getByText('노동'))
    expect(handleSelect).not.toHaveBeenCalled()
  })

  it('활성 카테고리를 클릭하면 onSelect가 해당 key로 호출된다', async () => {
    const handleSelect = vi.fn()
    render(<BoothCategoryTabs activeCategory="stock" onSelect={handleSelect} />)
    await userEvent.click(screen.getByText('부동산'))
    expect(handleSelect).toHaveBeenCalledWith('realEstate')
  })

  it('비활성 카테고리는 disabled 속성을 가진다', () => {
    render(<BoothCategoryTabs activeCategory="stock" onSelect={vi.fn()} />)
    expect(screen.getByText('은행').closest('button')).toBeDisabled()
  })
})
