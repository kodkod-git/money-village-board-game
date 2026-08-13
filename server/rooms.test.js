// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createRoom, getRoom, addPlayer, removePlayer, markDisconnected,
  isCharacterTaken, clearRooms, updateRoomPricesByCode, listAllRooms,
  updatePlayerStateByUuid, updatePlayerState, computeLiveRoomStatus,
  deleteRoomByCode, deleteRoomsByClassId, sortRoomsByCreationOrder,
  listPublicRoomsByClassId, getRoomBySocketId, removePlayerByUuid, updateRoomTitle
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

  it('title을 지정하지 않으면 null로 초기화한다', () => {
    const room = createRoom()
    expect(room.title).toBeNull()
  })

  it('title을 지정하면 방에 저장한다', () => {
    const room = createRoom({ title: 'TEAM 1' })
    expect(room.title).toBe('TEAM 1')
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

describe('addPlayer 재접속 (playerUuid upsert)', () => {
  it('같은 playerUuid로 다시 addPlayer를 호출하면 새 항목을 추가하지 않고 socketId만 갱신한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(room.players).toHaveLength(1)
    expect(room.players[0].socketId).toBe('s1-new')
  })

  it('재접속 시 기존 gameState를 보존한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    updatePlayerStateByUuid(code, 'p1', { cash: 5000 })
    const room = addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(room.players[0].gameState.cash).toBe(5000)
  })

  it('playerUuid가 없으면 매번 새 항목으로 추가한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const room = addPlayer(code, { socketId: 's2', name: '영희', character: 'pasc', isHost: false })
    expect(room.players).toHaveLength(2)
  })

  it('신규 참가자에게는 MAX_PLAYERS 제한이 그대로 적용된다', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0, playerUuid: `uuid${i}` })
    }
    expect(() =>
      addPlayer(code, { socketId: 's5', name: 'p5', character: 'c5', isHost: false, playerUuid: 'uuid5' })
    ).toThrow('Room is full')
  })

  it('재접속(같은 playerUuid)은 MAX_PLAYERS 제한을 우회한다', () => {
    const { code } = createRoom()
    for (let i = 0; i < 4; i++) {
      addPlayer(code, { socketId: `s${i}`, name: `p${i}`, character: `c${i}`, isHost: i === 0, playerUuid: `uuid${i}` })
    }
    const room = addPlayer(code, { socketId: 's0-new', name: 'p0', character: 'c0', isHost: true, playerUuid: 'uuid0' })
    expect(room.players).toHaveLength(4)
  })

  it('재접속 후 이전 socketId는 socketToRoom 매핑에서 제거된다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1-old', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })

    // 이전 socketId는 더 이상 어떤 방에도 매핑되지 않아야 한다 (누수 방지)
    expect(removePlayer('s1-old')).toBeNull()
    // 재접속한 플레이어는 새 socketId로 여전히 방에 남아있어야 한다
    // (removePlayer('s1-old') 호출이 실수로 재접속한 플레이어를 제거하지 않았음을 증명)
    const room = getRoom(code)
    expect(room.players).toHaveLength(1)
    expect(room.players[0].socketId).toBe('s1-new')
  })
})

describe('removePlayer', () => {
  it('마지막 플레이어 제거 시 방을 삭제하고 null을 반환한다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    const result = removePlayer('s1')
    expect(result).toBeNull()
    // 그레이스 피리어드(10분) 동안 방 유지
    expect(getRoom(code)).not.toBeNull()
    // 10분 경과 후 방 삭제
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
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

  it('관리자가 만든 방(title이 null이 아님)은 마지막 플레이어가 나가도 삭제 타이머를 걸지 않는다', () => {
    vi.useFakeTimers()
    const { code } = createRoom({ title: 'TEAM 1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: false })
    removePlayer('s1')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(getRoom(code)).not.toBeNull()
    expect(getRoom(code).players).toHaveLength(0)
    vi.useRealTimers()
  })
})

describe('markDisconnected', () => {
  it('플레이어를 connected: false로 표시하고 방을 유지한다', () => {
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    const room = markDisconnected('s1')
    expect(room.players).toHaveLength(1)
    expect(room.players[0].connected).toBe(false)
  })

  it('유예 시간(10분) 내 재접속하지 않으면 플레이어를 제거한다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(getRoom(code).players).toHaveLength(0)
    vi.useRealTimers()
  })

  it('유예 시간 내 재접속(addPlayer)하면 제거 타이머가 취소된다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    vi.advanceTimersByTime(5 * 60 * 1000)
    addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(getRoom(code).players).toHaveLength(1)
    expect(getRoom(code).players[0].connected).toBe(true)
    vi.useRealTimers()
  })

  it('알 수 없는 socketId는 null을 반환한다', () => {
    expect(markDisconnected('unknown')).toBeNull()
  })

  it('같은 socketId로 두 번 호출해도 이전 타이머를 취소해 고아 타이머를 남기지 않는다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })

    markDisconnected('s1') // 첫 번째 타이머 등록 (t=0, 만료 t=10분)
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(5 * 60 * 1000) // t=5분
    markDisconnected('s1') // 중복 disconnect 이벤트: 새 타이머로 재등록되어야 하며, 개수는 여전히 1개여야 한다
    expect(vi.getTimerCount()).toBe(1)

    // 첫 번째 타이머의 원래 만료 시점(t=10분)을 지나도, 그 타이머는 취소되었으므로 플레이어가 제거되지 않아야 한다
    vi.advanceTimersByTime(5 * 60 * 1000 + 1) // t=10분 1ms
    expect(getRoom(code).players).toHaveLength(1)

    // 재접속 후에도 남아있는 고아 타이머로 인해 잘못 제거되지 않아야 한다
    addPlayer(code, { socketId: 's1-new', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(getRoom(code).players).toHaveLength(1)
    expect(getRoom(code).players[0].connected).toBe(true)

    vi.useRealTimers()
  })

  it('마지막 플레이어가 유예 만료로 제거되면 방도 10분 후 삭제된다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1) // 플레이어 제거, 방은 비지만 아직 삭제 전
    expect(getRoom(code)).not.toBeNull()
    vi.advanceTimersByTime(10 * 60 * 1000 + 1) // 방 삭제
    expect(getRoom(code)).toBeNull()
    vi.useRealTimers()
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

describe('updateRoomPricesByCode', () => {
  it('code로 방을 찾아 가격을 갱신한다', () => {
    const { code } = createRoom()
    const newPrices = {
      stocks: { semiconductor: 5000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
      realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
    }
    const room = updateRoomPricesByCode(code, newPrices)
    expect(room.prices).toEqual(newPrices)
    expect(getRoom(code).prices).toEqual(newPrices)
  })

  it('없는 코드면 null을 반환한다', () => {
    expect(updateRoomPricesByCode('XXXXXX', {})).toBeNull()
  })
})

describe('updateRoomTitle', () => {
  it('방 제목을 변경한다', () => {
    const { code } = createRoom({ title: 'TEAM 1' })
    const room = updateRoomTitle(code, 'TEAM A')
    expect(room.title).toBe('TEAM A')
    expect(getRoom(code).title).toBe('TEAM A')
  })

  it('없는 코드면 null을 반환한다', () => {
    expect(updateRoomTitle('XXXXXX', 'TEAM A')).toBeNull()
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

describe('sortRoomsByCreationOrder', () => {
  it('createdAt 기준 오름차순(생성순)으로 정렬한다', () => {
    const rooms = [
      { code: 'A', createdAt: new Date('2026-01-01T00:00:00Z') },
      { code: 'B', createdAt: new Date('2026-01-03T00:00:00Z') },
      { code: 'C', createdAt: new Date('2026-01-02T00:00:00Z') },
    ]
    expect(sortRoomsByCreationOrder(rooms).map(r => r.code)).toEqual(['A', 'C', 'B'])
  })

  it('방 안에서 플레이어들의 활동으로 updatedAt이 바뀌어도 순서는 그대로 유지된다', () => {
    const rooms = [
      { code: 'A', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') },
      { code: 'B', createdAt: new Date('2026-01-02T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z') },
    ]
    expect(sortRoomsByCreationOrder(rooms).map(r => r.code)).toEqual(['A', 'B'])

    // B의 플레이어가 방금 활동해 updatedAt이 A보다 최신이 되어도, 생성 순서(A가 먼저)는 바뀌지 않는다
    rooms[1].updatedAt = new Date('2026-01-05T00:00:00Z')
    expect(sortRoomsByCreationOrder(rooms).map(r => r.code)).toEqual(['A', 'B'])
  })

  it('진행중인 방과 완료된 팀이 섞여 있어도 createdAt 기준으로 함께 정렬한다', () => {
    const rooms = [
      { code: 'completed-old', createdAt: '2026-01-01T00:00:00Z' },
      { code: 'live-new', createdAt: new Date('2026-01-05T00:00:00Z') },
      { code: 'completed-new', createdAt: '2026-01-04T00:00:00Z' },
    ]
    expect(sortRoomsByCreationOrder(rooms).map(r => r.code)).toEqual(['completed-old', 'completed-new', 'live-new'])
  })

  it('원본 배열을 변형하지 않는다', () => {
    const rooms = [
      { code: 'A', createdAt: new Date('2026-01-01T00:00:00Z') },
      { code: 'B', createdAt: new Date('2026-01-02T00:00:00Z') },
    ]
    sortRoomsByCreationOrder(rooms)
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

  it('연결 해제 유예 타이머가 걸린 플레이어가 있는 방을 삭제하면 해당 타이머도 함께 취소된다', () => {
    vi.useFakeTimers()
    const { code } = createRoom()
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    markDisconnected('s1')
    expect(vi.getTimerCount()).toBe(1)

    expect(deleteRoomByCode(code)).toBe(true)
    expect(getRoom(code)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    // 남은 타이머가 없으므로 시간이 흘러도 에러 없이 동작한다
    expect(() => vi.advanceTimersByTime(10 * 60 * 1000 + 1)).not.toThrow()
    vi.useRealTimers()
  })
})

describe('deleteRoomsByClassId', () => {
  it('해당 classId를 가진 방을 모두 삭제한다', () => {
    const room1 = createRoom({ classId: 'class-1' })
    const room2 = createRoom({ classId: 'class-1' })
    const otherRoom = createRoom({ classId: 'class-2' })

    deleteRoomsByClassId('class-1')

    expect(getRoom(room1.code)).toBeNull()
    expect(getRoom(room2.code)).toBeNull()
    expect(getRoom(otherRoom.code)).not.toBeNull()
  })

  it('일치하는 방이 없어도 에러 없이 동작한다', () => {
    expect(() => deleteRoomsByClassId('no-such-class')).not.toThrow()
  })

  it('연결 해제 유예 타이머가 걸린 플레이어가 있는 방들을 삭제하면 해당 타이머도 모두 취소된다', () => {
    vi.useFakeTimers()
    const room1 = createRoom({ classId: 'class-1' })
    const room2 = createRoom({ classId: 'class-1' })
    addPlayer(room1.code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    addPlayer(room2.code, { socketId: 's2', name: '영희', character: 'ptsh', isHost: true, playerUuid: 'p2' })
    markDisconnected('s1')
    markDisconnected('s2')
    expect(vi.getTimerCount()).toBe(2)

    deleteRoomsByClassId('class-1')
    expect(getRoom(room1.code)).toBeNull()
    expect(getRoom(room2.code)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    expect(() => vi.advanceTimersByTime(10 * 60 * 1000 + 1)).not.toThrow()
    vi.useRealTimers()
  })
})

describe('listPublicRoomsByClassId', () => {
  it('해당 classId의 방만 반환하며 방장 닉네임 외의 민감 정보는 제외한다', () => {
    const room = createRoom({ classId: 'class-1' })
    addPlayer(room.code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, affiliation: '경영학과' })
    createRoom({ classId: 'class-2' })

    const result = listPublicRoomsByClassId('class-1')

    expect(result).toEqual([
      { code: room.code, status: 'live', playerCount: 1, characters: ['ptsc'], hostName: '철수', title: null },
    ])
  })

  it('방장이 아직 없으면(참가자가 없는 방) hostName은 null이다', () => {
    const room = createRoom({ classId: 'class-1' })
    const result = listPublicRoomsByClassId('class-1')
    expect(result).toEqual([
      { code: room.code, status: 'live', playerCount: 0, characters: [], hostName: null, title: null },
    ])
  })

  it('room.title이 있으면 그대로 포함한다', () => {
    const room = createRoom({ classId: 'class-1', title: 'TEAM 1' })
    const result = listPublicRoomsByClassId('class-1')
    expect(result[0].title).toBe('TEAM 1')
  })

  it('방장이 나가고 팀원만 남아있으면 hostName은 null이다', () => {
    const room = createRoom({ classId: 'class-1' })
    addPlayer(room.code, { socketId: 's1', name: '영희', character: 'ptsh', isHost: false })
    const result = listPublicRoomsByClassId('class-1')
    expect(result[0].hostName).toBeNull()
  })

  it("classId가 'unassigned'면 classId가 null인 방을 반환한다", () => {
    const room = createRoom()
    const result = listPublicRoomsByClassId('unassigned')
    expect(result.map(r => r.code)).toEqual([room.code])
  })

  it('일치하는 방이 없으면 빈 배열을 반환한다', () => {
    expect(listPublicRoomsByClassId('no-such-class')).toEqual([])
  })

  it('생성 순서대로 정렬한다', () => {
    const older = createRoom({ classId: 'class-1' })
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)
    const newer = createRoom({ classId: 'class-1' })
    vi.useRealTimers()
    const result = listPublicRoomsByClassId('class-1')
    expect(result.map(r => r.code)).toEqual([older.code, newer.code])
  })

  it('방에 새 플레이어가 들어오거나 활동해도(updatedAt 변경) 방 순서는 바뀌지 않는다', () => {
    const older = createRoom({ classId: 'class-1' })
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)
    const newer = createRoom({ classId: 'class-1' })
    vi.useRealTimers()

    addPlayer(newer.code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    updatePlayerState('s1', { job: 'a' })

    const result = listPublicRoomsByClassId('class-1')
    expect(result.map(r => r.code)).toEqual([older.code, newer.code])
  })
})

describe('getRoomBySocketId', () => {
  it('socketId로 소속된 방을 반환한다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true })
    expect(getRoomBySocketId('s1').code).toBe(code)
  })

  it('알 수 없는 socketId는 null을 반환한다', () => {
    expect(getRoomBySocketId('unknown')).toBeNull()
  })
})

describe('removePlayerByUuid', () => {
  it('playerUuid로 플레이어를 찾아 방에서 제거한다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    addPlayer(code, { socketId: 's2', name: '영희', character: 'ptsh', isHost: false, playerUuid: 'p2' })

    const result = removePlayerByUuid(code, 'p2')

    expect(result.room.players.map(p => p.playerUuid)).toEqual(['p1'])
    expect(result.targetSocketId).toBe('s2')
  })

  it('제거된 플레이어의 socketId는 더 이상 어떤 방에도 매핑되지 않는다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    removePlayerByUuid(code, 'p1')
    expect(getRoomBySocketId('s1')).toBeNull()
  })

  it('존재하지 않는 방 코드는 null을 반환한다', () => {
    expect(removePlayerByUuid('XXXXXX', 'p1')).toBeNull()
  })

  it('존재하지 않는 playerUuid는 null을 반환한다', () => {
    const { code } = createRoom({ classId: 'class-1' })
    addPlayer(code, { socketId: 's1', name: '철수', character: 'ptsc', isHost: true, playerUuid: 'p1' })
    expect(removePlayerByUuid(code, 'unknown')).toBeNull()
  })
})
