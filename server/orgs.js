import { supabase } from './supabase.js'

export const UNASSIGNED_ORG = '미소속/기타'

export async function createOrg(name, adminId) {
  const trimmed = name.trim()
  const { data: org, error } = await supabase
    .from('orgs')
    .insert({ name: trimmed, created_by: adminId })
    .select('id, name')
    .single()
  if (error) throw error

  const { error: accessError } = await supabase
    .from('admin_org_access')
    .insert({ admin_id: adminId, org_id: org.id })
  if (accessError) throw accessError

  return org
}

export async function listOrgsForAdmin(admin) {
  if (admin.isSuper) {
    const { data, error } = await supabase.from('orgs').select('id, name').order('name')
    if (error) throw error
    return [...data, { id: 'unassigned', name: UNASSIGNED_ORG }]
  }

  const { data, error } = await supabase
    .from('admin_org_access')
    .select('orgs(id, name)')
    .eq('admin_id', admin.adminId)
  if (error) throw error
  return data.map(row => row.orgs)
}

export async function hasOrgAccess(admin, orgName) {
  if (admin.isSuper) return true
  if (orgName === UNASSIGNED_ORG) return false

  const { data, error } = await supabase
    .from('admin_org_access')
    .select('orgs!inner(name)')
    .eq('admin_id', admin.adminId)
    .eq('orgs.name', orgName)
  if (error) throw error
  return data.length > 0
}
