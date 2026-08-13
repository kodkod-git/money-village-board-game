import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import { MAX_ASSET_PRICE } from '../constants/gameData'
import styles from './PriceSettingModal.module.css'

export const STOCK_LABELS = {
  semiconductor: '반도체 IT',
  finance: '금융',
  industrial: '산업재·기계',
  auto: '소재·화학',
  bio: '바이오·헬스케어',
  content: '콘텐츠·소비재',
}

export const REAL_ESTATE_LABELS = {
  gaon: '공동 가온개미',
  nuri: '공동 누리고양이',
  dami: '다세대 다미원숭이',
  maru: '다세대 마루수리',
  chorong: '아파트 초롱부엉이',
  hani: '아파트 하니여우',
}

export const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

export const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

export const REAL_ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}

export default function PriceSettingModal({ prices, onConfirm, onClose, initialCategory = 'stocks' }) {
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
        <div className={styles.priceModal} onClick={e => e.stopPropagation()}>
          <div className={styles.priceModalHeader}>
            <button className={styles.priceBackBtn} onClick={onClose} type="button">‹ 뒤로</button>
            <span className={styles.priceModalTitle}>가격 설정</span>
            <button className={styles.priceResetBtn} onClick={handleReset} type="button">초기화</button>
          </div>

          <div className={styles.priceTabs}>
            <button
              className={`${styles.priceTab} ${category === 'stocks' ? styles.priceTabActive : ''}`}
              onClick={() => setCategory('stocks')}
              type="button"
            >
              주식
            </button>
            <button
              className={`${styles.priceTab} ${category === 'realEstate' ? styles.priceTabActive : ''}`}
              onClick={() => setCategory('realEstate')}
              type="button"
            >
              부동산
            </button>
          </div>

          <div className={styles.priceList}>
            {Object.keys(labels).map(key => (
              <div key={key} className={styles.priceRow}>
                <img src={`/badges/${folder}/${images[key]}.png`} alt="" className={styles.priceIcon} />
                <div className={styles.priceInfo}>
                  <span className={styles.priceLabel}>{labels[key]}</span>
                  <span className={styles.priceUnit}>단위: 원</span>
                </div>
                <button
                  className={styles.pricePill}
                  onClick={() => setEditingKey(key)}
                  type="button"
                >
                  {tempPrices[category][key].toLocaleString()} 원 ›
                </button>
              </div>
            ))}
          </div>

          <button className={styles.priceConfirmBtn} onClick={() => onConfirm(tempPrices)} type="button">
            확인하기
          </button>
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
