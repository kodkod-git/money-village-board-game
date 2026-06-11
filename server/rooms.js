import crypto from 'crypto'

const MAX_PLAYERS = 4

const rooms = new Map()
const socketToRoom = new Map()

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
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
  room.players.push(player)
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

export function isCharacterTaken(code, character, requestingSocketId) {
  const room = rooms.get(code)
  if (!room) return false
  return room.players.some(p => p.character === character && p.socketId !== requestingSocketId)
}

export function clearRooms() {
  rooms.clear()
  socketToRoom.clear()
}
