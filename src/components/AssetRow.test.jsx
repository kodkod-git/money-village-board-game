import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AssetRow from './AssetRow'

describe('AssetRow', () => {
  it('명칭과 가격을 렌더링한다', () => {
    render(
      <AssetRow
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

  it('합계 "3개"를 렌더링한다', () => {
    render(
      <AssetRow
        image="/badges/estate/가온개미.png"
        label="단독 가온개미"
        price="2만원"
        value={3}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('3개')).toBeInTheDocument()
  })
})
