import { useState, useEffect } from 'react'
import { getAdminToken, getAdminProfile, setAdminSession, clearAdminSession } from '../utils/adminAuth'
import AdminLogin from './AdminLogin'
import AdminClassList from './AdminClassList'
import AdminClassDashboard from './AdminClassDashboard'
import AdminRankingView from './AdminRankingView'
import AdminSettings from './AdminSettings'
import AdminShell from '../components/admin/AdminShell'

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken())
  const [profile, setProfile] = useState(() => getAdminProfile())
  const [selectedClass, setSelectedClass] = useState(null)
  const [section, setSection] = useState('classes')

  // 로그인 화면은 다른 페이지들과 동일하게 폰 프레임 카드 안에 보여주고,
  // 로그인 이후(수업 목록/수업 대시보드)에만 화면 전체를 쓰는 관리자 모드로 전환한다.
  useEffect(() => {
    document.body.classList.toggle('admin-mode', Boolean(token && profile))
    return () => document.body.classList.remove('admin-mode')
  }, [token, profile])

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
    setSection('classes')
  }

  function handleSelectClass(cls) {
    setSelectedClass(cls)
    setSection('team-status')
  }

  function handleNavigate(key) {
    if ((key === 'team-status' || key === 'ranking') && !selectedClass) return
    setSection(key)
  }

  if (!token || !profile) return <AdminLogin onLogin={handleLogin} />

  return (
    <AdminShell activeSection={section} onNavigate={handleNavigate} teamStatusDisabled={!selectedClass}>
      {section === 'classes' && (
        <AdminClassList profile={profile} onSelectClass={handleSelectClass} onLogout={handleLogout} />
      )}
      {section === 'team-status' && selectedClass && (
        <AdminClassDashboard
          classId={selectedClass.id}
          initialName={selectedClass.name}
        />
      )}
      {section === 'ranking' && selectedClass && (
        <AdminRankingView
          classId={selectedClass.id}
          classDisplayName={selectedClass.name}
          onGoToTeamStatus={() => handleNavigate('team-status')}
        />
      )}
      {section === 'settings' && <AdminSettings profile={profile} onLogout={handleLogout} />}
    </AdminShell>
  )
}
