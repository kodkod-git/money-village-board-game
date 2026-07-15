import styles from './BoothCategoryTabs.module.css'

export const BOOTH_CATEGORIES = [
  { key: 'labor', label: '노동', enabled: false },
  { key: 'job', label: '직업', enabled: false },
  { key: 'bank', label: '은행', enabled: false },
  { key: 'stock', label: '주식', enabled: true },
  { key: 'realEstate', label: '부동산', enabled: true },
  { key: 'luck', label: '행운', enabled: false },
]

export default function BoothCategoryTabs({ activeCategory, onSelect }) {
  return (
    <div className={styles.grid}>
      {BOOTH_CATEGORIES.map(category => (
        <button
          key={category.key}
          type="button"
          className={`${styles.tab} ${activeCategory === category.key ? styles.active : ''}`}
          disabled={!category.enabled}
          onClick={() => onSelect(category.key)}
        >
          {category.label}
        </button>
      ))}
    </div>
  )
}
