import { useState } from 'react'
import { STOCK_LABELS, STOCK_IMAGES, MAX_ASSET_QUANTITY } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

export default function StockEditModal({ values, onChange, onClose }) {
  const [draft, setDraft] = useState(values)

  function setQty(key, raw) {
    const parsed = parseInt(raw, 10)
    const clamped = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), MAX_ASSET_QUANTITY)
    setDraft(prev => ({ ...prev, [key]: clamped }))
  }

  function handleConfirm() {
    onChange(draft)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.title}>주식 수정</span>
            <span className={styles.subtitle}>주식 보유 수량을 수정해 주세요</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.assetGrid}>
            {Object.keys(STOCK_LABELS).map(key => (
              <div key={key} className={styles.assetTile}>
                <div className={styles.assetTileHead}>
                  <img
                    src={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                    alt={STOCK_LABELS[key]}
                    className={styles.assetTileIcon}
                  />
                  <div className={styles.assetTileInfo}>
                    <span className={styles.assetTileName}>{STOCK_LABELS[key]}</span>
                  </div>
                </div>
                <div className={`${styles.qtyBox} ${draft[key] > 0 ? styles.qtyBoxActive : ''}`}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_ASSET_QUANTITY}
                    className={styles.qtyInput}
                    value={draft[key]}
                    aria-label={`${STOCK_LABELS[key]} 수량`}
                    onChange={e => setQty(key, e.target.value)}
                  />
                </div>
              </div>
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
