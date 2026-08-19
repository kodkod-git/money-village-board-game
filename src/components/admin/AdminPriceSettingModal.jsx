import { useState } from 'react'
import NumberInputModal from '../NumberInputModal'
import {
  STOCK_LABELS, REAL_ESTATE_LABELS, DEFAULT_PRICES, STOCK_IMAGES, REAL_ESTATE_IMAGES,
} from '../PriceSettingModal'
import { MAX_ASSET_PRICE } from '../../constants/gameData'
import styles from './AdminPriceSettingModal.module.css'

export default function AdminPriceSettingModal({ prices, onConfirm, onClose, initialCategory = 'stocks' }) {
  const [category, setCategory] = useState(initialCategory)
  const [tempPrices, setTempPrices] = useState(prices)
  const [editingKey, setEditingKey] = useState(null)

  function handleReset() {
    setTempPrices(prev => ({ ...prev, [category]: DEFAULT_PRICES[category] }))
  }

  const labels = category === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const images = category === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const folder = category === 'stocks' ? 'stock' : 'estate'
  const editingLabel = editingKey ? labels[editingKey] : null

  return (
    <>
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

          <div className={styles.list}>
            {Object.keys(labels).map(key => (
              <div key={key} className={styles.row}>
                <img src={`/badges/${folder}/${images[key]}.png`} alt="" className={styles.rowIcon} />
                <div className={styles.rowInfo}>
                  <span className={styles.rowLabel}>{labels[key]}</span>
                  <span className={styles.rowUnit}>단위: 원</span>
                </div>
                <button type="button" className={styles.pricePill} onClick={() => setEditingKey(key)}>
                  {tempPrices[category][key].toLocaleString()} 원 ›
                </button>
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.confirmBtn} onClick={() => onConfirm(tempPrices)}>확인하기</button>
          </div>
        </div>
      </div>

      {editingKey && (
        <NumberInputModal
          title={editingLabel}
          initialValue={tempPrices[category][editingKey]}
          unit="원"
          maxValue={MAX_ASSET_PRICE}
          onConfirm={val => {
            setTempPrices(prev => ({ ...prev, [category]: { ...prev[category], [editingKey]: val } }))
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </>
  )
}
