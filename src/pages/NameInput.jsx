import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [affiliation, setAffiliation] = useState('')
  const [name, setName] = useState('')

  const code = searchParams.get('code') ?? ''

  function handleNext() {
    if (!affiliation.trim() || !name.trim()) return
    const params = new URLSearchParams({ affiliation: affiliation.trim(), name: name.trim() })
    if (code) params.set('code', code)
    navigate(`/select?${params}`)
  }

  return (
    <div className={styles.page}>
      <BackButton variant="intro" />
      <div className={styles.header}>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
      </div>
      <div className={styles.card}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>소속을 입력하세요</label>
          <input
            className={styles.input}
            placeholder="예) 경영학과"
            value={affiliation}
            onChange={e => setAffiliation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={30}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>이름을 입력하세요</label>
          <input
            className={styles.input}
            placeholder="예) 홍길동"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={20}
          />
        </div>
        <button
          className={styles.gradBtn}
          onClick={handleNext}
          disabled={!affiliation.trim() || !name.trim()}
        >
          다음 →
        </button>
      </div>
    </div>
  )
}
