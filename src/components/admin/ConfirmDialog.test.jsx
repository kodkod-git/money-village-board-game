import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('제목과 설명을 보여주고 취소 버튼 클릭 시 onCancel을 호출한다', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="전체 삭제"
        description="정말 삭제하시겠습니까?"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText('전체 삭제')).toBeInTheDocument()
    expect(screen.getByText('정말 삭제하시겠습니까?')).toBeInTheDocument()
    await userEvent.click(screen.getByText('아니요'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('확인 버튼 클릭 시 onConfirm을 호출한다', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="전체 등록" description="등록하시겠습니까?" onCancel={vi.fn()} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByText('예'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('confirmLabel을 지정하면 해당 텍스트로 버튼을 보여준다', () => {
    render(<ConfirmDialog title="학생 퇴장" description="퇴장시키겠습니까?" confirmLabel="퇴장시키기" onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('퇴장시키기')).toBeInTheDocument()
  })

  it('배경 클릭 시 onCancel을 호출한다', async () => {
    const onCancel = vi.fn()
    const { container } = render(<ConfirmDialog title="전체 삭제" description="설명" onCancel={onCancel} onConfirm={vi.fn()} />)
    await userEvent.click(container.firstChild)
    expect(onCancel).toHaveBeenCalled()
  })
})
