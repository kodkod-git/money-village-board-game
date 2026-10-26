import { useState } from 'react'
import PriceListEditor from './PriceListEditor'
import {
  STOCK_LABELS, STOCK_IMAGES,
  REAL_ESTATE_LABELS, ESTATE_IMAGES as REAL_ESTATE_IMAGES,
} from '../constants/gameData'
import styles from './PriceSettingModal.module.css'

export { STOCK_LABELS, STOCK_IMAGES, REAL_ESTATE_LABELS, REAL_ESTATE_IMAGES }

export const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
  realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
}

export default function PriceSettingModal({ prices, onConfirm, onClose, initialCategory = 'stocks' }) {
  const [category, setCategory] = useState(initialCategory)
  const [tempPrices, setTempPrices] = useState(prices)

  function handleReset() {
    setTempPrices(prev => ({ ...prev, [category]: DEFAULT_PRICES[category] }))
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>가격 설정</span>
          <button type="button" className={styles.resetBtn} onClick={handleReset}>초기화</button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${category === 'stocks' ? styles.tabActive : ''}`}
            onClick={() => setCategory('stocks')}
          >
            주식
          </button>
          <button
            type="button"
            className={`${styles.tab} ${category === 'realEstate' ? styles.tabActive : ''}`}
            onClick={() => setCategory('realEstate')}
          >
            부동산
          </button>
        </div>

        <PriceListEditor
          category={category}
          prices={tempPrices[category]}
          onChange={next => setTempPrices(prev => ({ ...prev, [category]: next }))}
        />

        <div className={styles.footer}>
          <button type="button" className={styles.confirmBtn} onClick={() => onConfirm(tempPrices)}>확인하기</button>
        </div>
      </div>
    </div>
  )
}
