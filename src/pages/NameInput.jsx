import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')

  const code = searchParams.get('code') ?? ''
  const isHost = searchParams.get('host') === 'true'

  function handleNext() {
    if (!name.trim()) return
    const params = new URLSearchParams({ code, name: name.trim() })
    if (isHost) params.set('host', 'true')
    navigate(`/select?${params}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>💰 Money Village</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
        <label className={styles.label}>이름을 입력하세요</label>
        <input
          className={styles.input}
          placeholder="예) 홍길동"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          maxLength={20}
        />
        <button className={styles.btn} onClick={handleNext}>다음 →</button>
      </div>
    </div>
  )
}
