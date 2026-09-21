import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import useBodyClass from '../hooks/useBodyClass'
import {
  INTRO_TITLE_LINE1, INTRO_TITLE_LINE2, INTRO_SUBTITLE, INTRO_SUBTITLE_EMPHASIS,
  INTRO_META_TIME, INTRO_META_ANALYSIS, INTRO_FOOTER, QUESTIONS,
} from '../constants/quizData'
import styles from './QuizIntro.module.css'

export default function QuizIntro() {
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.center}>
        <h1 className={styles.title}>
          {INTRO_TITLE_LINE1}
          <span className={styles.titleAccent}>{INTRO_TITLE_LINE2}</span>
        </h1>
        <p className={styles.subtitle}>
          {INTRO_SUBTITLE}
          <br />
          <span className={styles.subtitleEmphasis}>{INTRO_SUBTITLE_EMPHASIS}</span>
        </p>
        <div className={styles.card}>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <img className={styles.metaIcon} src="/icons/assignment.png" alt="" aria-hidden="true" />
              {QUESTIONS.length}가지 질문
            </span>
            <span className={styles.metaItem}>
              <img className={styles.metaIcon} src="/icons/alarm.png" alt="" aria-hidden="true" />
              {INTRO_META_TIME}
            </span>
            <span className={styles.metaItem}>
              <img className={styles.metaIcon} src="/icons/account_tree.png" alt="" aria-hidden="true" />
              {INTRO_META_ANALYSIS}
            </span>
          </div>
          <button className={styles.startBtn} onClick={() => navigate('/quiz/play')}>
            테스트 시작하기
          </button>
        </div>
        <p className={styles.footer}>{INTRO_FOOTER}</p>
      </div>
    </div>
  )
}
