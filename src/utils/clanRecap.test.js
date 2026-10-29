import { describe, it, expect } from 'vitest'
import { rankTeams, topTeams, formatWon, RECAP_CATEGORIES } from './clanRecap'

const T = [
  { id: 'a', name: 'A', cash: 100 },
  { id: 'b', name: 'B', cash: 300 },
  { id: 'c', name: 'C', cash: 300 },
  { id: 'd', name: 'D', cash: 0 },
]

describe('clanRecap utils', () => {
  it('rankTeams: 값 내림차순, 동점이면 원래 순서', () => {
    expect(rankTeams(T, 'cash').map(t => t.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(T.map(t => t.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('topTeams: 1위 값과 같은 팀 모두, 빈 배열이면 []', () => {
    expect(topTeams(T, 'cash').map(t => t.id)).toEqual(['b', 'c'])
    expect(topTeams([], 'cash')).toEqual([])
  })

  it('formatWon: 천 단위 쉼표 + 원', () => {
    expect(formatWon(1234567)).toBe('1,234,567원')
    expect(formatWon(0)).toBe('0원')
  })

  it('카테고리 4개를 현금 → 주식 → 부동산 → 총 자산 순서로 둔다', () => {
    expect(RECAP_CATEGORIES.map(c => c.valueKey)).toEqual(['cash', 'stockValue', 'realEstateValue', 'totalAssets'])
  })
})
