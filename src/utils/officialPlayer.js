const STORAGE_KEY = 'official_player_ids'

// 입장 화면이 대회인지 판별한다. 실패하면 일반 흐름으로 진행한다
// (대회 방이면 서버 join-room이 공식 참가자 없는 입장을 다시 막는다).
export async function fetchEntryKind({ classId, code } = {}) {
  const fallback = { kind: 'class', name: null, classId: classId || null }
  const url = classId
    ? `/api/classes/${encodeURIComponent(classId)}/kind`
    : code ? `/api/rooms/${encodeURIComponent(code.toUpperCase())}/kind` : null
  if (!url) return fallback
  try {
    const res = await fetch(url)
    if (!res.ok) return fallback
    const data = await res.json()
    return { kind: data.kind ?? 'class', name: data.name ?? null, classId: data.classId ?? classId ?? null }
  } catch {
    return fallback
  }
}

export async function resolveOfficialPlayer(classId, realName, confirm = false) {
  const res = await fetch(`/api/contests/${encodeURIComponent(classId)}/players/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ realName, confirm }),
  })
  if (!res.ok) throw new Error('resolve failed')
  return res.json()
}

// 공식 랭킹의 "내 기록"은 기기 단위로 찾는다. 결과 화면에서 내 공식 참가자 id를 대회별로 기억한다.
export function getRememberedOfficialPlayers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function rememberOfficialPlayer(classId, officialPlayerId) {
  if (!classId || !officialPlayerId) return
  try {
    const next = { ...getRememberedOfficialPlayers(), [classId]: officialPlayerId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 "내 기록" 고정만 빠진다.
  }
}
