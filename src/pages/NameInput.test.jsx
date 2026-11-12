import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import NameInput from './NameInput'

function mockApi({ kind = 'class', name = null, classId = null, resolve = [] } = {}) {
  const resolveQueue = [...resolve]
  global.fetch = vi.fn(url => {
    if (url.endsWith('/kind')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ kind, name, classId }) })
    }
    if (url.includes('/players/resolve')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(resolveQueue.shift()) })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

async function renderAt(path) {
  render(<MemoryRouter initialEntries={[path]}><NameInput /></MemoryRouter>)
  const input = screen.getByRole('textbox')
  await waitFor(() => expect(input).not.toBeDisabled())
  return input
}

describe('NameInput', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockApi()
  })

  it('이름 입력 필드와 다음 버튼을 렌더링한다', async () => {
    await renderAt('/name?code=ABC123')
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
    expect(screen.getByText('다음 →')).toBeInTheDocument()
  })

  it('소속 입력란은 더 이상 렌더링하지 않는다', async () => {
    await renderAt('/name')
    expect(screen.queryByPlaceholderText('예) 경영학과')).not.toBeInTheDocument()
  })

  it('이름 입력 후 /select로 이동한다', async () => {
    const input = await renderAt('/name?code=ABC123')
    fireEvent.change(input, { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?name=%EC%B2%A0%EC%88%98&code=ABC123')
  })

  it('이름이 비어있으면 이동하지 않는다', async () => {
    await renderAt('/name?code=ABC123')
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('NameInput 대회', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('대회 QR로 들어오면 대회 이름과 실명 안내를 보여 준다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1' })
    await renderAt('/join?classId=c1')
    expect(screen.getByText('2026 시즌1')).toBeInTheDocument()
    expect(screen.getByText('실명을 입력하세요')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('예) 홍길동 (실명)')).toBeInTheDocument()
  })

  it('같은 이름이 없으면 officialPlayerId를 붙여 /select로 간다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1', resolve: [{ officialPlayerId: 'op1' }] })
    const input = await renderAt('/join?classId=c1')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/select?name=${encodeURIComponent('박병윤')}&classId=c1&officialPlayerId=op1`,
    ))
  })

  it('같은 이름이 있으면 확인 팝업을 띄우고 [네, 맞아요]로 기존 참가자로 간다', async () => {
    mockApi({
      kind: 'official', name: '2026 시즌1', classId: 'c1',
      resolve: [{ exists: true, label: '박병윤 (2026 시즌1)' }, { officialPlayerId: 'op-old' }],
    })
    const input = await renderAt('/join?classId=c1')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(await screen.findByText('박병윤 (2026 시즌1) 님이 맞나요?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '네, 맞아요' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/select?name=${encodeURIComponent('박병윤')}&classId=c1&officialPlayerId=op-old`,
    ))
  })

  it('[아니요]를 누르면 팝업을 닫고 이름을 바꾸라고 안내한다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1', resolve: [{ exists: true, label: '박병윤 (2026 시즌1)' }] })
    const input = await renderAt('/join?classId=c1')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    fireEvent.click(await screen.findByRole('button', { name: '아니요' }))
    expect(screen.queryByText('박병윤 (2026 시즌1) 님이 맞나요?')).not.toBeInTheDocument()
    expect(screen.getByText('같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: 박병윤B)')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('팀 코드로 들어와도 방이 대회면 그 대회 기준으로 확인한다', async () => {
    mockApi({ kind: 'official', name: '2026 시즌1', classId: 'c1', resolve: [{ officialPlayerId: 'op1' }] })
    const input = await renderAt('/join?code=AB12CD')
    fireEvent.change(input, { target: { value: '박병윤' } })
    fireEvent.click(screen.getByText('다음 →'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/select?name=${encodeURIComponent('박병윤')}&code=AB12CD&officialPlayerId=op1`,
    ))
    expect(global.fetch).toHaveBeenCalledWith('/api/contests/c1/players/resolve', expect.anything())
  })
})
