import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AlertModal from './AlertModal'

describe('AlertModal', () => {
  it('제목과 메시지를 표시한다', () => {
    render(<AlertModal title="방이 사라졌어요" message="방장이 나가서 방이 삭제되었어요." onConfirm={() => {}} />)
    expect(screen.getByText('방이 사라졌어요')).toBeInTheDocument()
    expect(screen.getByText('방장이 나가서 방이 삭제되었어요.')).toBeInTheDocument()
  })

  it('확인 버튼을 누르면 onConfirm을 호출한다', async () => {
    const onConfirm = vi.fn()
    render(<AlertModal message="안내" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('confirmLabel로 버튼 문구를 바꿀 수 있다', () => {
    render(<AlertModal message="안내" confirmLabel="로비로" onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: '로비로' })).toBeInTheDocument()
  })

  it('title이 없으면 제목을 렌더링하지 않는다', () => {
    render(<AlertModal message="안내만" onConfirm={() => {}} />)
    expect(screen.getByText('안내만')).toBeInTheDocument()
  })
})
