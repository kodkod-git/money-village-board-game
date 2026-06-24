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

  it('이름 입력 후 /select로 이동한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('예) 경영학과'), { target: { value: '경영학과' } })
    fireEvent.change(screen.getByPlaceholderText('예) 홍길동'), { target: { value: '철수' } })
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).toHaveBeenCalledWith('/select?affiliation=%EA%B2%BD%EC%98%81%ED%95%99%EA%B3%BC&name=%EC%B2%A0%EC%88%98&code=ABC123')
  })

  it('이름이나 소속이 비어있으면 이동하지 않는다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><NameInput /></MemoryRouter>)
    fireEvent.click(screen.getByText('다음 →'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('소속 입력 필드가 이름 입력 필드 위에 렌더링된다', () => {
    render(<MemoryRouter><NameInput /></MemoryRouter>)
    const affiliationInput = screen.getByPlaceholderText('예) 경영학과')
    const nameInput = screen.getByPlaceholderText('예) 홍길동')
    expect(affiliationInput).toBeInTheDocument()
    expect(affiliationInput.compareDocumentPosition(nameInput))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
