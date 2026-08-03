import { useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './NumberInputModal.module.css'

const MAX_LENGTH = 10
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '←']

export default function NumberInputModal({ title, initialValue, unit, maxValue, onConfirm, onClose }) {
  const [display, setDisplay] = useState(String(initialValue ?? 0))
  const portalRoot = document.getElementById('root') ?? document.body

  function handleKey(key) {
    if (key === '←') {
      setDisplay(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)))
      return
    }
    setDisplay(prev => {
      const next = prev === '0' ? key : prev + key
      return next.length > MAX_LENGTH ? prev : next
    })
  }

  function handleConfirm() {
    const parsed = parseInt(display, 10) || 0
    const clamped = maxValue != null ? Math.min(parsed, maxValue) : parsed
    onConfirm(clamped)
  }

  return createPortal(
    <div className={styles.overlay} data-testid="number-input-overlay" onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.display}>
          <span className={styles.value} data-testid="display-value">
            {Number(display).toLocaleString()}
          </span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        <div className={styles.keypad}>
          {KEYS.map(key => (
            <button key={key} type="button" className={styles.key} onClick={() => handleKey(key)}>
              {key}
            </button>
          ))}
        </div>
        <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>
          확인
        </button>
      </div>
    </div>,
    portalRoot,
  )
}
