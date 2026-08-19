import { useState } from 'react'
import { MAX_CASH } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

function formatKoreanWon(value) {
  let n = Math.floor(value)
  if (n <= 0) return '0원'
  const eok = Math.floor(n / 100000000)
  n %= 100000000
  const man = Math.floor(n / 10000)
  n %= 10000
  const cheon = Math.floor(n / 1000)
  n %= 1000
  const parts = []
  if (eok) parts.push(`${eok}억`)
  if (man) parts.push(`${man}만`)
  if (cheon) parts.push(`${cheon}천`)
  if (n) parts.push(`${n}`)
  return `${parts.join(' ')} 원`
}

export default function CashEditModal({ initialValue, onConfirm, onClose }) {
  const [display, setDisplay] = useState(String(initialValue ?? 0))

  function handleChange(raw) {
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    setDisplay(digitsOnly === '' ? '0' : digitsOnly)
  }

  function handleConfirm() {
    const parsed = parseInt(display, 10) || 0
    onConfirm(Math.min(parsed, MAX_CASH))
    onClose()
  }

  const parsedValue = Math.min(parseInt(display, 10) || 0, MAX_CASH)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.title}>현금 수정</span>
            <span className={styles.subtitle}>보유 현금을 수정해 주세요</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className={styles.cashBody}>
          <div className={styles.cashCard}>
            <span className={styles.cashLabel}>현금 (원)</span>
            <div className={styles.cashInputBox}>
              <input
                type="text"
                inputMode="numeric"
                className={styles.cashInput}
                value={display}
                aria-label="현금"
                onChange={e => handleChange(e.target.value)}
              />
            </div>
            <span className={styles.cashWords}>{`= ${formatKoreanWon(parsedValue)}`}</span>
          </div>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>확인</button>
        </div>
      </div>
    </div>
  )
}
