import styles from './QuantitySelector.module.css'

export default function QuantitySelector({ value, onChange }) {
  return (
    <div className={styles.container}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1
        const selected = n <= value
        return (
          <button
            key={n}
            className={`${styles.btn} ${selected ? styles.selected : styles.empty}`}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}
