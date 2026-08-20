import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgePicker from './BadgePicker'

const NONE = [false, false, false, false, false, false]

describe('BadgePicker', () => {
  it('6개의 성공카드 타일을 렌더링한다', () => {
    render(<BadgePicker badges={NONE} onToggle={vi.fn()} />)
    expect(screen.getByText('의사소통 및 협상능력')).toBeInTheDocument()
    expect(screen.getByText('신용과 신뢰')).toBeInTheDocument()
  })

  it('선택된 카드에 선택 스타일을 적용한다', () => {
    const badges = [true, false, false, false, false, false]
    render(<BadgePicker badges={badges} onToggle={vi.fn()} />)
    const tile = screen.getByText('의사소통 및 협상능력').closest('button')
    expect(tile.className).toMatch(/tileSelected/)
  })

  it('타일 클릭 시 onToggle을 해당 인덱스로 호출한다', async () => {
    const onToggle = vi.fn()
    render(<BadgePicker badges={NONE} onToggle={onToggle} />)
    await userEvent.click(screen.getByText('문제해결능력'))
    expect(onToggle).toHaveBeenCalledWith(2)
  })
})
