import { useState } from 'react'
import { JOB_LABELS, JOB_IMAGES } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

export default function JobEditModal({ value, onChange, onClose }) {
  const [selected, setSelected] = useState(value)

  function handleConfirm() {
    onChange(selected)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.title}>직업 수정</span>
            <span className={styles.subtitle}>직업을 수정해 주세요</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.pickerGrid}>
            {Object.entries(JOB_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.pickerTile} ${selected === key ? styles.pickerTileSelected : ''}`}
                onClick={() => setSelected(key)}
              >
                <img src={`/badges/job/${JOB_IMAGES[key]}.png`} alt={label} className={styles.pickerIcon} />
                <span className={styles.pickerLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>확인</button>
        </div>
      </div>
    </div>
  )
}
