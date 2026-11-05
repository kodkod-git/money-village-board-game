import AdminSidebar from './AdminSidebar'
import AdminBottomNav from './AdminBottomNav'
import useIsAdminMobile from '../../hooks/useIsAdminMobile'
import styles from './AdminShell.module.css'

export default function AdminShell({ activeSection, onNavigate, teamStatusDisabled, isSuper, children }) {
  const isMobile = useIsAdminMobile()

  return (
    <div className={`${styles.shell} ${isMobile ? styles.shellMobile : ''}`}>
      {!isMobile && (
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={onNavigate}
          teamStatusDisabled={teamStatusDisabled}
          isSuper={isSuper}
        />
      )}
      <div className={styles.main}>{children}</div>
      {isMobile && (
        <AdminBottomNav
          activeSection={activeSection}
          onNavigate={onNavigate}
          teamStatusDisabled={teamStatusDisabled}
        />
      )}
    </div>
  )
}
