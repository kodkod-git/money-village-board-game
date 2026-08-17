import styles from './AdminSettings.module.css'

export default function AdminSettings({ profile, onLogout }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>설정</h1>
        <p className={styles.subtitle}>계정 정보를 확인하고 로그아웃할 수 있습니다</p>
      </div>
      <div className={styles.content}>
        <div className={styles.card}>
          <div>
            <p className={styles.label}>로그인 계정</p>
            <p className={styles.username}>{profile.username}</p>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  )
}
