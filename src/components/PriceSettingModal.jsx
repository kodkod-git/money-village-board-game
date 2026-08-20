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
                  <span className={styles.priceValue}>{tempPrices[category][key].toLocaleString()}</span>{' '}
                  <span className={styles.priceUnitLabel}>원 ›</span>
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
