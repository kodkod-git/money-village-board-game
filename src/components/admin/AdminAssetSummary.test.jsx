import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminAssetSummary from './AdminAssetSummary'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES } from '../../constants/gameData'

const ZERO = { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('AdminAssetSummary', () => {
  it('보유한 항목만 아이콘·이름·수량으로 렌더한다', () => {
    render(
      <AdminAssetSummary
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        values={{ ...ZERO, gaon: 2 }}
        folder="estate"
        unit="개"
        testIdPrefix="t-estate"
      />
    )
    expect(screen.getByTestId('t-estate-gaon')).toHaveTextContent('단독 가온개미2개')
    expect(screen.queryByTestId('t-estate-nuri')).not.toBeInTheDocument()
  })

  it('보유 항목이 없으면 "미보유"를 렌더한다', () => {
    render(
      <AdminAssetSummary
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        values={ZERO}
        folder="estate"
        unit="개"
        testIdPrefix="t-estate"
      />
    )
    expect(screen.getByText('미보유')).toBeInTheDocument()
  })
})
