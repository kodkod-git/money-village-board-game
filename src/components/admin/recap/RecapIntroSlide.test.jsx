import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecapIntroSlide from './RecapIntroSlide'

const TEAMS = [
  { id: 'k1', name: '호랑이반', memberCount: 3 },
  { id: 'k2', name: '토끼반', memberCount: 4 },
]

describe('RecapIntroSlide', () => {
  it('수업 이름, 팀·게임 수, 팀별 인원, 넘기기 안내를 보여준다', () => {
    render(<RecapIntroSlide className="3학년 2반" teams={TEAMS} gameCount={2} />)
    expect(screen.getByRole('heading', { name: '3학년 2반 팀 대결 결과' })).toBeInTheDocument()
    expect(screen.getByText('2개 팀(클랜) 인원이 나뉘어져 2개의 게임을 진행했어요.')).toBeInTheDocument()
    expect(screen.getByText('호랑이반 · 3명')).toBeInTheDocument()
    expect(screen.getByText('토끼반 · 4명')).toBeInTheDocument()
    expect(screen.getByText('오른쪽으로 넘겨 결과를 확인하세요 ›')).toBeInTheDocument()
  })
})
