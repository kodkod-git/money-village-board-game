import QuantitySelector from './QuantitySelector'
import styles from './AssetRow.module.css'

export default function AssetRow({ image, label, price, value, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.left}>
        <img src={image} alt={label} className={styles.img} />
        <div className={styles.info}>
          <span className={styles.label}>{label}</span>
          <span className={styles.price}>{price}</span>
        </div>
      </div>
      <QuantitySelector value={value} onChange={onChange} />
      <span className={styles.total}>{value}개</span>
    </div>
  )
}
