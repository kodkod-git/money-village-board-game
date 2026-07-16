import styles from './RankingPodium.module.css'

const PODIUM_ORDER = [1, 0, 2]

export default function RankingPodium({ rows, valueKey = 'totalAssets' }) {
  if (rows.length === 0) return null

  const podiumRows = PODIUM_ORDER.map(i => rows[i]).filter(Boolean)

  return (
    <div className={styles.podium}>
      {podiumRows.map(row => (
        <div key={row.playerUuid} className={`${styles.slot} ${row.rank === 1 ? styles.first : ''}`}>
          <img src={`/characters/${row.character}.png`} alt={row.character} className={styles.avatar} />
          <span className={styles.name}>{row.name}</span>
          <div className={styles.box}>
            <span className={styles.rank}>{row.rank}위</span>
            {row.rank !== 1 && <hr className={styles.divider} />}
            <span className={styles.value}>{row[valueKey].toLocaleString()}원</span>
          </div>
        </div>
      ))}
    </div>
  )
}
