import { useState } from 'react'
import styles from './CodeModal.module.css'

export default function CodeModal({ initialCode = '', onSubmit, onClose }) {
  const [code, setCode] = useState(initialCode.toUpperCase())
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
        <h2>코드로 팀 참가</h2>
        <div className={styles.divider} />
        <input
          className={styles.input}
          placeholder="팀 코드를 입력하세요"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button className={styles.btn} onClick={() => onSubmit(code)}>참가</button>
      </div>
    </div>
  )
}
