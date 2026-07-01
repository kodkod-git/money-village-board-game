import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import styles from './AdminTableView.module.css'

const JOB_LABELS = {
  a: '경영·금융',
  b: '연구·기술',
  c: '보건·교육',
  d: '문화·콘텐츠',
  e: '서비스·판매',
  f: '생산·운송',
}

function hasAnyInput(gameState) {
  if (!gameState) return false
  if (gameState.job) return true
  if (gameState.cash != null) return true
  if (Object.values(gameState.stocks ?? {}).some(count => count > 0)) return true
  if (Object.values(gameState.realEstate ?? {}).some(count => count > 0)) return true
  if ((gameState.badges ?? []).some(Boolean)) return true
  return false
}

function getInputStatus(gameState) {
  if (gameState?.isCompleted) return '✅ 입력완료'
  if (hasAnyInput(gameState)) return '🟡 입력중'
  return '❌ 미입력'
}

function formatWon(value) {
  return value != null ? `${value.toLocaleString()}원` : '-'
}

function flattenRows(rooms) {
  return rooms.flatMap(room =>
    room.players.map(player => {
      const isCompleted = Boolean(player.gameState?.isCompleted)
      const breakdown = isCompleted
        ? calculateAssetBreakdown(player.gameState, room.prices)
        : null
      return {
        key: `${room.code}-${player.playerUuid}`,
        name: player.name,
        affiliation: player.affiliation,
        job: isCompleted ? JOB_LABELS[player.gameState.job] : null,
        cash: breakdown?.cash ?? null,
        realEstateValue: breakdown?.realEstateValue ?? null,
        stockValue: breakdown?.stockValue ?? null,
        totalAssets: breakdown?.totalAssets ?? null,
        status: getInputStatus(player.gameState),
      }
    })
  )
}

export default function AdminTableView({ rooms }) {
  const rows = flattenRows(rooms)
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>이름</th>
            <th className={styles.th}>소속</th>
            <th className={styles.th}>직업</th>
            <th className={styles.th}>현금</th>
            <th className={styles.th}>부동산총액</th>
            <th className={styles.th}>주식총액</th>
            <th className={styles.th}>총자산</th>
            <th className={styles.th}>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className={styles.tr}>
              <td className={styles.td}>{row.name}</td>
              <td className={styles.td}>{row.affiliation}</td>
              <td className={styles.td}>{row.job ?? '-'}</td>
              <td className={styles.td}>{formatWon(row.cash)}</td>
              <td className={styles.td}>{formatWon(row.realEstateValue)}</td>
              <td className={styles.td}>{formatWon(row.stockValue)}</td>
              <td className={styles.td}>{formatWon(row.totalAssets)}</td>
              <td className={`${styles.td} ${styles.status}`}>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
