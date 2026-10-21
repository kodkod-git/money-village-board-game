import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn(), off: vi.fn(),
    emit: vi.fn((ev, data, cb) => cb?.({ ok: true })),
    connected: true, id: 'mock-id',
  }
  return { io: vi.fn(() => socket) }
})
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import CharacterSelect from './CharacterSelect'

let classMode = 'normal'
beforeEach(() => {
  classMode = 'normal'
  mockNavigate.mockClear()
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ mode: classMode }) }))
})

describe('CharacterSelect', () => {
  it('16개 캐릭터 카드를 렌더링한다', () => {
    render(
      <MemoryRouter initialEntries={['/select?code=ABC123&name=철수']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('button')).toHaveLength(18) // BackButton + 16 cards + 완료 button
  })

  it('카드 클릭 시 selected 상태로 변경된다', () => {
    render(
      <MemoryRouter initialEntries={['/select?code=ABC123&name=철수']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('URL에 classId가 있으면 다음 화면으로 그대로 전달한다', async () => {
    render(
      <MemoryRouter initialEntries={['/select?name=철수&classId=class-1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('classId=class-1')))
  })

  it('캐릭터 선택 완료 시 새 로비 화면으로 이동한다', async () => {
    render(
      <MemoryRouter initialEntries={['/select?name=철수&classId=class-1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/lobby\?/)))
  })

  it('경쟁 모드 수업이면 로비 대신 /compete/:classId로 이동한다', async () => {
    classMode = 'competition'
    render(
      <MemoryRouter initialEntries={['/select?name=철수&affiliation=서울초&classId=class-1']}>
        <CharacterSelect />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    fireEvent.click(screen.getByText('이 캐릭터로 시작하기'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/compete\/class-1\?/)))
    const url = new URL(mockNavigate.mock.calls[0][0], 'http://x')
    expect(url.searchParams.get('name')).toBe('철수')
    expect(url.searchParams.get('affiliation')).toBe('서울초')
    expect(url.searchParams.get('character')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/classes/class-1/mode')
  })
})
