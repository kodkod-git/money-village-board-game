import { defaultGameState } from './rooms.js'

// 경쟁 모드 수업에서 아직 팀에 배정되지 않은 플레이어 명단. 방(rooms.js)처럼 메모리에만 둔다.
// pools: Map<classId, Map<playerUuid, PoolPlayer>>
// PoolPlayer = { playerUuid, name, affiliation, character, socketId, connected, joinedAt, gameState }
const pools = new Map()
// 결과 등록 때 남기는 playerUuid → sessionId. 연결이 끊긴 사이 결과가 등록된 플레이어를 결과 화면으로 보낼 때 쓴다.
// submitted: Map<classId, Map<playerUuid, sessionId>>
const submitted = new Map()

function poolOf(classId) {
  let pool = pools.get(classId)
  if (!pool) {
    pool = new Map()
    pools.set(classId, pool)
  }
  return pool
}

export function joinPool(classId, { playerUuid, name, affiliation = '', character, socketId }) {
  const pool = poolOf(classId)
  const existing = pool.get(playerUuid)
  if (existing) {
    // 재접속: 입력하던 gameState는 그대로 두고 소켓만 바꾼다
    existing.socketId = socketId
    existing.connected = true
    return existing
  }
  const player = {
    playerUuid, name, affiliation, character, socketId,
    connected: true, joinedAt: new Date(), gameState: defaultGameState(),
  }
  pool.set(playerUuid, player)
  return player
}

// 팀에서 빠진 플레이어(방의 player 객체)를 입력 상태 그대로 명단에 되돌린다.
export function returnToPool(classId, { playerUuid, name, affiliation = '', character, socketId = null, connected = true, gameState }) {
  const player = {
    playerUuid, name, affiliation, character, socketId,
    connected, joinedAt: new Date(), gameState: gameState ?? defaultGameState(),
  }
  poolOf(classId).set(playerUuid, player)
  return player
}

export function updatePoolPlayerState(classId, playerUuid, gameState) {
  const player = pools.get(classId)?.get(playerUuid)
  if (!player) return null
  player.gameState = gameState
  return player
}

// 연결이 끊겨도 명단에서 지우지 않는다(관리자가 직접 삭제). 끊긴 플레이어가 있던 수업 id를 돌려준다.
export function markPoolDisconnected(socketId) {
  for (const [classId, pool] of pools) {
    for (const player of pool.values()) {
      if (player.socketId === socketId) {
        player.connected = false
        return classId
      }
    }
  }
  return null
}

export function removeFromPool(classId, playerUuid) {
  const pool = pools.get(classId)
  const player = pool?.get(playerUuid)
  if (!player) return null
  pool.delete(playerUuid)
  return player
}

export function listPool(classId) {
  return [...(pools.get(classId)?.values() ?? [])].sort((a, b) => a.joinedAt - b.joinedAt)
}

export function findPoolPlayer(classId, playerUuid) {
  return pools.get(classId)?.get(playerUuid) ?? null
}

export function deletePool(classId) {
  pools.delete(classId)
  submitted.delete(classId)
}

export function rememberSubmitted(classId, playerUuid, sessionId) {
  let records = submitted.get(classId)
  if (!records) {
    records = new Map()
    submitted.set(classId, records)
  }
  records.set(playerUuid, sessionId)
}

export function findSubmitted(classId, playerUuid) {
  return submitted.get(classId)?.get(playerUuid) ?? null
}

export function clearPools() {
  pools.clear()
  submitted.clear()
}
