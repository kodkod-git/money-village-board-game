import { BADGE_NAMES, BADGE_LABELS, BADGE_DISPLAY_ORDER } from '../constants/gameData'
import styles from './BadgePicker.module.css'

export default function BadgePicker({ badges, onToggle, fill = false }) {
  return (
    <div className={`${styles.grid} ${fill ? styles.gridFill : ''}`}>
      {BADGE_DISPLAY_ORDER.map(name => {
        const i = BADGE_NAMES.indexOf(name)
        return (
          <button
            key={name}
            type="button"
            className={`${styles.tile} ${badges[i] ? styles.tileSelected : ''}`}
            onClick={() => onToggle(i)}
          >
            <img src={`/badges/${name}.png`} alt="" className={styles.img} />
            <span className={styles.label}>{BADGE_LABELS[name]}</span>
          </button>
        )
      })}
    </div>
  )
}
