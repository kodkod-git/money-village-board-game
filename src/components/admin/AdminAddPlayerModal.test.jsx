import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AdminAddPlayerModal from './AdminAddPlayerModal'
import { CHARACTERS } from '../../constants/characters'
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'

const PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

beforeEach(() => {
  setAdminSession('test-token', { username: 'admin', isSuper: true })
})

afterEach(() => clearAdminSession())

describe('AdminAddPlayerModal', () => {
  it('이름을 입력하지 않으면 다음으로 진행할 수 없다', () => {
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('이름 입력')).toBeInTheDocument()
    expect(screen.getByText('다음')).toBeDisabled()
  })

  it('이름 입력 후 다음을 누르면 캐릭터 선택 단계로 넘어가고, 캐릭터를 고르기 전엔 다음이 막힌다', async () => {
    const user = userEvent.setup()
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음'))
    expect(screen.getByText('캐릭터 선택')).toBeInTheDocument()
    expect(screen.getByText('다음')).toBeDisabled()

    await user.click(screen.getByAltText(CHARACTERS[0]))
    expect(screen.getByText('다음')).not.toBeDisabled()
  })

  it('직업/성공열쇠/주식/부동산 단계는 선택 없이도 진행할 수 있고, 마지막 단계는 완료 버튼을 보여준다', async () => {
    const user = userEvent.setup()
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음'))
    await user.click(screen.getByAltText(CHARACTERS[0]))
    await user.click(screen.getByText('다음'))
    expect(screen.getByText('직업 선택')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('성공열쇠')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('주식')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('부동산')).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByText('현금')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('완료를 누르면 입력한 내용으로 등록 API를 호출하고 성공 시 onSaved를 호출한다', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ playerUuid: 'new-1' }) })

    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={onSaved} onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음'))
    await user.click(screen.getByAltText(CHARACTERS[0]))
    for (let i = 0; i < 5; i++) await user.click(screen.getByText('다음'))
    await user.click(screen.getByText('완료'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/rooms/AB1234/players',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({
          name: '홍길동',
          character: CHARACTERS[0],
          job: null,
          badges: [false, false, false, false, false, false],
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          cash: 0,
        }),
      })
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('✕ 클릭 시 확인 팝업을 보여주고, 확인하면 아무 요청도 보내지 않고 닫는다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn()
    render(<AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByLabelText('닫기'))
    expect(screen.getByText(/지금까지 입력한 내용이 사라집니다/)).toBeInTheDocument()
    await user.click(screen.getByText('취소하기'))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
