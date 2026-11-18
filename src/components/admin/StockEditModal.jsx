import { useState } from 'react'
import { STOCK_IMAGES, MAX_ASSET_QUANTITY, stockLabelsFor } from '../../constants/gameData'
import { DEFAULT_PRICES } from '../PriceSettingModal'
import AssetQtyStepper from './AssetQtyStepper'
import styles from './FieldEditModal.module.css'

// fiveBoard: 5판 게임이면 5판 전용 주식(뷰티)도 수정할 수 있다.
export default function StockEditModal({ values, prices, onChange, onClose, fiveBoard = false }) {
  const labels = stockLabelsFor(fiveBoard)
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
          <div className={`${styles.assetGrid} ${Object.keys(labels).length === 4 ? styles.assetGridFour : ''}`}>
            {Object.keys(labels).map(key => (
              <div key={key} className={styles.assetTile}>
                <div className={styles.assetTileHead}>
                  <img
                    src={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                    alt={labels[key]}
                    className={styles.assetTileIcon}
                  />
                  <div className={styles.assetTileInfo}>
                    <span className={styles.assetTileName}>{labels[key]}</span>
                    <span className={styles.assetTilePrice}>{(prices?.[key] ?? DEFAULT_PRICES.stocks[key]).toLocaleString('ko-KR')}원</span>
                  </div>
                </div>
                <AssetQtyStepper
                  value={draft[key] ?? 0}
                  onChange={raw => setQty(key, raw)}
                  max={MAX_ASSET_QUANTITY}
                  label={labels[key]}
                />
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
