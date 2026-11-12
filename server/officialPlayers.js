import { supabase } from './supabase.js'

const COLUMNS = 'id, class_id, real_name'

export function normalizeRealName(name) {
  return String(name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
}

export async function findOfficialPlayer(classId, realName) {
  const { data, error } = await supabase
    .from('official_players')
    .select(COLUMNS)
    .eq('class_id', classId)
    .eq('real_name', realName)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createOfficialPlayer(classId, realName) {
  const { data, error } = await supabase
    .from('official_players')
    .insert({ class_id: classId, real_name: realName })
    .select(COLUMNS)
    .single()
  if (error) {
    // 같은 이름으로 거의 동시에 두 번 만들면 (class_id, real_name) unique에 걸린다.
    // 그때는 먼저 만들어진 행을 그대로 쓴다.
    if (error.code === '23505') {
      const existing = await findOfficialPlayer(classId, realName)
      if (existing) return existing
    }
    throw error
  }
  return data
}

// join-room과 관리자 수동 추가가 "이 id가 이 대회 소속인지" 확인할 때 쓴다.
// uuid 형식이 아닌 id(22P02)는 없는 것으로 본다.
export async function getOfficialPlayer(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('official_players')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === '22P02') return null
    throw error
  }
  return data
}

// 실명 입력 단계의 처리:
// - 같은 이름 없음 → 새로 만들고 { officialPlayerId }
// - 같은 이름 있음 + confirm 없음 → { exists, label } (만들지 않음, 화면이 "님이 맞나요?"를 묻는다)
// - 같은 이름 있음 + confirm → 기존 { officialPlayerId }
export async function resolveOfficialPlayer({ classId, contestName, realName, confirm = false }) {
  const name = normalizeRealName(realName)
  if (!name) throw new Error('realName is required')

  const existing = await findOfficialPlayer(classId, name)
  if (existing) {
    if (!confirm) return { exists: true, label: `${name} (${contestName})` }
    return { officialPlayerId: existing.id }
  }
  const created = await createOfficialPlayer(classId, name)
  return { officialPlayerId: created.id }
}
