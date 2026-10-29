// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildClanView } from './clanView.js'

const row = (resultId, name, teamName = 'AB1234') => ({
  resultId, name, character: 'Adventurer-강아지', teamName, totalAssets: 1000,
})

describe('buildClanView', () => {
  it('클랜에 속한 결과는 members로, 나머지는 participants로 나눈다', () => {
    const view = buildClanView(
      [row('r1', '가'), row('r2', '나'), row('r3', '다')],
      [{ id: 'k1', name: '팀 1', memberIds: ['r2'] }],
    )
    expect(view.clans).toEqual([{
      id: 'k1', name: '팀 1',
      members: [{ resultId: 'r2', name: '나', character: 'Adventurer-강아지', teamName: 'AB1234' }],
    }])
    expect(view.participants.map(p => p.resultId)).toEqual(['r1', 'r3'])
  })

  it('participants는 팀 이름, 이름 순으로 정렬한다', () => {
    const view = buildClanView([row('r1', '하', 'B'), row('r2', '가', 'B'), row('r3', '나', 'A')], [])
    expect(view.participants.map(p => p.name)).toEqual(['나', '가', '하'])
  })

  it('members는 배정된 순서를 지키고, 결과가 없는 id는 건너뛴다', () => {
    const view = buildClanView(
      [row('r1', '가'), row('r2', '나')],
      [{ id: 'k1', name: '팀 1', memberIds: ['r2', 'gone', 'r1'] }],
    )
    expect(view.clans[0].members.map(m => m.resultId)).toEqual(['r2', 'r1'])
  })
})
