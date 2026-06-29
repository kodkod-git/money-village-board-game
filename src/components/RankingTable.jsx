import styles from './RankingTable.module.css'

export default function RankingTable({ rows, highlightPlayerUuid, onRowClick }) {
  const pinnedRow = highlightPlayerUuid
    ? rows.find(r => r.playerUuid === highlightPlayerUuid)
    : null

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>등수</th>
              <th className={styles.th}>캐릭터</th>
              <th className={styles.th}>이름</th>
              <th className={styles.th}>소속</th>
              <th className={styles.th}>총자산</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={`${row.sessionId ?? ''}-${row.playerUuid ?? `${row.rank}-${row.name}`}`}
                className={styles.tr}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                <td className={styles.td}>{row.rank}</td>
                <td className={styles.td}>
                  <img
                    src={`/characters/${row.character}.png`}
                    alt={row.character}
                    className={styles.characterImg}
                  />
                </td>
                <td className={styles.td}>{row.name}</td>
                <td className={styles.td}>{row.affiliation}</td>
                <td className={styles.td}>{row.totalAssets.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pinnedRow && (
        <div className={styles.pinnedRow} data-testid="pinned-row">
          <span className={styles.pinnedRank}>{pinnedRow.rank}위</span>
          <img
            src={`/characters/${pinnedRow.character}.png`}
            alt={pinnedRow.character}
            className={styles.characterImg}
          />
          <span className={styles.pinnedName}>{pinnedRow.name}</span>
          <span className={styles.pinnedAffiliation}>{pinnedRow.affiliation}</span>
          <span className={styles.pinnedAssets}>{pinnedRow.totalAssets.toLocaleString()}원</span>
        </div>
      )}

      {highlightPlayerUuid && !pinnedRow && (
        <div
          className={`${styles.pinnedRow} ${styles.pinnedRowEmpty}`}
          data-testid="pinned-row-empty"
          onClick={onRowClick ? () => onRowClick({ isPlaceholder: true }) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          <span className={styles.pinnedRowEmptyLabel}>게임에 참여하러 가기</span>
        </div>
      )}
    </div>
  )
}
