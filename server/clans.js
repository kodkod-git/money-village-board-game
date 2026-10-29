import { randomUUID } from 'crypto'

// 수업별 팀(클랜). 결과 등록을 마친 참여자(game_results.id)를 관리자가 묶는다.
// 서버 메모리에만 있으므로 재시작·재배포하면 사라진다(수업 중에는 배포하지 않는다).
// clansByClass: Map<classId, { counter, clans: Map<clanId, { id, name, memberIds: Set<resultId> }> }>
const clansByClass = new Map()

export const MAX_CLAN_NAME_LENGTH = 20

export function isValidClanName(name) {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= MAX_CLAN_NAME_LENGTH
}

function entryOf(classId) {
  let entry = clansByClass.get(classId)
  if (!entry) {
    entry = { counter: 0, clans: new Map() }
    clansByClass.set(classId, entry)
  }
  return entry
}

function toPublic(clan) {
  return { id: clan.id, name: clan.name, memberIds: [...clan.memberIds] }
}

function findClan(classId, clanId) {
  return clansByClass.get(classId)?.clans.get(clanId) ?? null
}

export function createClan(classId) {
  const entry = entryOf(classId)
  entry.counter += 1
  const clan = { id: randomUUID(), name: `팀 ${entry.counter}`, memberIds: new Set() }
  entry.clans.set(clan.id, clan)
  return toPublic(clan)
}

// 이름 검증은 호출하는 쪽(isValidClanName)에서 먼저 한다.
export function renameClan(classId, clanId, name) {
  const clan = findClan(classId, clanId)
  if (!clan) return null
  clan.name = name.trim()
  return toPublic(clan)
}

export function deleteClan(classId, clanId) {
  return clansByClass.get(classId)?.clans.delete(clanId) ?? false
}

// clanId가 null이면 배정 해제. 다른 클랜에 있던 참여자는 그 클랜에서 빠진다.
export function assignToClan(classId, resultId, clanId) {
  const target = clanId === null ? null : findClan(classId, clanId)
  if (clanId !== null && !target) return false
  for (const clan of entryOf(classId).clans.values()) clan.memberIds.delete(resultId)
  target?.memberIds.add(resultId)
  return true
}

// Map은 넣은 순서를 지키므로 만든 순서대로 나온다.
export function listClans(classId) {
  const entry = clansByClass.get(classId)
  return entry ? [...entry.clans.values()].map(toPublic) : []
}

// 등록된 팀이 지워져 DB에 없는 결과 id를 정리한다.
export function pruneMembers(classId, validResultIds) {
  const entry = clansByClass.get(classId)
  if (!entry) return
  for (const clan of entry.clans.values()) {
    for (const id of clan.memberIds) {
      if (!validResultIds.has(id)) clan.memberIds.delete(id)
    }
  }
}

export function deleteClassClans(classId) {
  clansByClass.delete(classId)
}

export function _resetClans() {
  clansByClass.clear()
}
