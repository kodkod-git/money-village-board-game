import { BADGE_NAMES, BADGE_LABELS } from '../constants/gameData'
import styles from './BadgePicker.module.css'

export default function BadgePicker({ badges, onToggle, fill = false }) {
  return (
    <div className={`${styles.grid} ${fill ? styles.gridFill : ''}`}>
      {BADGE_NAMES.map((name, i) => (
        <button
          key={name}
          type="button"
          className={`${styles.tile} ${badges[i] ? styles.tileSelected : ''}`}
          onClick={() => onToggle(i)}
        >
          {badges[i] && <span className={styles.tileBadge}>✓</span>}
          <img src={`/badges/${name}.png`} alt={name} className={styles.img} />
          <span className={styles.label}>{BADGE_LABELS[name]}</span>
        </button>
      ))}
    </div>
  )
}
