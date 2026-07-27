// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, sortRoomsByRecency
} from './rooms.js'

beforeEach(() => clearRooms())

describe('createRoom', () => {
  it('6자리 16진수 대문자 코드를 반환한다', () => {
    const room = createRoom()
    expect(room.code).toMatch(/^[A-F0-9]{6}$/)
    expect(room.players).toEqual([])
  })

  it('updatedAt을 createdAt과 동일하게 초기화한다', () => {
    const room = createRoom()
    expect(room.updatedAt).toBeInstanceOf(Date)
    expect(room.updatedAt.getTime()).toBe(room.createdAt.getTime())
  })

  it('classId를 지정하지 않으면 null로 초기화한다', () => {
    const room = createRoom()
    expect(room.classId).toBeNull()
  })

  it('classId를 지정하면 방에 저장한다', () => {
    const room = createRoom({ classId: 'class-1' })
    expect(room.classId).toBe('class-1')
  })
})

describe('getRoom', () => {
  it('생성된 방을 코드로 조회할 수 있다', () => {
    const { code } = createRoom()
    expect(getRoom(code)).not.toBeNull()
    expect(getRoom(code).code).toBe(code)
  })

  it('없는 코드는 null을 반환한다', () => {
    expect(getRoom('XXXXXX')).toBeNull()
  })
})

describe('addPlayer', () => {
  it('플레이어를 방에 추가한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(getRoom(code).players).toHaveLength(1)
  })

  it('4명 초과 시 Room is full 에러', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0 })
    }
    expect(() =>
      addPlayer(code, { socketId: 's5', name: 'p5', character: 'c5', isHost: false })
    ).toThrow('Room is full')
  })

  it('socketId 없는 플레이어 추가 시 에러', () => {
    const { code } = createRoom()
    expect(() =>
      addPlayer(code, { name: '철수', character: 'ptsc', isHost: true })
    ).toThrow('player.socketId is required')
  })

  it('affiliation을 포함한 플레이어를 추가한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, affiliation: '경영학과' })
    const player = getRoom(code).players[0]
    expect(player.affiliation).toBe('경영학과')
  })

  it('affiliation 미전달 시 빈 문자열로 저장된다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const player = getRoom(code).players[0]
    expect(player.affiliation).toBe('')
  })
})

describe('removePlayer', () => {
  it('마지막 플레이어 제거 시 방을 삭제하고 null을 반환한다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const result = removePlayer('s1')
    expect(result).toBeNull()
    // 그레이스 피리어드(30초) 동안 방 유지
    expect(getRoom(code)).not.toBeNull()
    // 30초 경과 후 방 삭제
    vi.advanceTimersByTime(30001)
    expect(getRoom(code)).toBeNull()
    vi.useRealTimers()
  })

  it('플레이어가 남아있으면 방을 유지하고 방 객체를 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    addPlayer(code, { socketId: 's2', name: '영희', character: 'ptsh', isHost: false })
    const result = removePlayer('s1')
    expect(result).not.toBeNull()
    expect(result.players).toHaveLength(1)
    expect(getRoom(code)).not.toBeNull()
  })

  it('알 수 없는 socketId는 null을 반환한다', () => {
    expect(removePlayer('unknown')).toBeNull()
  })

  it('같은 socketId로 두 번 호출해도 에러가 발생하지 않는다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    removePlayer('s1')
    expect(() => removePlayer('s1')).not.toThrow()
    expect(removePlayer('s1')).toBeNull()
  })
})

describe('isCharacterTaken', () => {
  it('다른 플레이어가 이미 선택한 캐릭터는 true', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(isCharacterTaken(code, 'ptsc', 's2')).toBe(true)
  })

  it('자신이 선택한 캐릭터는 false', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(isCharacterTaken(code, 'ptsc', 's1')).toBe(false)
  })
})

describe('createRoom prices', () => {
  it('주식/부동산 기본 가격을 초기화한다', () => {
    const room = createRoom()
    expect(room.prices.stocks).toEqual({
      semiconductor: 2000, finance: 2000, industrial: 2000,
      auto: 2000, bio: 2000, content: 2000,
    })
    expect(room.prices.realEstate).toEqual({
      gaon: 10000, nuri: 10000, dami: 10000,
      maru: 10000, chorong: 10000, hani: 10000,
    })
  })
})

describe('updateRoomPrices', () => {
  it('방의 가격을 업데이트하고 방 객체를 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const newPrices = {
      stocks: { semiconductor: 4000, finance: 6000, industrial: 2000, auto: 8000, bio: 10000, content: 12000 },
      realEstate: { gaon: 20000, nuri: 30000, dami: 10000, maru: 40000, chorong: 50000, hani: 60000 },
    }
    const room = updateRoomPrices('s1', newPrices)
    expect(room).not.toBeNull()
    expect(room.prices).toEqual(newPrices)
  })

  it('존재하지 않는 socketId는 null을 반환한다', () => {
    expect(updateRoomPrices('unknown', {})).toBeNull()
  })
})

describe('listAllRooms', () => {
  it('생성된 모든 방을 배열로 반환한다', () => {
    const room1 = createRoom()
    const room2 = createRoom()
    const codes = listAllRooms().map(r => r.code)
    expect(codes).toEqual(expect.arrayContaining([room1.code, room2.code]))
    expect(listAllRooms()).toHaveLength(2)
  })

  it('방이 없으면 빈 배열을 반환한다', () => {
    expect(listAllRooms()).toEqual([])
  })
})

describe('updatePlayerStateByUuid', () => {
  it('playerUuid로 플레이어를 찾아 gameState를 병합한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = updatePlayerStateByUuid(code, 'p1', { cash: 15000 })
    expect(room.players[0].gameState.cash).toBe(15000)
    expect(room.players[0].gameState.job).toBeNull()
  })

  it('존재하지 않는 방 코드는 null을 반환한다', () => {
    expect(updatePlayerStateByUuid('XXXXXX', 'p1', { cash: 1 })).toBeNull()
  })

  it('존재하지 않는 playerUuid는 null을 반환한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(updatePlayerStateByUuid(code, 'unknown', { cash: 1 })).toBeNull()
  })

  it('관리자가 필드를 수정하면 isCompleted를 true로 설정한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = updatePlayerStateByUuid(code, 'p1', { job: 'a' })
    expect(room.players[0].gameState.isCompleted).toBe(true)
  })
})

describe('updatedAt 갱신', () => {
  it('updatePlayerState 호출 시 room.updatedAt이 갱신된다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const before = getRoom(code).updatedAt
    vi.useFakeTimers()
    vi.setSystemTime(new Date(before.getTime() + 1000))
    updatePlayerState('s1', { cash: 1000 })
    vi.useRealTimers()
    expect(getRoom(code).updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })

  it('updatePlayerStateByUuid 호출 시 room.updatedAt이 갱신된다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const before = getRoom(code).updatedAt
    vi.useFakeTimers()
    vi.setSystemTime(new Date(before.getTime() + 1000))
    updatePlayerStateByUuid(code, 'p1', { cash: 1000 })
    vi.useRealTimers()
    expect(getRoom(code).updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })
})

describe('computeLiveRoomStatus', () => {
  function makeRoom({ updatedAt, isCompleted = false, noPlayers = false } = {}) {
    const { code } = createRoom()
    if (!noPlayers) {
      addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    }
    const room = getRoom(code)
    if (updatedAt) room.updatedAt = updatedAt
    if (isCompleted) room.players[0].gameState.isCompleted = true
    return room
  }

  const NOW = new Date('2026-01-01T00:00:00Z')

  it('29분 경과 시 live', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 29 * 60 * 1000) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('live')
  })

  it('정확히 30분 경과 시 stale', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 30 * 60 * 1000) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('stale')
  })

  it('1시간 59분 경과 시 stale', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - (119 * 60 * 1000)) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('stale')
  })

  it('정확히 2시간 경과 시 abandoned', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) })
    expect(computeLiveRoomStatus(room, NOW)).toBe('abandoned')
  })

  it('전원 완료 시 방치 시간과 무관하게 completed-but-unregistered', () => {
    const room = makeRoom({ updatedAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000), isCompleted: true })
    expect(computeLiveRoomStatus(room, NOW)).toBe('completed-but-unregistered')
  })

  it('플레이어가 없으면 completed-but-unregistered로 판정하지 않는다', () => {
    const room = makeRoom({ noPlayers: true, updatedAt: NOW })
    expect(computeLiveRoomStatus(room, NOW)).toBe('live')
  })
})

describe('sortRoomsByRecency', () => {
  it('updatedAt 기준 내림차순(최신순)으로 정렬한다', () => {
    const rooms = [
      { code: 'A', updatedAt: new Date('2026-01-01T00:00:00Z') },
      { code: 'B', updatedAt: new Date('2026-01-03T00:00:00Z') },
      { code: 'C', updatedAt: new Date('2026-01-02T00:00:00Z') },
    ]
    expect(sortRoomsByRecency(rooms).map(r => r.code)).toEqual(['B', 'C', 'A'])
  })

  it('updatedAt이 없으면 createdAt을 기준으로 정렬한다 (완료된 팀)', () => {
    const rooms = [
      { code: 'A', createdAt: '2026-01-01T00:00:00Z' },
      { code: 'B', createdAt: '2026-01-03T00:00:00Z' },
    ]
    expect(sortRoomsByRecency(rooms).map(r => r.code)).toEqual(['B', 'A'])
  })

  it('진행중인 방과 완료된 팀이 섞여 있어도 하나의 시간 기준으로 정렬한다', () => {
    const rooms = [
      { code: 'completed-old', createdAt: '2026-01-01T00:00:00Z' },
      { code: 'live-new', updatedAt: new Date('2026-01-05T00:00:00Z') },
      { code: 'completed-new', createdAt: '2026-01-04T00:00:00Z' },
    ]
    expect(sortRoomsByRecency(rooms).map(r => r.code)).toEqual(['live-new', 'completed-new', 'completed-old'])
  })

  it('원본 배열을 변형하지 않는다', () => {
    const rooms = [
      { code: 'A', updatedAt: new Date('2026-01-01T00:00:00Z') },
      { code: 'B', updatedAt: new Date('2026-01-02T00:00:00Z') },
    ]
    sortRoomsByRecency(rooms)
    expect(rooms.map(r => r.code)).toEqual(['A', 'B'])
  })
})

describe('deleteRoomByCode', () => {
  it('방을 삭제하고 true를 반환한다', () => {
    const { code } = createRoom()
    expect(deleteRoomByCode(code)).toBe(true)
    expect(getRoom(code)).toBeNull()
  })

  it('존재하지 않는 방 코드는 false를 반환한다', () => {
    expect(deleteRoomByCode('XXXXXX')).toBe(false)
  })
})
