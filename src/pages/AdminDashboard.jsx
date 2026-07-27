import { useState } from 'react'
import { getAdminToken, getAdminProfile, setAdminSession, clearAdminSession } from '../utils/adminAuth'
import AdminLogin from './AdminLogin'
import AdminOrgList from './AdminOrgList'
import AdminOrgDashboard from './AdminOrgDashboard'

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken())
  const [profile, setProfile] = useState(() => getAdminProfile())
  const [selectedOrg, setSelectedOrg] = useState(null)

  function handleLogin(newToken, newProfile) {
    setAdminSession(newToken, newProfile)
    setToken(newToken)
    setProfile(newProfile)
  }

  function handleLogout() {
    clearAdminSession()
    setToken(null)
    setProfile(null)
    setSelectedOrg(null)
  }

  if (!token || !profile) return <AdminLogin onLogin={handleLogin} />
  if (!selectedOrg) {
    return <AdminOrgList profile={profile} onSelectOrg={setSelectedOrg} onLogout={handleLogout} />
  }
  return <AdminOrgDashboard org={selectedOrg} onBack={() => setSelectedOrg(null)} />
}
