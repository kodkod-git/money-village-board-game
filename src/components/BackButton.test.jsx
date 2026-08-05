import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import BackButton from './BackButton'

describe('BackButton', () => {
  it('뒤로 버튼을 렌더링한다', () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument()
  })

  it('클릭 시 navigate(-1)을 호출한다', async () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('variant=intro는 intro 클래스를 적용한다', () => {
    render(<MemoryRouter><BackButton variant="intro" /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' }).className).toMatch(/intro/)
  })

  it('기본 variant는 body이다', () => {
    render(<MemoryRouter><BackButton /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로 가기' }).className).toMatch(/body/)
  })

  it('to와 label을 지정하면 해당 라벨을 보여주고 클릭 시 그 경로로 이동한다', async () => {
    render(<MemoryRouter><BackButton to="/" label="처음으로" /></MemoryRouter>)
    const btn = screen.getByRole('button', { name: '처음으로' })
    expect(btn).toBeInTheDocument()
    await userEvent.click(btn)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('onClick을 지정하면 navigate 대신 그 함수를 호출한다', async () => {
    const onClick = vi.fn()
    mockNavigate.mockClear()
    render(<MemoryRouter><BackButton onClick={onClick} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(onClick).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
