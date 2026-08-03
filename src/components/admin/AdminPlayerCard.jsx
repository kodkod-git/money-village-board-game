import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import {
  JOB_LABELS, BADGE_NAMES,
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../../constants/gameData'
import styles from './AdminPlayerCard.module.css'

export default function AdminPlayerCard({ player, prices, onEdit }) {
  const { gameState } = player
  const { totalAssets } = calculateAssetBreakdown(gameState, prices)
  const earnedBadges = BADGE_NAMES.filter((_, i) => gameState.badges[i])
  const ownedRealEstate = Object.keys(REAL_ESTATE_LABELS).filter(key => gameState.realEstate[key] > 0)
  const ownedStocks = Object.keys(STOCK_LABELS).filter(key => gameState.stocks[key] > 0)

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <img src={`/characters/${player.character}.png`} alt={player.character} className={styles.avatar} />
        <div className={styles.identity}>
          <span className={styles.name}>{player.name}</span>
          {player.connected === false && (
            <span className={styles.reconnectingBadge}>재접속 중</span>
          )}
          <span className={styles.job}>{gameState.job ? JOB_LABELS[gameState.job] : '직업 미입력'}</span>
        </div>
        <button type="button" className={styles.editBtn} onClick={onEdit}>수정</button>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>총 자산</span>
        <span className={styles.totalAssets}>{totalAssets.toLocaleString()}원</span>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>성공카드</span>
        <div className={styles.iconRow}>
          {earnedBadges.map(name => (
            <img key={name} src={`/badges/${name}.png`} alt={name} className={styles.badgeIcon} />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>부동산</span>
        <div className={styles.iconRow}>
          {ownedRealEstate.map(key => (
            <span key={key} className={styles.iconCount}>
              <img
                src={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                alt={REAL_ESTATE_LABELS[key]}
                className={styles.assetIcon}
              />
              {gameState.realEstate[key]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>주식</span>
        <div className={styles.iconRow}>
          {ownedStocks.map(key => (
            <span key={key} className={styles.iconCount}>
              <img
                src={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                alt={STOCK_LABELS[key]}
                className={styles.assetIcon}
              />
              {gameState.stocks[key]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
