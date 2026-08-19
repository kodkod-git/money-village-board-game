import styles from './RankBadge.module.css'

const BADGE_SRC = {
  1: '/badges/rank/gold.png',
  2: '/badges/rank/silver.png',
  3: '/badges/rank/bronze.png',
}

export default function RankBadge({ rank, size = 32 }) {
  const src = BADGE_SRC[rank]
  if (!src) return <span className={styles.plainRank}>{rank}</span>
  return <img src={src} alt={`${rank}위`} className={styles.badge} style={{ width: size, height: size }} />
}
