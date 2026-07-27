import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import NameInput from './NameInput'

describe('NameInput', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('이름 입력 필드와 다음 버튼을 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
    expect(screen.getByText('다음 →')).toBeInTheDocument()
  })

  it('소속 입력란은 더 이상 렌더링하지 않는다', () => {
    render(<MemoryRouter><NameInput /></MemoryRouter>)
    expect(screen.queryByPlaceholderText('예) 경영학과')).not.toBeInTheDocument()
  })

  it('이름 입력 후 /select로 이동한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) 홍길동'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?name=%EC%B2%A0%EC%88%98&code=ABC123')
  })

  it('이름이 비어있으면 이동하지 않는다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('URL에 classId가 있으면 이름 입력 후 그대로 다음 화면에 전달한다', () => {
    render(<MemoryRouter initialEntries={['/name?classId=class-1']}><NameInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) 홍길동'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?name=%EC%B2%A0%EC%88%98&classId=class-1')
  })
})
