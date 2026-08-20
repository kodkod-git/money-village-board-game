import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import { MAX_ASSET_QUANTITY } from '../constants/gameData'
import styles from './QuantitySelector.module.css'

export default function QuantitySelector({ value, onChange, label }) {
  const [showModal, setShowModal] = useState(false)

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
      <button type="button" className={styles.count} onClick={() => setShowModal(true)}>
        <span className={value > 0 ? styles.countValue : styles.countEmpty}>
          {value > 0 ? value : '-'}
        </span>
      </button>
      <button
        className={styles.plusBtn}
        onClick={() => onChange(Math.min(MAX_ASSET_QUANTITY, value + 1))}
        disabled={value >= MAX_ASSET_QUANTITY}
        aria-label="수량 증가"
      >
        +
      </button>

      {showModal && (
        <NumberInputModal
          title={`${label} 수량`}
          initialValue={value}
          unit="개"
          maxValue={MAX_ASSET_QUANTITY}
          onConfirm={next => {
            onChange(next)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
