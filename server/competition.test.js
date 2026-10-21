// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  joinCompetition, updateCompetitionPlayerState, assignPlayer, returnRoomPlayersToPool, competitionStatus,
} from './competition.js'
import { createRoom, getRoom, addAssignedPlayer, clearRooms, defaultGameState, getRoomBySocketId } from './rooms.js'
import { joinPool, listPool, findPoolPlayer, rememberSubmitted, clearPools } from './classPool.js'

const profile = (n) => ({ playerUuid: `p${n}`, name: `학생${n}`, affiliation: '', character: `c${n}`, socketId: `s${n}` })
const done = () => ({ ...defaultGameState(), cash: 1000, isCompleted: true })

beforeEach(() => {
  clearRooms()
  clearPools()
})

describe('joinCompetition', () => {
  it('처음 들어오면 대기 명단에 넣고 state pool을 돌려준다', () => {
    const result = joinCompetition('class-1', profile(1))
    expect(result).toEqual({ state: 'pool', gameState: defaultGameState() })
    expect(listPool('class-1')).toHaveLength(1)
  })

  it('팀에 배정된 플레이어가 다시 들어오면 방의 소켓을 바꾸고 state assigned를 돌려준다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...profile(1), gameState: done() })

    const result = joinCompetition('class-1', { ...profile(1), socketId: 's1-new' })

    expect(result).toEqual({ state: 'assigned', roomCode: code, gameState: done() })
    expect(getRoomBySocketId('s1-new').code).toBe(code)
    expect(listPool('class-1')).toEqual([])
  })

  it('결과가 이미 등록됐으면 state submitted와 sessionId를 돌려준다', () => {
    rememberSubmitted('class-1', 'p1', 'session-1')
    expect(joinCompetition('class-1', profile(1))).toEqual({ state: 'submitted', sessionId: 'session-1' })
  })
})

describe('updateCompetitionPlayerState', () => {
  it('대기 명단의 플레이어 상태를 저장한다', () => {
    joinPool('class-1', profile(1))
    expect(updateCompetitionPlayerState('class-1', 'p1', 's1', done())).toEqual({ room: null })
    expect(findPoolPlayer('class-1', 'p1').gameState).toEqual(done())
  })

  it('배정된 플레이어는 방에 저장하고 방을 돌려준다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, profile(1))
    const result = updateCompetitionPlayerState('class-1', 'p1', 's1', done())
    expect(result.room.code).toBe(code)
    expect(getRoom(code).players[0].gameState).toEqual(done())
  })

  it('어디에도 없으면 null', () => {
    expect(updateCompetitionPlayerState('class-1', 'p1', 's1', done())).toBeNull()
  })
})

describe('assignPlayer', () => {
  it('대기 명단 → 팀: gameState를 유지한 채 옮긴다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    joinPool('class-1', profile(1))
    joinCompetition('class-1', profile(1))
    updateCompetitionPlayerState('class-1', 'p1', 's1', done())

    const result = assignPlayer('class-1', 'p1', code)

    expect(result).toMatchObject({ ok: true, fromRoomCode: null, toRoomCode: code })
    expect(result.player.socketId).toBe('s1')
    expect(getRoom(code).players[0]).toMatchObject({ playerUuid: 'p1', gameState: done(), isHost: false })
    expect(listPool('class-1')).toEqual([])
  })

  it('팀 → 다른 팀으로 옮긴다', () => {
    const a = createRoom({ classId: 'class-1', mode: 'competition' })
    const b = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(a.code, { ...profile(1), gameState: done() })

    const result = assignPlayer('class-1', 'p1', b.code)

    expect(result).toMatchObject({ ok: true, fromRoomCode: a.code, toRoomCode: b.code })
    expect(getRoom(a.code).players).toEqual([])
    expect(getRoom(b.code).players[0].gameState).toEqual(done())
  })

  it('팀 → 대기 명단(toRoomCode null): gameState를 유지한다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...profile(1), gameState: done() })

    const result = assignPlayer('class-1', 'p1', null)

    expect(result).toMatchObject({ ok: true, fromRoomCode: code, toRoomCode: null })
    expect(getRoom(code).players).toEqual([])
    expect(findPoolPlayer('class-1', 'p1').gameState).toEqual(done())
    expect(getRoomBySocketId('s1')).toBeNull()
  })

  it('같은 팀으로 다시 놓으면 아무것도 바꾸지 않는다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, profile(1))
    expect(assignPlayer('class-1', 'p1', code)).toMatchObject({ ok: true, fromRoomCode: code, toRoomCode: code })
    expect(getRoom(code).players).toHaveLength(1)
  })

  it('4명이 찬 팀이면 409로 거부하고 플레이어는 제자리에 둔다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    for (let i = 1; i <= 4; i++) addAssignedPlayer(code, profile(i))
    joinPool('class-1', profile(5))

    expect(assignPlayer('class-1', 'p5', code)).toEqual({ ok: false, status: 409, error: '팀 인원이 가득 찼어요 (최대 4명)' })
    expect(findPoolPlayer('class-1', 'p5')).not.toBeNull()
  })

  it('없는 팀(결과 등록으로 사라진 팀 포함)이나 다른 수업의 팀이면 404', () => {
    const other = createRoom({ classId: 'class-2', mode: 'competition' })
    joinPool('class-1', profile(1))
    expect(assignPlayer('class-1', 'p1', 'ZZZZZZ')).toMatchObject({ ok: false, status: 404 })
    expect(assignPlayer('class-1', 'p1', other.code)).toMatchObject({ ok: false, status: 404 })
  })

  it('이미 다른 곳으로 옮겨졌거나 다른 수업의 플레이어면 409', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    joinPool('class-2', profile(1))
    expect(assignPlayer('class-1', 'p1', code)).toEqual({ ok: false, status: 409, error: '이미 다른 곳으로 옮겨진 참여자예요' })
  })
})

describe('returnRoomPlayersToPool', () => {
  it('경쟁 모드 방의 플레이어를 gameState 그대로 대기 명단에 돌려놓는다', () => {
    const { code } = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(code, { ...profile(1), gameState: done() })
    addAssignedPlayer(code, profile(2))

    const returned = returnRoomPlayersToPool(code)

    expect(returned.map(p => p.playerUuid)).toEqual(['p1', 'p2'])
    expect(getRoom(code).players).toEqual([])
    expect(listPool('class-1').map(p => p.playerUuid)).toEqual(['p1', 'p2'])
    expect(findPoolPlayer('class-1', 'p1').gameState).toEqual(done())
  })

  it('일반 모드 방은 건드리지 않는다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addAssignedPlayer(code, profile(1))
    expect(returnRoomPlayersToPool(code)).toEqual([])
    expect(getRoom(code).players).toHaveLength(1)
  })
})

describe('competitionStatus', () => {
  it('미배정·입력 중 인원과 등록할 팀 수를 세고, 모두 0이 아니면 준비되지 않았다', () => {
    const a = createRoom({ classId: 'class-1', mode: 'competition' })
    createRoom({ classId: 'class-1', mode: 'competition' }) // 빈 팀은 세지 않는다
    addAssignedPlayer(a.code, { ...profile(1), gameState: done() })
    addAssignedPlayer(a.code, profile(2))
    joinPool('class-1', profile(3))
    joinPool('class-1', profile(4))

    expect(competitionStatus('class-1')).toEqual({ unassigned: 2, inputting: 1, teams: 1, ready: false })
  })

  it('전원 배정·입력 완료면 ready', () => {
    const a = createRoom({ classId: 'class-1', mode: 'competition' })
    addAssignedPlayer(a.code, { ...profile(1), gameState: done() })
    expect(competitionStatus('class-1')).toEqual({ unassigned: 0, inputting: 0, teams: 1, ready: true })
  })

  it('팀이 하나도 없으면 ready가 아니다', () => {
    expect(competitionStatus('class-1').ready).toBe(false)
  })
})
