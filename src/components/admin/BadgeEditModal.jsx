import BadgePicker from '../BadgePicker'
import styles from './FieldEditModal.module.css'

export default function BadgeEditModal({ badges, onToggle, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>성공카드 수정</span>
        </div>
        <BadgePicker badges={badges} onToggle={onToggle} />
      </div>
    </div>
  )
}
