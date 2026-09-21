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
              <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
                <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
              </svg>
              {QUESTIONS.length}가지 질문
            </span>
            <span className={styles.metaItem}>
              <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l3 2" />
                <path d="M9 2h6" />
              </svg>
              {INTRO_META_TIME}
            </span>
            <span className={styles.metaItem}>
              <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="5" r="2" />
                <circle cx="18" cy="10" r="2" />
                <circle cx="18" cy="19" r="2" />
                <path d="M6 7v6a2 2 0 0 0 2 2h1M9 15h7M18 12v5" />
              </svg>
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
