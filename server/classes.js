import { supabase } from './supabase.js'

export const UNASSIGNED_CLASS = '미배정 수업'

export const CLASS_MODES = ['normal', 'competition']

function normalizeClassMode(mode) {
  return CLASS_MODES.includes(mode) ? mode : 'normal'
}

export async function createClass(name, adminId, mode = 'normal') {
  const trimmed = name.trim()
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({ name: trimmed, created_by: adminId, mode: normalizeClassMode(mode) })
    .select('id, name, mode')
    .single()
  if (error) throw error

  const { error: accessError } = await supabase
    .from('admin_class_access')
    .insert({ admin_id: adminId, class_id: cls.id })
  if (accessError) throw accessError

  return cls
}

export async function listClassesForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, mode, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return [
      ...data.map(cls => ({ id: cls.id, name: cls.name, mode: normalizeClassMode(cls.mode), createdAt: cls.created_at })),
      { id: 'unassigned', name: UNASSIGNED_CLASS, mode: 'normal' },
    ]
  }

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('classes(id, name, mode, created_at)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data
    .map(row => ({
      id: row.classes.id, name: row.classes.name, mode: normalizeClassMode(row.classes.mode), createdAt: row.classes.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function hasClassAccess(admin, classId) {
  if (admin.isSuper) return true
  if (classId === 'unassigned') return false

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('class_id')
    .eq('admin_id', admin.adminId)
    .eq('class_id', classId)
  if (error) throw error
  return data.length > 0
}

export async function updateClassName(classId, name) {
  const { data, error } = await supabase
    .from('classes')
    .update({ name: name.trim() })
    .eq('id', classId)
    .select('id, name')
    .single()
  if (error) throw error
  return data
}

export async function deleteClass(classId) {
  const { error } = await supabase.from('classes').delete().eq('id', classId)
  if (error) throw error
}

// 플레이어 화면 분기와 서버의 경쟁 모드 규칙에 쓴다. 미배정 수업은 일반 모드다.
export async function getClassMode(classId) {
  if (!classId || classId === 'unassigned') return 'normal'
  const { data, error } = await supabase.from('classes').select('mode').eq('id', classId).maybeSingle()
  if (error) throw error
  return normalizeClassMode(data?.mode)
}
