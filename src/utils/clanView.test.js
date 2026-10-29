import { describe, it, expect } from 'vitest'
import { moveInView } from './clanView'

const p = id => ({ resultId: id, name: id, character: 'c', teamName: 'T' })
const VIEW = {
  participants: [p('r1')],
  clans: [{ id: 'k1', name: '팀 1', members: [p('r2')] }, { id: 'k2', name: '팀 2', members: [] }],
}

describe('moveInView', () => {
  it('참여자를 클랜으로 옮긴다', () => {
    const next = moveInView(VIEW, 'r1', 'k2')
    expect(next.participants).toEqual([])
    expect(next.clans[1].members.map(m => m.resultId)).toEqual(['r1'])
  })

  it('클랜 사이를 옮긴다', () => {
    const next = moveInView(VIEW, 'r2', 'k2')
    expect(next.clans.map(c => c.members.map(m => m.resultId))).toEqual([[], ['r2']])
  })

  it('null이면 참여자 블럭 끝으로 돌려보낸다', () => {
    const next = moveInView(VIEW, 'r2', null)
    expect(next.participants.map(m => m.resultId)).toEqual(['r1', 'r2'])
    expect(next.clans[0].members).toEqual([])
  })

  it('없는 참여자면 그대로 돌려준다', () => {
    expect(moveInView(VIEW, 'nope', 'k1')).toBe(VIEW)
  })
})
