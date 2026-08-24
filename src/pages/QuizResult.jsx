import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RESULT_GROUPS, AXIS_LABELS } from '../constants/quizData'
import styles from './QuizResult.module.css'

export default function QuizResult() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/quiz/results/${resultId}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then(setResult)
      .catch(() => setError(true))
  }, [resultId])

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.eyebrow}>결과를 불러오지 못했어요.</p>
        <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>다시 하기</button>
      </div>
    )
  }

  if (!result) return null

  const group = RESULT_GROUPS[result.result_group]

  return (
    <div className={styles.page} style={{ background: group.color }}>
      <p className={styles.eyebrow}>우리 아이의 경제적 잠재력은</p>
      <h1 className={styles.groupName}>{result.result_group}</h1>
      <p className={styles.tagline}>[{group.tagline}]</p>
      <p className={styles.description}>✅ {group.description}</p>

      {group.animals.length > 0 && (
        <p className={styles.animals}>{group.animals.join(' · ')}</p>
      )}

      <div className={styles.axisRow}>
        <span className={result.axis_today_tomorrow === AXIS_LABELS.axisTodayTomorrow.leftValue ? styles.axisActive : ''}>
          {AXIS_LABELS.axisTodayTomorrow.left}
        </span>
        <span className={result.axis_today_tomorrow === AXIS_LABELS.axisTodayTomorrow.rightValue ? styles.axisActive : ''}>
          {AXIS_LABELS.axisTodayTomorrow.right}
        </span>
      </div>
      <div className={styles.axisRow}>
        <span className={result.axis_safety_adventure === AXIS_LABELS.axisSafetyAdventure.leftValue ? styles.axisActive : ''}>
          {AXIS_LABELS.axisSafetyAdventure.left}
        </span>
        <span className={result.axis_safety_adventure === AXIS_LABELS.axisSafetyAdventure.rightValue ? styles.axisActive : ''}>
          {AXIS_LABELS.axisSafetyAdventure.right}
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.shareBtn} onClick={() => navigator.clipboard.writeText(window.location.href)}>
          결과 공유하기
        </button>
        <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
