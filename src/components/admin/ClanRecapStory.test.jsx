import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ClanRecapStory from './ClanRecapStory'

const player = (id, name, totalAssets) => ({ id, name, character: 'Innovator-사자', totalAssets })
const A = player('r1', '가온', 500)
const B = player('r2', '나래', 100)
const C = player('r3', '다솜', 300)
const D = player('r4', '라온', 200)

const RECAP = {
  teamCount: 2,
  memberCount: 4,
  teams: [
    { id: 'k1', name: '호랑이반', memberCount: 2, totalAssets: 600, members: [A, B] },
    { id: 'k2', name: '토끼반', memberCount: 2, totalAssets: 500, members: [C, D] },
  ],
  games: [
    {
      id: 's1',
      name: '게임 1',
      stockPrices: { bio: 5000, semiconductor: 3000, finance: 1000 },
      realEstatePrices: { gaon: 20000, chorong: 90000, dami: 70000 },
      players: [A, D],
    },
    {
      id: 's2',
      name: '게임 2',
      stockPrices: { bio: 2000, semiconductor: 7000, finance: 1000 },
      realEstatePrices: { gaon: 60000, chorong: 30000, dami: 10000 },
      players: [C, B],
    },
  ],
}

const TITLES = [
  '3학년 2반 팀 대결 결과',
  '게임별 통계를 확인해볼까요?',
  '게임 1에서는 가온님이 1등을 차지했어요!',
  '게임 2에서는 다솜님이 1등을 차지했군요!',
  '대망의 전체 게임 결과 1위는?',
  '흥미로운 결과도 있어요!',
  '주식의 경우 게임 1에서는 바이오가 가장 비쌌는데, 게임 2에서는 반도체가 가장 비쌌네요!',
  '부동산의 경우 게임 1에서는 아파트가 가장 비쌌는데, 게임 2에서는 단독주택이 가장 비쌌네요!',
  '다음은 팀(클랜)별 총 자산 합산 결과입니다!',
  '호랑이반이 우승을 차지했습니다!',
]

function renderStory(recap = RECAP) {
  const onClose = vi.fn()
  const utils = render(<ClanRecapStory className="3학년 2반" recap={recap} onClose={onClose} />)
  return { onClose, ...utils }
}

const progressStates = () => screen.getAllByTestId('recap-progress').map(s => s.dataset.state)
const heading = () => screen.getAllByRole('heading')[0].textContent
const pressNext = times => { for (let i = 0; i < times; i++) fireEvent.keyDown(window, { key: 'ArrowRight' }) }

function collectTitles() {
  const titles = [heading()]
  const count = screen.getAllByTestId('recap-progress').length
  for (let i = 1; i < count; i++) {
    pressNext(1)
    titles.push(heading())
  }
  return titles
}

describe('ClanRecapStory', () => {
  it('대화상자로 열리고 인트로부터 시작하며 진행 막대는 장 수만큼이다', () => {
    renderStory()
    expect(screen.getByRole('dialog', { name: '팀 대결 결과' })).toBeInTheDocument()
    expect(heading()).toBe(TITLES[0])
    expect(screen.getByText('2개 팀(클랜) 인원이 나뉘어져 2개의 게임을 진행했어요.')).toBeInTheDocument()
    expect(progressStates()).toEqual(['current', ...Array(9).fill('todo')])
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()
  })

  it('다음·이전 버튼으로 넘기고, 마지막 장에서는 다음 버튼이 비활성', async () => {
    renderStory()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(heading()).toBe(TITLES[1])
    expect(progressStates().slice(0, 3)).toEqual(['done', 'current', 'todo'])
    await userEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(heading()).toBe(TITLES[0])
    pressNext(9)
    expect(heading()).toBe(TITLES[9])
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
  })

  it('장 순서는 2-1부터 2-10까지다', () => {
    renderStory()
    expect(collectTitles()).toEqual(TITLES)
  })

  it('2-2에는 참여한 모든 캐릭터가 나온다', () => {
    renderStory()
    pressNext(1)
    for (const name of ['가온', '나래', '다솜', '라온']) expect(screen.getByText(name)).toBeInTheDocument()
  })

  it('게임 장은 1등을 크게, 나머지를 따로 보여 주고 축하 효과는 없다', () => {
    renderStory()
    pressNext(2)
    expect(screen.getAllByTestId('recap-winner').map(el => el.textContent)).toEqual(['가온'])
    expect(screen.getAllByTestId('recap-other').map(el => el.textContent)).toEqual(['라온'])
    expect(screen.queryByTestId('recap-celebration')).not.toBeInTheDocument()
  })

  it('전체 1위 장은 가장 총 자산이 많은 참여자에게 축하 효과를 준다', () => {
    renderStory()
    pressNext(4)
    expect(screen.getAllByTestId('recap-winner').map(el => el.textContent)).toEqual(['가온'])
    expect(screen.getByTestId('recap-celebration')).toBeInTheDocument()
    expect(screen.queryByTestId('recap-other')).not.toBeInTheDocument()
  })

  it('가격 장은 종목마다 차트 하나와 아이콘, 게임별 막대를 그린다', () => {
    renderStory()
    pressNext(6)
    const bio = screen.getByRole('img', { name: '바이오: 게임 1 5,000원(그 게임 최고가), 게임 2 2,000원' })
    expect(bio.querySelector('img')).toHaveAttribute('src', '/badges/stock/바이오헬스케어.png')
    expect(screen.getByRole('img', { name: /^반도체:/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^금융:/ })).toBeInTheDocument()
    expect(screen.getAllByTestId('recap-price-bar')).toHaveLength(6)
    expect(screen.getAllByTestId('recap-price-bar')[0].style.width).toBe(`${(5000 / 7000) * 100}%`)
    pressNext(1)
    expect(screen.getByRole('img', { name: /^단독주택:/ })).toBeInTheDocument()
  })

  it.each([
    [2, 'duel'],
    [3, 'triple'],
    [4, 'quad'],
    [5, 'list'],
  ])('총 자산 장은 %i팀이면 %s 구도로 팀별 합계를 보여 준다', (count, layout) => {
    const teams = Array.from({ length: count }, (_, i) => ({
      id: `k${i}`, name: `반${i}`, memberCount: 1, totalAssets: 1000 + i, members: [player(`r${i}`, `사람${i}`, 1000 + i)],
    }))
    renderStory({ ...RECAP, teamCount: count, teams, games: [] })
    const total = screen.getAllByTestId('recap-progress').length
    pressNext(total - 2)
    expect(screen.getByTestId('recap-arena').dataset.layout).toBe(layout)
    const panels = screen.getAllByTestId('recap-team')
    expect(panels).toHaveLength(count)
    expect(within(panels[0]).getByText('1,000원')).toBeInTheDocument()
    expect(within(panels[0]).getByRole('img', { name: '사람0' })).toBeInTheDocument()
  })

  it('우승 장은 우승 팀 캐릭터를 모두 보여 주고 축하 효과를 준다', () => {
    renderStory()
    pressNext(9)
    expect(screen.getAllByTestId('recap-winner').map(el => el.textContent)).toEqual(['가온', '나래'])
    expect(screen.getByText('총 자산 600원')).toBeInTheDocument()
    expect(screen.getByTestId('recap-celebration')).toBeInTheDocument()
  })

  it('동점이면 공동 1등·공동 우승으로 함께 보여 준다', () => {
    const tiedA = player('r1', '가온', 300)
    const tiedC = player('r3', '다솜', 300)
    renderStory({
      teamCount: 2,
      memberCount: 2,
      teams: [
        { id: 'k1', name: '팀 1', memberCount: 1, totalAssets: 300, members: [tiedA] },
        { id: 'k2', name: '팀 2', memberCount: 1, totalAssets: 300, members: [tiedC] },
      ],
      games: [{ id: 's1', name: '게임 1', stockPrices: null, realEstatePrices: null, players: [tiedA, tiedC] }],
    })
    const titles = collectTitles()
    expect(titles.at(-1)).toBe('팀 1, 팀 2가 공동 우승을 차지했습니다!')
    expect(screen.getAllByTestId('recap-winner')).toHaveLength(2)
  })

  it('게임이 동점이면 게임 장 제목에 공동 1등이라고 적는다', () => {
    const tiedA = player('r1', '가온', 300)
    const tiedC = player('r3', '다솜', 300)
    const other = player('r2', '나래', 100)
    renderStory({
      ...RECAP,
      games: [
        { id: 's1', name: '게임 1', stockPrices: null, realEstatePrices: null, players: [tiedA, tiedC] },
        { id: 's2', name: '게임 2', stockPrices: null, realEstatePrices: null, players: [other] },
      ],
    })
    pressNext(2)
    expect(heading()).toBe('게임 1에서는 가온님, 다솜님이 공동 1등을 차지했어요!')
  })

  it('게임이 하나면 게임별 장과 가격 비교 장을 건너뛴다', () => {
    renderStory({ ...RECAP, games: [RECAP.games[0]] })
    expect(collectTitles()).toEqual([TITLES[0], TITLES[4], TITLES[8], TITLES[9]])
  })

  it('주식 가격만 달랐으면 부동산 장 없이 진행한다', () => {
    const [first, second] = RECAP.games
    renderStory({ ...RECAP, games: [first, { ...second, realEstatePrices: first.realEstatePrices }] })
    const titles = collectTitles()
    expect(titles).toContain(TITLES[6])
    expect(titles).not.toContain(TITLES[7])
    expect(titles).toContain(TITLES[5])
  })

  it('두 게임의 가격이 모두 같으면 가격 비교 장을 모두 건너뛴다', () => {
    const [first, second] = RECAP.games
    renderStory({
      ...RECAP,
      games: [first, { ...second, stockPrices: first.stockPrices, realEstatePrices: first.realEstatePrices }],
    })
    const titles = collectTitles()
    expect(titles).not.toContain(TITLES[5])
    expect(titles).not.toContain(TITLES[6])
  })

  it('키보드 →/← 로 넘기고 Esc로 닫는다', () => {
    const { onClose } = renderStory()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(heading()).toBe(TITLES[1])
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(heading()).toBe(TITLES[0])
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('PageDown/PageUp으로 넘기고 Space는 다음으로 넘긴다', () => {
    renderStory()
    fireEvent.keyDown(window, { key: 'PageDown' })
    expect(heading()).toBe(TITLES[1])
    fireEvent.keyDown(window, { key: 'PageUp' })
    expect(heading()).toBe(TITLES[0])
    fireEvent.keyDown(window, { key: ' ' })
    expect(heading()).toBe(TITLES[1])
  })

  it('버튼에 포커스가 있을 때 Space는 장을 따로 넘기지 않는다', () => {
    renderStory()
    fireEvent.keyDown(screen.getByRole('button', { name: '다음' }), { key: ' ' })
    expect(heading()).toBe(TITLES[0])
  })

  it('열면 카드에 포커스가 가고 닫으면 이전 포커스로 돌아간다', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = renderStory()
    expect(document.activeElement).toBe(screen.getByTestId('recap-card'))
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('Tab 포커스는 대화상자 안에서 순환한다', () => {
    renderStory()
    const dialog = screen.getByRole('dialog')
    const items = dialog.querySelectorAll('button:not([disabled]), [data-recap-card]')
    const first = items[0]
    const lastItem = items[items.length - 1]
    lastItem.focus()
    fireEvent.keyDown(lastItem, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastItem)
  })

  it('카드의 왼쪽 1/3을 누르면 이전, 나머지를 누르면 다음', () => {
    renderStory()
    const card = screen.getByTestId('recap-card')
    card.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 500, right: 300, bottom: 500 })
    fireEvent.click(card, { clientX: 200 })
    expect(heading()).toBe(TITLES[1])
    fireEvent.click(card, { clientX: 50 })
    expect(heading()).toBe(TITLES[0])
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
