import { useState } from 'react'
import { getAdminToken, getAdminProfile, setAdminSession, clearAdminSession } from '../utils/adminAuth'
import AdminLogin from './AdminLogin'
import AdminClassList from './AdminClassList'
import AdminClassDashboard from './AdminClassDashboard'

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken())
  const [profile, setProfile] = useState(() => getAdminProfile())
  const [selectedClass, setSelectedClass] = useState(null)

  function handleLogin(newToken, newProfile) {
    setAdminSession(newToken, newProfile)
    setToken(newToken)
    setProfile(newProfile)
  }

  function handleLogout() {
    clearAdminSession()
    setToken(null)
    setProfile(null)
    setSelectedClass(null)
  }

  if (!token || !profile) return <AdminLogin onLogin={handleLogin} />
  if (!selectedClass) {
    return <AdminClassList profile={profile} onSelectClass={setSelectedClass} onLogout={handleLogout} />
  }
  return (
    <AdminClassDashboard
      classId={selectedClass.id}
      initialName={selectedClass.name}
      onBack={() => setSelectedClass(null)}
    />
  )
}
