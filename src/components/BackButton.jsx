import { useNavigate } from 'react-router-dom'
import styles from './BackButton.module.css'

export default function BackButton({ variant = 'body' }) {
  const navigate = useNavigate()
  return (
    <button
      className={`${styles.btn} ${variant === 'intro' ? styles.intro : styles.body}`}
      onClick={() => navigate(-1)}
      aria-label="뒤로 가기"
    >
      <img src="/icons/뒤로가기.png" alt="" className={styles.icon} />
      <span>뒤로</span>
    </button>
  )
}
