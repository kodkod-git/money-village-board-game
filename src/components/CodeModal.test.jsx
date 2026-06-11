import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CodeModal from './CodeModal'

describe('CodeModal', () => {
  it('onSubmit에 대문자 코드를 전달한다', () => {
    const onSubmit = vi.fn()
    render(<CodeModal onSubmit={onSubmit} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('팀 코드를 입력하세요'), {
      target: { value: 'abc123' },
    })
    fireEvent.click(screen.getByText('참가'))
    expect(onSubmit).toHaveBeenCalledWith('ABC123')
  })

  it('X 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<CodeModal onSubmit={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })
})
