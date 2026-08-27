import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizIntro.module.css'

export default function QuizIntro() {
  const navigate = useNavigate()
  useBodyClass('quiz-mode')

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.center}>
        <h1 className={styles.title}>우리 아이 경제 잠재력(색깔편)</h1>
        <p className={styles.subtitle}>재미로보는 우리 아이의 경제 컬러는?</p>
      </div>
      <div className={styles.buttons}>
        <button className={styles.startBtn} onClick={() => navigate('/quiz/play')}>
          테스트 시작하기
        </button>
      </div>
    </div>
  )
}
