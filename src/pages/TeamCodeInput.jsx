import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import styles from './NameInput.module.css'

export default function TeamCodeInput() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  function handleNext() {
    if (!code.trim()) return
    navigate(`/join?code=${code.trim().toUpperCase()}`)
  }

  return (
    <div className={styles.page}>
      <BackButton variant="intro" />
      <div className={styles.header}>
        <h1 className={styles.title}>팀 참여</h1>
        <p className={styles.subtitle}>팀원에게 전달받은 코드를 입력하세요</p>
      </div>
      <div className={styles.card}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>팀 코드를 입력하세요</label>
          <input
            className={styles.input}
            placeholder="예) A3F9C1"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={6}
          />
        </div>
        <button className={styles.gradBtn} onClick={handleNext} disabled={!code.trim()}>
          다음 →
        </button>
      </div>
    </div>
  )
}
