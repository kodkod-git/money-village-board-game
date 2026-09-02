import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach } from 'vitest'
import Toaster from './Toaster'
import { toast, getToasts, _resetToasts } from '../utils/toast'

describe('Toaster', () => {
  afterEach(() => _resetToasts())

  it('토스트가 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<Toaster />)
    expect(container).toBeEmptyDOMElement()
  })

  it('toast()로 추가된 메시지를 표시한다', () => {
    render(<Toaster />)
    act(() => { toast('가격이 저장됐어요') })
    expect(screen.getByText('가격이 저장됐어요')).toBeInTheDocument()
  })

  it('여러 토스트를 동시에 표시한다', () => {
    render(<Toaster />)
    act(() => { toast('첫 번째'); toast('두 번째') })
    expect(screen.getByText('첫 번째')).toBeInTheDocument()
    expect(screen.getByText('두 번째')).toBeInTheDocument()
  })

  it('토스트를 클릭하면 사라진다', async () => {
    render(<Toaster />)
    act(() => { toast('닫아보세요', { duration: 0 }) })
    await userEvent.click(screen.getByText('닫아보세요'))
    expect(screen.queryByText('닫아보세요')).toBeNull()
    expect(getToasts()).toHaveLength(0)
  })

  it('스크린리더가 읽도록 live region으로 감싼다', () => {
    render(<Toaster />)
    act(() => { toast('알림') })
    expect(screen.getByText('알림').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite')
  })
})
