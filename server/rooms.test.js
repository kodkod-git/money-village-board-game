// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms, updateRoomPrices, listAllRooms,
  updatePlayerStateByUuid
} from './rooms.js'

beforeEach(() => clearRooms())

describe('createRoom', () => {
  it('6자리 16진수 대문자 코드를 반환한다', () => {
    const room = createRoom()
    expect(room.code).toMatch(/^[A-F0-9]{6}$/)
    expect(room.players).toEqual([])
  })

  it('updatedAt을 createdAt과 동일하게, hidden을 false로 초기화한다', () => {
    const room = createRoom()
    expect(room.hidden).toBe(false)
    expect(room.updatedAt).toBeInstanceOf(Date)
    expect(room.updatedAt.getTime()).toBe(room.createdAt.getTime())
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
})
