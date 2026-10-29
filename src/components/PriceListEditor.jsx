import { useState } from 'react'
import NumberInputModal from './NumberInputModal'
import {
  MAX_ASSET_PRICE,
  STOCK_LABELS, STOCK_IMAGES,
  REAL_ESTATE_LABELS, ESTATE_IMAGES as REAL_ESTATE_IMAGES,
} from '../constants/gameData'
import styles from './PriceSettingModal.module.css'

// 한 종류(주식 또는 부동산)의 가격 목록과 계산기. 관리자 가격 설정 모달(PriceSettingModal)에서 쓴다.
// prices: 그 종류의 { 종목키: 가격 } / onChange: 바뀐 { 종목키: 가격 } 전체를 받는다.
export default function PriceListEditor({ category, prices, onChange }) {
  const [editingKey, setEditingKey] = useState(null)

  const labels = category === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const images = category === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const folder = category === 'stocks' ? 'stock' : 'estate'

  return (
    <>
      <div className={styles.list}>
        {Object.keys(labels).map(key => (
          <div key={key} className={styles.row}>
            <img src={`/badges/${folder}/${images[key]}.png`} alt="" className={styles.rowIcon} />
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{labels[key]}</span>
              <span className={styles.rowUnit}>단위: 원</span>
            </div>
            <button type="button" className={styles.pricePill} onClick={() => setEditingKey(key)}>
              <span className={styles.priceValue}>{prices[key].toLocaleString()}</span>{' '}
              <span className={styles.priceUnitLabel}>원 ›</span>
            </button>
          </div>
        ))}
      </div>

      {editingKey && (
        <NumberInputModal
          title={labels[editingKey]}
          // 새 가격을 바로 입력할 수 있도록 계산기는 현재 가격 대신 0원에서 시작한다.
          initialValue={0}
          unit="원"
          maxValue={MAX_ASSET_PRICE}
          onConfirm={val => {
            onChange({ ...prices, [editingKey]: val })
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </>
  )
}
