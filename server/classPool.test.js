// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  joinPool, returnToPool, updatePoolPlayerState, markPoolDisconnected, removeFromPool,
  listPool, findPoolPlayer, deletePool, rememberSubmitted, findSubmitted, clearPools,
} from './classPool.js'
import { defaultGameState } from './rooms.js'

const PROFILE = { playerUuid: 'p1', name: '철수', affiliation: '서울초', character: 'Innovator-사자', socketId: 's1' }

beforeEach(() => clearPools())

describe('joinPool', () => {
  it('새 플레이어를 기본 gameState와 함께 연결된 상태로 넣는다', () => {
    const player = joinPool('class-1', PROFILE)
    expect(player).toMatchObject({ ...PROFILE, connected: true, gameState: defaultGameState() })
    expect(player.joinedAt).toBeInstanceOf(Date)
    expect(listPool('class-1')).toHaveLength(1)
  })

  it('같은 uuid로 다시 들어오면 gameState를 유지하고 socketId만 바꾼다', () => {
    joinPool('class-1', PROFILE)
    const saved = { ...defaultGameState(), cash: 5000, isCompleted: true }
    updatePoolPlayerState('class-1', 'p1', saved)
    markPoolDisconnected('s1')

    const again = joinPool('class-1', { ...PROFILE, socketId: 's2' })

    expect(again.gameState).toEqual(saved)
    expect(again.socketId).toBe('s2')
    expect(again.connected).toBe(true)
    expect(listPool('class-1')).toHaveLength(1)
  })

  it('수업마다 명단이 따로 있다', () => {
    joinPool('class-1', PROFILE)
    joinPool('class-2', { ...PROFILE, playerUuid: 'p2', socketId: 's2' })
    expect(listPool('class-1').map(p => p.playerUuid)).toEqual(['p1'])
    expect(listPool('class-2').map(p => p.playerUuid)).toEqual(['p2'])
    expect(listPool('class-3')).toEqual([])
  })
})

describe('updatePoolPlayerState', () => {
  it('명단에 있는 플레이어의 gameState를 바꾼다', () => {
    joinPool('class-1', PROFILE)
    const next = { ...defaultGameState(), job: 'a' }
    expect(updatePoolPlayerState('class-1', 'p1', next).gameState).toEqual(next)
  })

  it('명단에 없으면 null', () => {
    expect(updatePoolPlayerState('class-1', 'nobody', defaultGameState())).toBeNull()
  })
})

describe('markPoolDisconnected', () => {
  it('socketId로 찾아 연결 끊김으로 표시하고 수업 id를 돌려준다', () => {
    joinPool('class-1', PROFILE)
    expect(markPoolDisconnected('s1')).toBe('class-1')
    expect(findPoolPlayer('class-1', 'p1').connected).toBe(false)
  })

  it('명단에 없는 소켓이면 null', () => {
    expect(markPoolDisconnected('unknown')).toBeNull()
  })
})

describe('removeFromPool / returnToPool', () => {
  it('꺼낸 플레이어를 돌려주고 명단에서 지운다', () => {
    joinPool('class-1', PROFILE)
    const removed = removeFromPool('class-1', 'p1')
    expect(removed.playerUuid).toBe('p1')
    expect(listPool('class-1')).toEqual([])
    expect(removeFromPool('class-1', 'p1')).toBeNull()
  })

  it('방에서 돌아온 플레이어를 gameState·연결 상태 그대로 명단 끝에 넣는다', () => {
    joinPool('class-1', PROFILE)
    const gameState = { ...defaultGameState(), cash: 3000, isCompleted: true }
    returnToPool('class-1', {
      playerUuid: 'p2', name: '영희', affiliation: '', character: 'Adventurer-강아지',
      socketId: 's2', connected: false, gameState, isHost: false,
    })
    const list = listPool('class-1')
    expect(list.map(p => p.playerUuid)).toEqual(['p1', 'p2'])
    expect(list[1]).toMatchObject({ gameState, connected: false, socketId: 's2' })
    expect(list[1]).not.toHaveProperty('isHost')
  })
})

describe('deletePool / 제출 기록', () => {
  it('rememberSubmitted로 남긴 sessionId를 수업·uuid로 찾는다', () => {
    rememberSubmitted('class-1', 'p1', 'session-1')
    expect(findSubmitted('class-1', 'p1')).toBe('session-1')
    expect(findSubmitted('class-2', 'p1')).toBeNull()
  })

  it('deletePool은 명단과 제출 기록을 함께 지운다', () => {
    joinPool('class-1', PROFILE)
    rememberSubmitted('class-1', 'p1', 'session-1')
    deletePool('class-1')
    expect(listPool('class-1')).toEqual([])
    expect(findSubmitted('class-1', 'p1')).toBeNull()
  })
})
