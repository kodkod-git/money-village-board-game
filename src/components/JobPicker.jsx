import { JOB_LABELS, JOB_ICONS } from '../constants/gameData'
import styles from './JobPicker.module.css'

export default function JobPicker({ value, onChange, fill = false }) {
  return (
    <div className={`${styles.grid} ${fill ? styles.gridFill : ''}`}>
      {Object.entries(JOB_LABELS).map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`${styles.tile} ${value === key ? styles.tileSelected : ''}`}
          onClick={() => onChange(key)}
        >
          {value === key && <span className={styles.tileBadge}>✓</span>}
          <span className={styles.icon}>{JOB_ICONS[key]}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  )
}
