import crypto from 'crypto'

const MAX_PLAYERS = 4

const rooms = new Map()
const socketToRoom = new Map()
const roomDeletionTimers = new Map()

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

function defaultGameState() {
  return {
    cash: null,
    job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false,
    realEstateVisited: false,
    isCompleted: false,
  }
}

function defaultPrices() {
  return {
    stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
    realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
  }
}

export function createRoom({ classId = null } = {}) {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const now = new Date()
  const room = { code, createdAt: now, updatedAt: now, players: [], prices: defaultPrices(), classId }
  rooms.set(code, room)
  return room
}

export function getRoom(code) {
  return rooms.get(code) ?? null
}

export function listAllRooms() {
  return Array.from(rooms.values())
}

export function addPlayer(code, { socketId, name, character, isHost, playerUuid, affiliation = '' }) {
  if (!socketId) throw new Error('player.socketId is required')
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')

  // Cancel any pending room deletion (reconnect within grace period)
  if (roomDeletionTimers.has(code)) {
    clearTimeout(roomDeletionTimers.get(code))
    roomDeletionTimers.delete(code)
  }

  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')
  room.players.push({ socketId, name, character, isHost, playerUuid, affiliation, gameState: defaultGameState() })
  socketToRoom.set(socketId, code)
  return room
}

export function removePlayer(socketId) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) {
    socketToRoom.delete(socketId)
    return null
  }
  room.players = room.players.filter(p => p.socketId !== socketId)
  socketToRoom.delete(socketId)
  if (room.players.length === 0) {
    // Keep room alive for 30 s so a refreshing player can reconnect
    const timer = setTimeout(() => {
      if (rooms.get(code)?.players.length === 0) rooms.delete(code)
      roomDeletionTimers.delete(code)
    }, 30000)
    roomDeletionTimers.set(code, timer)
    return null
  }
  return room
}

export function updatePlayerState(socketId, gameState) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  const player = room.players.find(p => p.socketId === socketId)
  if (!player) return null
  player.gameState = gameState
  room.updatedAt = new Date()
  return room
}

export function updatePlayerStateByUuid(code, playerUuid, partialGameState) {
  const room = rooms.get(code)
  if (!room) return null
  const player = room.players.find(p => p.playerUuid === playerUuid)
  if (!player) return null
  // 이 함수는 관리자 수정 라우트에서만 호출된다 — 관리자가 필드를 손대면
  // 그 플레이어는 입력 완료로 간주해, 전원 완료 시 "등록 대기" 상태로
  // 넘어가고 관리자가 결과 등록도 할 수 있게 한다.
  player.gameState = { ...player.gameState, ...partialGameState, isCompleted: true }
  room.updatedAt = new Date()
  return room
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000
const ABANDONED_THRESHOLD_MS = 2 * 60 * 60 * 1000

export function computeLiveRoomStatus(room, now = new Date()) {
  const allCompleted = room.players.length > 0 && room.players.every(p => p.gameState?.isCompleted)
  if (allCompleted) return 'completed-but-unregistered'

  const elapsedMs = now - new Date(room.updatedAt)
  if (elapsedMs < STALE_THRESHOLD_MS) return 'live'
  if (elapsedMs < ABANDONED_THRESHOLD_MS) return 'stale'
  return 'abandoned'
}

export function deleteRoomByCode(code) {
  return rooms.delete(code)
}

export function deleteRoomsByClassId(classId) {
  for (const [code, room] of rooms.entries()) {
    if (room.classId !== classId) continue
    rooms.delete(code)
    if (roomDeletionTimers.has(code)) {
      clearTimeout(roomDeletionTimers.get(code))
      roomDeletionTimers.delete(code)
    }
  }
}

export function sortRoomsByRecency(rooms) {
  return [...rooms].sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt))
}

export function isCharacterTaken(code, character, requestingSocketId) {
  const room = rooms.get(code)
  if (!room) return false
  return room.players.some(p => p.character === character && p.socketId !== requestingSocketId)
}

export function kickPlayer(hostSocketId, targetSocketId) {
  const code = socketToRoom.get(hostSocketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  const host = room.players.find(p => p.socketId === hostSocketId)
  if (!host?.isHost) return null
  const target = room.players.find(p => p.socketId === targetSocketId)
  if (!target) return null
  room.players = room.players.filter(p => p.socketId !== targetSocketId)
  socketToRoom.delete(targetSocketId)
  return { room, targetSocketId }
}

export function updateRoomPrices(socketId, prices) {
  const code = socketToRoom.get(socketId)
  if (!code) return null
  const room = rooms.get(code)
  if (!room) return null
  room.prices = prices
  return room
}

export function clearRooms() {
  for (const timer of roomDeletionTimers.values()) clearTimeout(timer)
  roomDeletionTimers.clear()
  rooms.clear()
  socketToRoom.clear()
}
