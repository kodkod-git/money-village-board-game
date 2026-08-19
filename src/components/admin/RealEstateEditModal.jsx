import { useState } from 'react'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES, MAX_ASSET_QUANTITY } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

export default function RealEstateEditModal({ values, onChange, onClose }) {
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
            <span className={styles.title}>부동산 수정</span>
            <span className={styles.subtitle}>부동산 보유 수량을 수정해 주세요</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.assetGrid}>
            {Object.keys(REAL_ESTATE_LABELS).map(key => (
              <div key={key} className={styles.assetTile}>
                <div className={styles.assetTileHead}>
                  <img
                    src={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                    alt={REAL_ESTATE_LABELS[key]}
                    className={styles.assetTileIcon}
                  />
                  <div className={styles.assetTileInfo}>
                    <span className={styles.assetTileName}>{REAL_ESTATE_LABELS[key]}</span>
                    <span className={styles.assetTilePrice}>{ESTATE_PRICES[key]}</span>
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
                    aria-label={`${REAL_ESTATE_LABELS[key]} 수량`}
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
