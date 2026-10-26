import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import CompetitionResultCarousel from './CompetitionResultCarousel'

const TEAMS = [
  { sessionId: 's1', name: '팀 1', cash: 1, stockValue: 2, realEstateValue: 3, totalAssets: 6 },
  { sessionId: 's2', name: '팀 2', cash: 4, stockValue: 5, realEstateValue: 6, totalAssets: 15 },
]

function renderCarousel() {
  return render(
    <CompetitionResultCarousel teams={TEAMS} mySessionId="s1">
      <div>랭킹 본문</div>
    </CompetitionResultCarousel>
  )
}

function currentDot() {
  return screen.getAllByRole('button', { name: /번째 화면$/ }).findIndex(b => b.getAttribute('aria-current') === 'true')
}

describe('CompetitionResultCarousel', () => {
  it('현금 → 주식 → 부동산 → 총 자산 → 랭킹 순서로 5장을 그린다', () => {
    renderCarousel()
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      '더 많은 현금을 가진 팀은?',
      '주식으로 더 많은 돈을 번 팀은?',
      '부동산으로 더 많은 돈을 번 팀은?',
      '총 자산이 더 많은 팀은?',
    ])
    expect(screen.getByText('랭킹 본문')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /번째 화면$/ })).toHaveLength(5)
  })

  it('첫 장에서 시작하고, 첫 장에서는 이전 화살표가 비활성이다', () => {
    renderCarousel()
    expect(currentDot()).toBe(0)
    expect(screen.getByRole('button', { name: '이전 화면' })).toBeDisabled()
  })

  it('다음 화살표와 점으로 이동하고, 마지막 장에서는 다음 화살표가 비활성이다', async () => {
    renderCarousel()
    await userEvent.click(screen.getByRole('button', { name: '다음 화면' }))
    expect(currentDot()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: '5번째 화면' }))
    expect(currentDot()).toBe(4)
    expect(screen.getByRole('button', { name: '다음 화면' })).toBeDisabled()
  })

  it('손으로 쓸어넘겨 스크롤 위치가 바뀌면 현재 장을 따라간다', () => {
    renderCarousel()
    const track = screen.getByTestId('result-carousel-track')
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true })
    track.scrollLeft = 600
    fireEvent.scroll(track)
    expect(currentDot()).toBe(2)
  })
})
