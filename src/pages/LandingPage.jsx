import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.blob} />
      <div className={styles.center}>
        <div className={styles.iconBox}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path d="M8 28L32 8L56 28V56H40V40H24V56H8V28Z" fill="white" />
          </svg>
        </div>
        <h1 className={styles.title}>머니빌리지</h1>
        <p className={styles.subtitle}>게임 결과를 기록해요!</p>
      </div>
      <div className={styles.buttons}>
        <button className={styles.primaryBtn} onClick={() => navigate('/join')}>
          참여하기
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/ranking')}>
          랭킹 보기
        </button>
      </div>
      <footer className={styles.footer}>© 2026 머니빌리지</footer>
    </div>
  )
}
