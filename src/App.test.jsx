import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App routing', () => {
  it('/ 에서 팀 만들기 버튼을 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(screen.getByText('팀 만들기')).toBeInTheDocument()
  })

  it('/name 에서 이름 입력 필드를 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/name?code=ABC123']}><App /></MemoryRouter>)
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
  })
})
