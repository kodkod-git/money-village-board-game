import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AssetCard from './AssetCard'

describe('AssetCard', () => {
  it('명칭과 가격을 렌더링한다', () => {
    render(
      <AssetCard
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('단독 가온개미')).toBeInTheDocument()
    expect(screen.getByText('2만원')).toBeInTheDocument()
  })

  it('현재 수량을 스테퍼 안에 표시한다', () => {
    render(
      <AssetCard
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
