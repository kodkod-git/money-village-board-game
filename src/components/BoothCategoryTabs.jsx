import styles from './BoothCategoryTabs.module.css'

export const BOOTH_CATEGORIES = [
  { key: 'stock', label: '주식' },
  { key: 'realEstate', label: '부동산' },
]

export default function BoothCategoryTabs({ activeCategory, onSelect }) {
  return (
    <div className={styles.grid}>
      {BOOTH_CATEGORIES.map(category => (
        <button
          key={category.key}
          type="button"
          className={`${styles.tab} ${activeCategory === category.key ? styles.active : ''}`}
          onClick={() => onSelect(category.key)}
        >
          {category.label}
        </button>
      ))}
    </div>
  )
}
