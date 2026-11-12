import styles from './RankingTable.module.css'

function defaultFormatValue(row, valueKey) {
  const value = row[valueKey]
  return value == null ? '-원' : `${value.toLocaleString()}원`
}

function defaultRowKey(row) {
  return `${row.sessionId ?? ''}-${row.playerUuid ?? `${row.rank}-${row.name}`}`
}

// formatValue/getRowKey/highlightKey+getHighlightId는 공식 랭킹(포인트, officialPlayerId 기준)용.
// 기본값은 기존 일반 랭킹 동작(원 단위, playerUuid 기준)과 같다.
export default function RankingTable({
  rows, highlightPlayerUuid, onRowClick, valueKey = 'totalAssets', podium,
  getSub = row => row.className,
  formatValue: formatValueProp,
  getRowKey = defaultRowKey,
  highlightKey,
  getHighlightId = row => row.playerUuid,
}) {
  const targetId = highlightKey ?? highlightPlayerUuid
  const pinnedRow = targetId ? rows.find(r => getHighlightId(r) === targetId) : null

  function formatValue(row) {
    return formatValueProp ? formatValueProp(row) : defaultFormatValue(row, valueKey)
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {podium}
        {rows.map(row => (
          <div
            key={getRowKey(row)}
            className={`${styles.row} ${row.rank <= 3 ? styles.rowTop3 : ''}`}
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
              <span className={styles.sub}>{getSub(row)}</span>
            </div>
            <span className={`${styles.value} ${row.rank <= 3 ? styles.valueTop3 : ''}`}>{formatValue(row)}</span>
          </div>
        ))}
      </div>

      {pinnedRow && (
        <div
          className={styles.pinnedRow}
          data-testid="pinned-row"
          onClick={onRowClick ? () => onRowClick(pinnedRow) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          <span className={styles.pinnedRank}>{pinnedRow.rank}위</span>
          <img
            src={`/characters/${pinnedRow.character}.png`}
            alt={pinnedRow.character}
            className={styles.characterImg}
          />
          <div className={styles.pinnedInfo}>
            <span className={styles.pinnedNameRow}>
              <span className={styles.pinnedName}>{pinnedRow.name}</span>
              <span className={styles.meBadge}>나</span>
            </span>
            <span className={styles.pinnedAffiliation}>{getSub(pinnedRow)}</span>
          </div>
          <span className={styles.pinnedAssets}>{formatValue(pinnedRow)}</span>
        </div>
      )}

      {targetId && !pinnedRow && (
        <button
          type="button"
          className={`${styles.pinnedRow} ${styles.pinnedRowEmpty}`}
          data-testid="pinned-row-empty"
          onClick={onRowClick ? () => onRowClick({ isPlaceholder: true }) : undefined}
          style={onRowClick ? { cursor: 'pointer' } : undefined}
        >
          <span className={styles.pinnedRowEmptyLabel}>게임에 참여하러 가기</span>
        </button>
      )}
    </div>
  )
}
