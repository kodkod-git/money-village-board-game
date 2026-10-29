import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapIntroSlide from './RecapIntroSlide'

describe('RecapIntroSlide', () => {
  it('수업 이름, 팀 수·인원, 넘기기 안내를 보여준다', () => {
    render(<RecapIntroSlide className="3학년 2반" teamCount={3} memberCount={12} />)
    expect(screen.getByRole('heading', { name: '3학년 2반 팀 대결 결과' })).toBeInTheDocument()
    expect(screen.getByText('3개 팀 · 12명이 겨뤘어요')).toBeInTheDocument()
    expect(screen.getByText('오른쪽으로 넘겨 결과를 확인하세요 ›')).toBeInTheDocument()
  })
})
