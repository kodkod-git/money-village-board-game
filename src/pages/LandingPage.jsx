import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.topActions}>
        <button className={styles.ghostBtn} type="button" disabled>
          <img src="/icons/eye-outline.svg" alt="" className={styles.topActionIcon} />
          관전자
        </button>
        <button
          className={styles.adminBtn}
          onClick={() => navigate('/admin')}
          type="button"
        >
          <img src="/icons/settings-outline.svg" alt="" className={styles.topActionIcon} />
          관리자
        </button>
      </div>
      <div className={styles.center}>
        <div className={styles.iconBox}>
          <img src="/icons/logo-dice.svg" alt="" className={styles.logoIcon} />
        </div>
        <h1 className={styles.title}>머니빌리지</h1>
        <p className={styles.subtitle}>게임 결과를 기록해요!</p>
      </div>
      <div className={styles.buttons}>
        <button className={styles.primaryBtn} onClick={() => navigate('/join-code')}>
          시작하기
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/ranking')}>
          랭킹 보기
        </button>
      </div>
      <footer className={styles.footer}>© 2026 머니빌리지</footer>
    </div>
  )
}
