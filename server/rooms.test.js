import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRoom, getRoom, addPlayer, removePlayer,
  isCharacterTaken, clearRooms
} from './rooms.js'

beforeEach(() => clearRooms())

describe('createRoom', () => {
  it('6자리 영대문자+숫자 코드를 반환한다', () => {
    const room = createRoom()
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(room.players).toEqual([])
  })
})

describe('getRoom', () => {
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
})

describe('removePlayer', () => {
  it('socketId로 플레이어를 제거한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    removePlayer('s1')
    expect(getRoom(code).players).toHaveLength(0)
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
