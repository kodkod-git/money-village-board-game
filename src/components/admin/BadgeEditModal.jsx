import { useState } from 'react'
import { BADGE_NAMES, BADGE_LABELS } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

export default function BadgeEditModal({ badges, onChange, onClose }) {
  const [selected, setSelected] = useState(badges)

  function toggle(i) {
    setSelected(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  function handleConfirm() {
    onChange(selected)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.title}>성공카드 수정</span>
            <span className={styles.subtitle}>획득한 성공카드를 수정해 주세요</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.pickerGrid}>
            {BADGE_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`${styles.pickerTile} ${selected[i] ? styles.pickerTileSelected : ''}`}
                onClick={() => toggle(i)}
              >
                <img src={`/badges/${name}.png`} alt={BADGE_LABELS[name]} className={styles.pickerIcon} />
                <span className={styles.pickerLabel}>{BADGE_LABELS[name]}</span>
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
