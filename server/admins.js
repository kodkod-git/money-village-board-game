import bcrypt from 'bcryptjs'
import { supabase } from './supabase.js'

const SALT_ROUNDS = 10
const MASTER_USERNAME = 'admin'
const MASTER_PASSWORD = '0000'

export async function createAdmin(username, password) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const { data, error } = await supabase
    .from('admins')
    .insert({ username, password_hash: passwordHash })
    .select('id, username, is_super')
    .single()
  if (error) throw error
  return { id: data.id, username: data.username, isSuper: data.is_super }
}

export async function findAdminByUsername(username) {
  const { data, error } = await supabase
    .from('admins')
    .select('id, username, password_hash, is_super')
    .eq('username', username)
    .single()
  if (error) return null
  return data
}

export async function verifyAdminPassword(username, password) {
  const admin = await findAdminByUsername(username)
  if (!admin) return null
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return null
  return { id: admin.id, username: admin.username, isSuper: admin.is_super }
}

export async function seedMasterAdmin() {
  const existing = await findAdminByUsername(MASTER_USERNAME)
  if (existing) return
  const passwordHash = await bcrypt.hash(MASTER_PASSWORD, SALT_ROUNDS)
  const { error } = await supabase
    .from('admins')
    .insert({ username: MASTER_USERNAME, password_hash: passwordHash, is_super: true })
  if (error) throw error
}
