import { supabase } from './supabase.js'

export const UNASSIGNED_CLASS = '미배정 수업'

export async function createClass(name, adminId) {
  const trimmed = name.trim()
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({ name: trimmed, created_by: adminId })
    .select('id, name')
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
    const { data, error } = await supabase.from('classes').select('id, name').order('name')
    if (error) throw error
    return [...data, { id: 'unassigned', name: UNASSIGNED_CLASS }]
  }

  const { data, error } = await supabase
    .from('admin_class_access')
    .select('classes(id, name)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data.map(row => row.classes)
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
