import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SurveyQRModal, { SURVEY_URL } from './SurveyQRModal'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}))

describe('SurveyQRModal', () => {
  it('만족도 조사 QR 코드 제목을 보여준다', () => {
    render(<SurveyQRModal onClose={vi.fn()} />)
    expect(screen.getByText('만족도 조사 QR 코드')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    render(<SurveyQRModal onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })

  it('만족도 조사 구글 폼 링크로 QR을 생성한다', async () => {
    const QRCode = (await import('qrcode')).default
    render(<SurveyQRModal onClose={vi.fn()} />)
    expect(SURVEY_URL).toBe('https://forms.gle/i49BrHNQ8UgDucKH8')
    expect(QRCode.toDataURL).toHaveBeenCalledWith(SURVEY_URL, expect.anything())
  })
})
