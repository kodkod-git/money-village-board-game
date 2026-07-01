import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App routing', () => {
  it('/ 에서 랜딩페이지를 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(screen.getByText('머니빌리지')).toBeInTheDocument()
  })

  it('/join 에서 이름 입력 필드를 렌더링한다', () => {
    render(<MemoryRouter initialEntries={['/join?code=ABC123']}><App /></MemoryRouter>)
    expect(screen.getByPlaceholderText('예) 홍길동')).toBeInTheDocument()
  })
})
