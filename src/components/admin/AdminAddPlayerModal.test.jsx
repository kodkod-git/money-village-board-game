import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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

// BackButton이 useNavigate를 쓰므로 라우터 안에서 렌더링한다.
function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <AdminAddPlayerModal code="AB1234" prices={PRICES} onSaved={vi.fn()} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  )
}

// 이름 → 캐릭터 단계를 지나 직업 단계에 도착한다.
async function goToAssetSteps(user) {
  await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
  await user.click(screen.getByText('다음 →'))
  await user.click(screen.getByAltText(CHARACTERS[0]))
  await user.click(screen.getByText('다음'))
}

describe('AdminAddPlayerModal', () => {
  it('이름을 입력하지 않으면 다음으로 진행할 수 없다', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: '팀원 등록' })).toBeInTheDocument()
    expect(screen.getByText('다음 →')).toBeDisabled()
  })

  it('이름 입력 후 다음을 누르면 캐릭터 선택 단계로 넘어가고, 캐릭터를 고르기 전엔 다음이 막힌다', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByPlaceholderText('예) 홍길동'), '홍길동')
    await user.click(screen.getByText('다음 →'))
    expect(screen.getByRole('heading', { name: '캐릭터 선택' })).toBeInTheDocument()
    expect(screen.getByText('다음')).toBeDisabled()

    await user.click(screen.getByAltText(CHARACTERS[0]))
    expect(screen.getByText('다음')).not.toBeDisabled()
  })

  it('직업/성공열쇠/주식/부동산 단계는 선택 없이도 진행할 수 있고, 마지막 단계는 완료 버튼을 보여준다', async () => {
    const user = userEvent.setup()
    renderModal()

    await goToAssetSteps(user)
    expect(screen.getByRole('heading', { name: '직업 선택' })).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '성공열쇠' })).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '주식' })).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '부동산' })).toBeInTheDocument()

    await user.click(screen.getByText('다음'))
    expect(screen.getByRole('heading', { name: '현금' })).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('완료를 누르면 입력한 내용으로 등록 API를 호출하고 성공 시 onSaved를 호출한다', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ playerUuid: 'new-1' }) })

    renderModal({ onSaved })
    await goToAssetSteps(user)
    for (let i = 0; i < 4; i++) await user.click(screen.getByText('다음'))
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

  it('첫 단계에서 뒤로 가기를 누르면 확인 팝업을 보여주고, 확인하면 아무 요청도 보내지 않고 닫는다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn()
    renderModal({ onClose })

    await user.click(screen.getByLabelText('뒤로 가기'))
    expect(screen.getByText(/지금까지 입력한 내용이 사라집니다/)).toBeInTheDocument()
    await user.click(screen.getByText('취소하기'))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('완료 요청이 실패(res.ok=false)하면 onSaved를 호출하지 않고 모달을 닫지 않는다', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    renderModal({ onSaved })
    await goToAssetSteps(user)
    for (let i = 0; i < 4; i++) await user.click(screen.getByText('다음'))
    await user.click(screen.getByText('완료'))

    expect(global.fetch).toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '현금' })).toBeInTheDocument()
  })

  it('현금 단계에서 입력한 값이 완료 시 요청 본문에 그대로 반영된다', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ playerUuid: 'new-1' }) })

    renderModal()
    await goToAssetSteps(user)
    for (let i = 0; i < 4; i++) await user.click(screen.getByText('다음'))

    await user.click(screen.getByText('예: 5000'))
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '00' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: '확인' }))

    await user.click(screen.getByText('완료'))

    const call = global.fetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.cash).toBe(5000)
  })
})

describe('AdminAddPlayerModal — 참가자 화면과 같은 구성', () => {
  it('자산 입력 단계는 참가자 화면과 같은 5단계 StepBar를 보여준다', async () => {
    const user = userEvent.setup()
    renderModal()
    await goToAssetSteps(user)
    for (const label of ['직업', '성공열쇠', '주식', '부동산', '현금']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('이름')).not.toBeInTheDocument()
  })

  it('중간 단계에서 뒤로 가기를 누르면 이전 단계로 돌아간다', async () => {
    const user = userEvent.setup()
    renderModal()
    await goToAssetSteps(user)
    await user.click(screen.getByLabelText('뒤로 가기'))
    expect(screen.getByRole('heading', { name: '캐릭터 선택' })).toBeInTheDocument()
  })

  it('프레임 바깥을 누르면 입력 취소 확인 팝업을 보여준다', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('dialog').parentElement)
    expect(screen.getByText(/지금까지 입력한 내용이 사라집니다/)).toBeInTheDocument()
  })
})
