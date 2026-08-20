import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JobPicker from './JobPicker'

describe('JobPicker', () => {
  it('6개의 직업 타일을 렌더링한다', () => {
    render(<JobPicker value={null} onChange={vi.fn()} />)
    expect(screen.getByText('경영·금융')).toBeInTheDocument()
    expect(screen.getByText('생산·운송')).toBeInTheDocument()
  })

  it('선택된 직업 타일에 선택 스타일을 적용한다', () => {
    render(<JobPicker value="b" onChange={vi.fn()} />)
    const tile = screen.getByText('연구·기술').closest('button')
    expect(tile.className).toMatch(/tileSelected/)
  })

  it('타일 클릭 시 onChange를 해당 키로 호출한다', async () => {
    const onChange = vi.fn()
    render(<JobPicker value={null} onChange={onChange} />)
    await userEvent.click(screen.getByText('보건·교육'))
    expect(onChange).toHaveBeenCalledWith('c')
  })
})
