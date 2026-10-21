import {
  getRoom, listAllRooms, addPlayer, addAssignedPlayer, findRoomByPlayerUuid,
  removePlayerByUuid, updatePlayerState, MAX_PLAYERS,
} from './rooms.js'
import {
  joinPool, returnToPool, removeFromPool, updatePoolPlayerState, listPool, findPoolPlayer, findSubmitted,
} from './classPool.js'

const TEAM_NOT_FOUND = '팀을 찾을 수 없어요 (이미 결과가 등록된 팀일 수 있어요)'
const PLAYER_MOVED = '이미 다른 곳으로 옮겨진 참여자예요'
const TEAM_FULL = '팀 인원이 가득 찼어요 (최대 4명)'

// 플레이어가 직접(방 코드·로비로) 들어갈 수 있는 방인가. 경쟁 모드 팀은 관리자 배정으로만 채운다.
export function isPlayerJoinableRoom(room) {
  return room.mode !== 'competition'
}

// QR로 들어온(또는 다시 들어온) 플레이어를 지금 있어야 할 곳으로 보낸다.
// 결과 등록됨 → 결과 화면, 팀에 배정됨 → 그 방에 재접속, 그 밖에는 대기 명단.
export function joinCompetition(classId, { playerUuid, name, affiliation = '', character, socketId }) {
  const sessionId = findSubmitted(classId, playerUuid)
  if (sessionId) return { state: 'submitted', sessionId }

  const room = findRoomByPlayerUuid(classId, playerUuid)
  if (room) {
    addPlayer(room.code, { socketId, name, character, isHost: false, playerUuid, affiliation })
    const player = room.players.find(p => p.playerUuid === playerUuid)
    return { state: 'assigned', roomCode: room.code, gameState: player.gameState }
  }

  const player = joinPool(classId, { playerUuid, name, affiliation, character, socketId })
  return { state: 'pool', gameState: player.gameState }
}

// 배정 여부와 관계없이 같은 이벤트로 저장한다. 방에 있으면 { room }, 대기 명단이면 { room: null }.
export function updateCompetitionPlayerState(classId, playerUuid, socketId, gameState) {
  const room = updatePlayerState(socketId, gameState)
  if (room) return { room }
  return updatePoolPlayerState(classId, playerUuid, gameState) ? { room: null } : null
}

// toRoomCode가 null이면 대기 명단으로 되돌린다.
export function assignPlayer(classId, playerUuid, toRoomCode) {
  const target = toRoomCode ? getRoom(toRoomCode) : null
  if (toRoomCode && (!target || target.classId !== classId)) {
    return { ok: false, status: 404, error: TEAM_NOT_FOUND }
  }

  const fromRoom = findRoomByPlayerUuid(classId, playerUuid)
  const pooled = fromRoom ? null : findPoolPlayer(classId, playerUuid)
  if (!fromRoom && !pooled) return { ok: false, status: 409, error: PLAYER_MOVED }

  const current = fromRoom ? fromRoom.players.find(p => p.playerUuid === playerUuid) : pooled
  const fromRoomCode = fromRoom?.code ?? null
  // 제자리에 놓은 경우(같은 팀, 또는 대기 명단 → 대기 명단)
  if ((fromRoom && fromRoom === target) || (!fromRoom && !target)) {
    return { ok: true, player: current, fromRoomCode, toRoomCode: target?.code ?? null }
  }
  if (target && target.players.length >= MAX_PLAYERS) return { ok: false, status: 409, error: TEAM_FULL }

  if (fromRoom) removePlayerByUuid(fromRoom.code, playerUuid)
  else removeFromPool(classId, playerUuid)

  if (target) addAssignedPlayer(target.code, current)
  else returnToPool(classId, current)

  return { ok: true, player: current, fromRoomCode, toRoomCode: target?.code ?? null }
}

// 경쟁 모드 방을 지우기 전에 부른다. 플레이어는 지우지 않고 입력 상태 그대로 대기 명단에 돌려놓는다.
export function returnRoomPlayersToPool(code) {
  const room = getRoom(code)
  if (!room || room.mode !== 'competition') return []
  const players = [...room.players]
  for (const player of players) {
    removePlayerByUuid(code, player.playerUuid)
    returnToPool(room.classId, player)
  }
  return players
}

// 결과 등록 조건: 대기 명단이 비었고, 플레이어가 있는 팀의 모든 플레이어가 입력을 마쳤고, 그런 팀이 1개 이상.
export function competitionStatus(classId) {
  const teams = listAllRooms().filter(room => room.classId === classId && room.players.length > 0)
  const unassigned = listPool(classId).length
  const inputting = teams.reduce((count, room) => count + room.players.filter(p => !p.gameState?.isCompleted).length, 0)
  return { unassigned, inputting, teams: teams.length, ready: unassigned === 0 && inputting === 0 && teams.length > 0 }
}
