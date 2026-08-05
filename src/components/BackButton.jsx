import { useNavigate } from 'react-router-dom'
import styles from './BackButton.module.css'

export default function BackButton({ variant = 'body', to, label = '뒤로', onClick }) {
  const navigate = useNavigate()
  function handleClick() {
    if (onClick) return onClick()
    if (to) return navigate(to)
    navigate(-1)
  }
  return (
    <button
      className={`${styles.btn} ${variant === 'intro' ? styles.intro : styles.body}`}
      onClick={handleClick}
      aria-label={to ? label : '뒤로 가기'}
    >
      <img src="/icons/뒤로가기.png" alt="" className={styles.icon} />
      <span>{label}</span>
    </button>
  )
}
