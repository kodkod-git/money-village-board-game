import styles from './QuantitySelector.module.css'

const MAX = 10

export default function QuantitySelector({ value, onChange }) {
  return (
    <div className={styles.stepper}>
      <button
        className={styles.minusBtn}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label="수량 감소"
      >
        −
      </button>
      <span className={styles.count}>{value}</span>
      <button
        className={styles.plusBtn}
        onClick={() => onChange(Math.min(MAX, value + 1))}
        disabled={value >= MAX}
        aria-label="수량 증가"
      >
        +
      </button>
    </div>
  )
}
