import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssetListEditor from './AssetListEditor'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES } from '../constants/gameData'

const VALUES = { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 }

describe('AssetListEditor', () => {
  it('각 항목의 라벨과 수량을 렌더링한다', () => {
    render(
      <AssetListEditor
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        priceLabels={ESTATE_PRICES}
        imageFolder="estate"
        values={VALUES}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('단독 가온개미')).toBeInTheDocument()
    expect(screen.getAllByText('2만원').length).toBeGreaterThan(0)
  })

  it('+ 버튼 클릭 시 onChange를 해당 키와 증가된 수량으로 호출한다', async () => {
    const onChange = vi.fn()
    render(
      <AssetListEditor
        labels={REAL_ESTATE_LABELS}
        images={ESTATE_IMAGES}
        priceLabels={ESTATE_PRICES}
        imageFolder="estate"
        values={VALUES}
        onChange={onChange}
      />
    )
    const rows = screen.getAllByLabelText('수량 증가')
    await userEvent.click(rows[0])
    expect(onChange).toHaveBeenCalledWith('gaon', 2)
  })
})
