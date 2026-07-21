import JobPicker from '../JobPicker'
import styles from './FieldEditModal.module.css'

export default function JobEditModal({ value, onChange, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>직업 수정</span>
        </div>
        <JobPicker value={value} onChange={onChange} />
      </div>
    </div>
  )
}
