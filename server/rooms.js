import crypto from 'crypto'

const MAX_PLAYERS = 4

const rooms = new Map()
const socketToRoom = new Map()

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

export function createRoom() {
  let code
  do { code = generateCode() } while (rooms.has(code))
  const room = { code, createdAt: new Date(), players: [] }
  rooms.set(code, room)
  return room
}

export function getRoom(code) {
  return rooms.get(code) ?? null
}

export function addPlayer(code, player) {
  if (!player?.socketId) throw new Error('player.socketId is required')
  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')
  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full')
  room.players.push({ ...player, gameState: defaultGameState() })
  socketToRoom.set(player.socketId, code)
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
    rooms.delete(code)
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
  return room
}

export function isCharacterTaken(code, character, requestingSocketId) {
  const room = rooms.get(code)
  if (!room) return false
  return room.players.some(p => p.character === character && p.socketId !== requestingSocketId)
}

export function clearRooms() {
  rooms.clear()
  socketToRoom.clear()
}
