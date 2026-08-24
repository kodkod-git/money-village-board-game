import styles from './FieldEditModal.module.css'

export default function AssetQtyStepper({ value, onChange, max, label }) {
  const numValue = Number(value) || 0

  return (
    <div className={`${styles.qtyBox} ${numValue > 0 ? styles.qtyBoxActive : ''}`}>
      <button
        type="button"
        className={styles.qtyMinusBtn}
        onClick={() => onChange(String(Math.max(0, numValue - 1)))}
        disabled={numValue <= 0}
        aria-label={`${label} 수량 감소`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        className={styles.qtyInput}
        value={value}
        aria-label={`${label} 수량`}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className={styles.qtyPlusBtn}
        onClick={() => onChange(String(Math.min(max, numValue + 1)))}
        disabled={numValue >= max}
        aria-label={`${label} 수량 증가`}
      >
        +
      </button>
    </div>
  )
}
