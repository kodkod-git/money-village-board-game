import AdminSidebar from './AdminSidebar'
import styles from './AdminShell.module.css'

export default function AdminShell({ activeSection, onNavigate, teamStatusDisabled, children }) {
  return (
    <div className={styles.shell}>
      <AdminSidebar
        activeSection={activeSection}
        onNavigate={onNavigate}
        teamStatusDisabled={teamStatusDisabled}
      />
      <div className={styles.main}>{children}</div>
    </div>
  )
}
