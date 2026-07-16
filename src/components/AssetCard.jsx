import QuantitySelector from './QuantitySelector'
import styles from './AssetCard.module.css'

export default function AssetCard({ image, label, price, value, onChange }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <img src={image} alt={label} className={styles.img} />
        <div className={styles.info}>
          <span className={styles.label}>{label}</span>
          <span className={styles.price}>{price}</span>
        </div>
      </div>
      <QuantitySelector value={value} onChange={onChange} label={label} />
    </div>
  )
}
