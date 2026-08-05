import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <button
        className={styles.adminBtn}
        onClick={() => navigate('/admin')}
        aria-label="관리자 모드"
        type="button"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm8.94-3.5a7.97 7.97 0 0 0-.15-1.5l2.06-1.6-2-3.46-2.43.98a8.07 8.07 0 0 0-2.6-1.5L15.4 2h-4l-.42 2.42a8.07 8.07 0 0 0-2.6 1.5l-2.43-.98-2 3.46 2.06 1.6c-.1.49-.15.99-.15 1.5s.05 1.01.15 1.5l-2.06 1.6 2 3.46 2.43-.98c.77.63 1.65 1.15 2.6 1.5L11.4 22h4l.42-2.42c.95-.35 1.83-.87 2.6-1.5l2.43.98 2-3.46-2.06-1.6c.1-.49.15-.99.15-1.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
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
        <button className={styles.primaryBtn} onClick={() => navigate('/join-code')}>
          게임 참여
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate('/ranking')}>
          랭킹 보기
        </button>
      </div>
      <footer className={styles.footer}>© 2026 머니빌리지</footer>
    </div>
  )
}
