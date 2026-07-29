import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClassQRModal from './ClassQRModal'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}))

describe('ClassQRModal', () => {
  it('수업 이름을 제목에 보여준다', () => {
    render(<ClassQRModal classId="class-1" name="3학년 2반" onClose={vi.fn()} />)
    expect(screen.getByText('3학년 2반 수업 QR 코드')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<ClassQRModal classId="class-1" name="3학년 2반" onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })

  it('classId 쿼리로 QR을 생성한다', async () => {
    const QRCode = (await import('qrcode')).default
    render(<ClassQRModal classId="class-abc-123" name="3학년 2반" onClose={vi.fn()} />)
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining('/join?classId=class-abc-123'),
      expect.anything()
    )
  })
})
