import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import OrgQRModal from './OrgQRModal'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}))

describe('OrgQRModal', () => {
  it('소속 이름을 제목에 보여준다', () => {
    render(<OrgQRModal orgName="경영학과" onClose={vi.fn()} />)
    expect(screen.getByText('경영학과 소속 QR 코드')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<OrgQRModal orgName="경영학과" onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })

  it('affiliation 쿼리에 소속 이름을 인코딩한 URL로 QR을 생성한다', async () => {
    const QRCode = (await import('qrcode')).default
    render(<OrgQRModal orgName="경영 학과" onClose={vi.fn()} />)
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining('/join?affiliation=%EA%B2%BD%EC%98%81%20%ED%95%99%EA%B3%BC'),
      expect.anything()
    )
  })
})
