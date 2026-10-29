import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClanRecapStory from './ClanRecapStory'

const RECAP = {
  teamCount: 2,
  memberCount: 4,
  teams: [
    { id: 'k1', name: '호랑이반', memberCount: 2, cash: 100, stockValue: 300, realEstateValue: 0, totalAssets: 500 },
    { id: 'k2', name: '토끼반', memberCount: 2, cash: 200, stockValue: 100, realEstateValue: 0, totalAssets: 400 },
  ],
}

function renderStory() {
  const onClose = vi.fn()
  const utils = render(<ClanRecapStory className="3학년 2반" recap={RECAP} onClose={onClose} />)
  return { onClose, ...utils }
}

const progressStates = () => screen.getAllByTestId('recap-progress').map(s => s.dataset.state)
const heading = () => screen.getAllByRole('heading')[0].textContent

describe('ClanRecapStory', () => {
  it('대화상자로 열리고 인트로부터 시작하며 진행 막대는 6칸이다', () => {
    renderStory()
    expect(screen.getByRole('dialog', { name: '팀 대결 결과' })).toBeInTheDocument()
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
    expect(screen.getByText('2개 팀 · 4명이 겨뤘어요')).toBeInTheDocument()
    expect(progressStates()).toEqual(['current', 'todo', 'todo', 'todo', 'todo', 'todo'])
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeInTheDocument()
  })

  it('다음·이전 버튼으로 넘기고, 마지막 장에서는 다음 버튼이 없다', async () => {
    renderStory()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(heading()).toBe('현금을 가장 많이 모은 팀은?')
    expect(progressStates()).toEqual(['done', 'current', 'todo', 'todo', 'todo', 'todo'])
    await userEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(heading()).toBe('최종 순위')
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument()
  })

  it('장 순서는 인트로 → 현금 → 주식 → 부동산 → 총 자산 → 최종 순위', async () => {
    renderStory()
    const titles = [heading()]
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      titles.push(heading())
    }
    expect(titles).toEqual([
      '3학년 2반 팀 대결 결과',
      '현금을 가장 많이 모은 팀은?',
      '주식으로 가장 많이 번 팀은?',
      '부동산으로 가장 많이 번 팀은?',
      '총 자산이 가장 많은 팀은?',
      '최종 순위',
    ])
  })

  it('키보드 →/← 로 넘기고 Esc로 닫는다', () => {
    const { onClose } = renderStory()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(heading()).toBe('현금을 가장 많이 모은 팀은?')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('카드의 왼쪽 1/3을 누르면 이전, 나머지를 누르면 다음', () => {
    renderStory()
    const card = screen.getByTestId('recap-card')
    card.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 500, right: 300, bottom: 500 })
    fireEvent.click(card, { clientX: 200 })
    expect(heading()).toBe('현금을 가장 많이 모은 팀은?')
    fireEvent.click(card, { clientX: 50 })
    expect(heading()).toBe('3학년 2반 팀 대결 결과')
  })

  it('닫기 버튼은 onClose를 부른다', async () => {
    const { onClose } = renderStory()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('열려 있는 동안 body 스크롤을 막고 닫히면 되돌린다', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderStory()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })
})
