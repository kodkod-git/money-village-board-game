import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import styles from './AdminTableView.module.css'

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
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
        teamCode: room.code,
        name: player.name,
        affiliation: player.affiliation,
        job: isCompleted ? JOB_LABELS[player.gameState.job] : null,
        cash: breakdown?.cash ?? null,
        realEstateValue: breakdown?.realEstateValue ?? null,
        stockValue: breakdown?.stockValue ?? null,
        totalAssets: breakdown?.totalAssets ?? null,
        isCompleted,
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
            <th className={styles.th}>팀코드</th>
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
              <td className={styles.td}>{row.teamCode}</td>
              <td className={styles.td}>{row.name}</td>
              <td className={styles.td}>{row.affiliation}</td>
              <td className={styles.td}>{row.job ?? '-'}</td>
              <td className={styles.td}>{row.cash != null ? `${row.cash.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.realEstateValue != null ? `${row.realEstateValue.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.stockValue != null ? `${row.stockValue.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.totalAssets != null ? `${row.totalAssets.toLocaleString()}원` : '-'}</td>
              <td className={styles.td}>{row.isCompleted ? '입력완료' : '미입력'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
