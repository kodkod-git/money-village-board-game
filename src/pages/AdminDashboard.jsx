import { useState, useEffect } from 'react'
import { getAdminToken, getAdminProfile, setAdminSession, clearAdminSession } from '../utils/adminAuth'
import AdminLogin from './AdminLogin'
import AdminClassList from './AdminClassList'
import AdminClassDashboard from './AdminClassDashboard'
import AdminRankingView from './AdminRankingView'
import AdminSettings from './AdminSettings'
import AdminResponseAnalytics from './AdminResponseAnalytics'
import AdminAllResults from './AdminAllResults'
import EftiRecordPage from '../features/eftiRecord/EftiRecordPage'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import AdminShell from '../components/admin/AdminShell'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
import styles from './AdminDashboard.module.css'

// 모바일에서는 PC에서만 볼 수 있는 분석 화면을 열지 않는다.
const DESKTOP_ONLY_SECTIONS = ['responses', 'all-results', 'efti-record']

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken())
  const [profile, setProfile] = useState(() => getAdminProfile())
  const [selectedClass, setSelectedClass] = useState(null)
  const [section, setSection] = useState('classes')
  // EFTI 성향기록 입력 중 저장하지 않은 내용이 있으면 메뉴를 옮기기 전에 묻는다.
  const [eftiDirty, setEftiDirty] = useState(false)
  const [pendingSection, setPendingSection] = useState(null)
  const isMobile = useIsAdminMobile()
  // section은 그대로 두어, 창을 다시 넓히면 보던 화면으로 돌아온다.
  const desktopOnly = isMobile && DESKTOP_ONLY_SECTIONS.includes(section)

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
    if ((key === 'responses' || key === 'all-results') && !profile?.isSuper) return
    if (section === 'efti-record' && eftiDirty && key !== section) {
      setPendingSection(key)
      return
    }
    setSection(key)
  }

  if (!token || !profile) return <AdminLogin onLogin={handleLogin} />

  return (
    <AdminShell
      activeSection={section}
      onNavigate={handleNavigate}
      teamStatusDisabled={!selectedClass}
      isSuper={Boolean(profile.isSuper)}
    >
      {section === 'classes' && (
        <AdminClassList profile={profile} onSelectClass={handleSelectClass} onLogout={handleLogout} />
      )}
      {section === 'team-status' && selectedClass && (
        <AdminClassDashboard
          classId={selectedClass.id}
          initialName={selectedClass.name}
          kind={selectedClass.kind ?? 'class'}
          boardCount={selectedClass.boardCount ?? 6}
        />
      )}
      {section === 'ranking' && selectedClass && (
        <AdminRankingView
          classId={selectedClass.id}
          classDisplayName={selectedClass.name}
          boardCount={selectedClass.boardCount ?? 6}
          onGoToTeamStatus={() => handleNavigate('team-status')}
        />
      )}
      {desktopOnly && <p className={styles.desktopOnly}>PC에서 이용해 주세요</p>}
      {!desktopOnly && section === 'responses' && profile.isSuper && <AdminResponseAnalytics />}
      {!desktopOnly && section === 'all-results' && profile.isSuper && <AdminAllResults />}
      {!desktopOnly && section === 'efti-record' && (
        <EftiRecordPage profile={profile} onDirtyChange={setEftiDirty} />
      )}
      {pendingSection && (
        <ConfirmDialog
          title="저장하지 않은 내용이 있어요"
          description="다른 메뉴로 가면 입력한 내용이 사라져요."
          cancelLabel="취소"
          confirmLabel="계속"
          onCancel={() => setPendingSection(null)}
          onConfirm={() => {
            setEftiDirty(false)
            setSection(pendingSection)
            setPendingSection(null)
          }}
        />
      )}
      {section === 'settings' && <AdminSettings profile={profile} onLogout={handleLogout} />}
    </AdminShell>
  )
}
