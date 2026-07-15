import styles from './RankingTable.module.css'

export default function RankingTable({ rows, highlightPlayerUuid, onRowClick, valueKey = 'totalAssets' }) {
  const pinnedRow = highlightPlayerUuid
    ? rows.find(r => r.playerUuid === highlightPlayerUuid)
    : null

  function formatValue(row) {
    const value = row[valueKey]
    return value == null ? '-원' : `${value.toLocaleString()}원`
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {rows.map(row => (
          <div
            key={`${row.sessionId ?? ''}-${row.playerUuid ?? `${row.rank}-${row.name}`}`}
            className={styles.row}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            <span className={styles.rank}>{row.rank}위</span>
            <img
              src={`/characters/${row.character}.png`}
              alt={row.character}
              className={styles.characterImg}
            />
            <div className={styles.info}>
              <span className={styles.name}>{row.name}</span>
              <span className={styles.sub}>{row.affiliation} · {row.teamCode}</span>
            </div>
            <span className={styles.value}>{formatValue(row)}</span>
          </div>
        ))}
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
          <span className={styles.pinnedAffiliation}>{pinnedRow.affiliation} · {pinnedRow.teamCode}</span>
          <span className={styles.pinnedAssets}>{formatValue(pinnedRow)}</span>
        </div>
      )}

      {highlightPlayerUuid && !pinnedRow && (
        <div
          className={`${styles.pinnedRow} ${styles.pinnedRowEmpty}`}
          data-testid="pinned-row-empty"
          onClick={onRowClick ? () => onRowClick({ isPlaceholder: true }) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          <span className={styles.pinnedRank}>-위</span>
          <span className={styles.pinnedRowEmptyLabel}>게임에 참여하러 가기</span>
          <span className={styles.pinnedAssets}>-원</span>
        </div>
      )}
    </div>
  )
}
