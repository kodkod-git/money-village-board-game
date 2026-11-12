import { supabase } from './supabase.js'

export const UNASSIGNED_CLASS = '미배정 수업'

// classes.kind: 'class'(일반 수업) | 'official'(공식전 대회).
export const CLASS_KINDS = ['class', 'official']

function toKind(kind) {
  return CLASS_KINDS.includes(kind) ? kind : 'class'
}

export async function createClass(name, adminId, kind = 'class') {
  const trimmed = name.trim()
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({ name: trimmed, created_by: adminId, kind: toKind(kind) })
    .select('id, name, kind')
    .single()
  if (error) throw error

  const { error: accessError } = await supabase
    .from('admin_class_access')
    .insert({ admin_id: adminId, class_id: cls.id })
  if (accessError) throw accessError

  return cls
}

function toClassItem(cls) {
  return { id: cls.id, name: cls.name, kind: toKind(cls.kind), createdAt: cls.created_at }
}

export async function listClassesForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, kind, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return [
      ...data.map(toClassItem),
      { id: 'unassigned', name: UNASSIGNED_CLASS, kind: 'class' },
    ]
  }

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('classes(id, name, kind, created_at)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data
    .map(row => toClassItem(row.classes))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// 입장 화면과 서버 검증이 "이 수업이 대회인지" 확인할 때 쓴다.
// 미배정·없는 수업·잘못된 id는 일반 수업으로 본다.
export async function getClassInfo(classId) {
  const fallback = { kind: 'class', name: null }
  if (!classId || classId === 'unassigned') return fallback

  const { data, error } = await supabase
    .from('classes')
    .select('name, kind')
    .eq('id', classId)
    .maybeSingle()
  if (error) {
    if (error.code === '22P02') return fallback
    throw error
  }
  if (!data) return fallback
  return { kind: toKind(data.kind), name: data.name }
}

// 공식 랭킹 페이지의 대회 드롭다운용.
export async function listOfficialContests() {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, created_at')
    .eq('kind', 'official')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(cls => ({ id: cls.id, name: cls.name, createdAt: cls.created_at }))
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
