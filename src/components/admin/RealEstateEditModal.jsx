import AssetListEditor from '../AssetListEditor'
import { REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES } from '../../constants/gameData'
import styles from './FieldEditModal.module.css'

export default function RealEstateEditModal({ values, onChange, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>부동산 수정</span>
        </div>
        <AssetListEditor
          labels={REAL_ESTATE_LABELS}
          images={ESTATE_IMAGES}
          priceLabels={ESTATE_PRICES}
          imageFolder="estate"
          values={values}
          onChange={(key, val) => onChange({ ...values, [key]: val })}
        />
      </div>
    </div>
  )
}
