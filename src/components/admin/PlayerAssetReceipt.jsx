import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import {
  JOB_LABELS, JOB_IMAGES, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../../constants/gameData'
import AdminAssetSummary from './AdminAssetSummary'
import styles from './PlayerAssetReceipt.module.css'

export default function PlayerAssetReceipt({ player, prices }) {
  const { gameState } = player
  const { totalAssets } = calculateAssetBreakdown(gameState, prices)
  const earnedBadges = BADGE_NAMES.filter((_, i) => gameState.badges[i])
  const jobText = gameState.job ? JOB_LABELS[gameState.job] : gameState.jobVisited ? '무직' : '직업 미입력'

  return (
    <div className={styles.receipt} data-testid={`asset-receipt-${player.playerUuid}`}>
      <div className={styles.header}>
        <img src={`/characters/${player.character}.png`} alt={player.character} className={styles.avatar} />
        <div className={styles.identity}>
          <span className={styles.name}>{player.name}</span>
          <span className={styles.jobSub}>{jobText}</span>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>직업</span>
        <span className={styles.fieldValue}>
          {gameState.job ? (
            <span className={styles.jobValueRow}>
              <img src={`/badges/job/${JOB_IMAGES[gameState.job]}.png`} alt="" className={styles.jobIcon} />
              <span>{JOB_LABELS[gameState.job]}</span>
            </span>
          ) : gameState.jobVisited ? '무직' : '미입력'}
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>성공열쇠</span>
        <div className={styles.chipRow}>
          {earnedBadges.length === 0 && <span className={styles.fieldValue}>미입력</span>}
          {earnedBadges.map(name => <span key={name} className={styles.chip}>{BADGE_LABELS[name]}</span>)}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>현금</span>
        <span className={styles.cashValue}>{(gameState.cash ?? 0).toLocaleString()}원</span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>주식</span>
        <AdminAssetSummary
          labels={STOCK_LABELS}
          images={STOCK_IMAGES}
          values={gameState.stocks}
          folder="stock"
          unit="주"
          testIdPrefix={`receipt-${player.playerUuid}-stock`}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>부동산</span>
        <AdminAssetSummary
          labels={REAL_ESTATE_LABELS}
          images={ESTATE_IMAGES}
          values={gameState.realEstate}
          folder="estate"
          unit="개"
          testIdPrefix={`receipt-${player.playerUuid}-real-estate`}
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLabel}>총 자산</span>
        <span className={styles.footerValue}>{totalAssets.toLocaleString()}원</span>
      </div>
    </div>
  )
}
