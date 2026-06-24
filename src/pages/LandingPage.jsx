import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>💰 Money Village</h1>
      <p className={styles.subtitle}>보드게임 팀 구성 시스템</p>
      <div className={styles.buttons}>
        <button className={styles.rankingBtn} onClick={() => navigate('/ranking')}>
          🏆 랭킹
        </button>
        <button className={styles.joinBtn} onClick={() => navigate('/join')}>
          📋 참여
        </button>
      </div>
    </div>
  )
}
