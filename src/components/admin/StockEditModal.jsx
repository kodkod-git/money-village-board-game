import AssetListEditor from '../AssetListEditor'
import { STOCK_LABELS, STOCK_IMAGES } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

const STOCK_PRICE_LABELS = Object.fromEntries(Object.keys(STOCK_LABELS).map(key => [key, '가격 설정']))

export default function StockEditModal({ values, onChange, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
          <span className={styles.title}>주식 수정</span>
        </div>
        <AssetListEditor
          labels={STOCK_LABELS}
          images={STOCK_IMAGES}
          priceLabels={STOCK_PRICE_LABELS}
          imageFolder="stock"
          values={values}
          onChange={(key, val) => onChange({ ...values, [key]: val })}
        />
      </div>
    </div>
  )
}
