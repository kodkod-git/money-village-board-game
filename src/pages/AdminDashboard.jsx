import { useState, useEffect } from 'react'
import { getAdminToken, getAdminProfile, setAdminSession, clearAdminSession } from '../utils/adminAuth'
import AdminLogin from './AdminLogin'
import AdminClassList from './AdminClassList'
import AdminClassDashboard from './AdminClassDashboard'

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken())
  const [profile, setProfile] = useState(() => getAdminProfile())
  const [selectedClass, setSelectedClass] = useState(null)

  // 로그인/수업 목록/수업 대시보드 전체가 관리자 화면이므로,
  // 폰 프레임을 벗어나 화면 전체를 쓰도록 /admin 진입 내내 유지한다.
  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

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
