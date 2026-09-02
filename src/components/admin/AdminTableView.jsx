import { useMemo, useState } from 'react'
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import ConfirmDialog from './ConfirmDialog'
import styles from './AdminTableView.module.css'

const COLUMNS = [
  { key: 'cash', label: '현금', sortable: true },
  { key: 'realEstateValue', label: '부동산총액', sortable: true },
  { key: 'stockValue', label: '주식총액', sortable: true },
  { key: 'totalAssets', label: '총자산', sortable: true },
  { key: 'status', label: '상태', sortable: true },
]

const STATUS_ORDER = { 입력완료: 2, 진행중: 1, 미등록: 0 }
const STATUS_META = {
  입력완료: { label: '입력 완료', tone: 'blue' },
  진행중: { label: '진행중', tone: 'yellow' },
  미등록: { label: '미등록', tone: 'gray' },
}

function hasAnyInput(gameState) {
  if (!gameState) return false
  if (gameState.job || gameState.jobVisited) return true
  if (gameState.cash != null) return true
  if (Object.values(gameState.stocks ?? {}).some(count => count > 0)) return true
  if (Object.values(gameState.realEstate ?? {}).some(count => count > 0)) return true
  if ((gameState.badges ?? []).some(Boolean)) return true
  return false
}

function getStatusKey(gameState) {
  if (gameState?.isCompleted) return '입력완료'
  if (hasAnyInput(gameState)) return '진행중'
  return '미등록'
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
      const statusKey = getStatusKey(player.gameState)
      return {
        id: `${room.code}-${player.playerUuid}`,
        roomCode: room.code,
        playerUuid: player.playerUuid,
        name: player.name,
        character: player.character,
        affiliation: player.affiliation,
        cash: breakdown?.cash ?? null,
        realEstateValue: breakdown?.realEstateValue ?? null,
        stockValue: breakdown?.stockValue ?? null,
        totalAssets: breakdown?.totalAssets ?? null,
        statusKey,
      }
    })
  )
}

function compareRows(a, b, key, dir) {
  let diff
  if (key === 'status') {
    diff = STATUS_ORDER[a.statusKey] - STATUS_ORDER[b.statusKey]
  } else {
    const av = a[key] ?? -Infinity
    const bv = b[key] ?? -Infinity
    diff = av - bv
  }
  return dir === 'asc' ? diff : -diff
}

export default function AdminTableView({ rooms, onDeletePlayers }) {
  const [sort, setSort] = useState({ key: null, dir: 'desc' })
  const [selected, setSelected] = useState(() => new Set())
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false)

  const rows = useMemo(() => {
    const flat = flattenRows(rooms)
    if (!sort.key) return flat
    return [...flat].sort((a, b) => compareRows(a, b, sort.key, sort.dir))
  }, [rooms, sort])

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))

  function toggleSort(key) {
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  }

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => (allSelected ? new Set() : new Set(rows.map(r => r.id))))
  }

  async function handleDeleteSelected() {
    const entries = rows
      .filter(r => selected.has(r.id))
      .map(r => ({ roomCode: r.roomCode, playerUuid: r.playerUuid }))
    if (entries.length === 0) return
    await onDeletePlayers?.(entries)
    setSelected(new Set())
  }

  return (
    <div className={styles.tableWrapper}>
      {selected.size > 0 && (
        <div className={styles.selectionBar}>
          <span>{selected.size}명 선택됨</span>
          <button type="button" className={styles.selectionDeleteBtn} onClick={() => setConfirmDeleteSelected(true)}>선택 삭제</button>
        </div>
      )}

      {confirmDeleteSelected && (
        <ConfirmDialog
          tone="danger"
          title="선택 삭제"
          description={<>선택한 {selected.size}명을 삭제하면 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setConfirmDeleteSelected(false)}
          onConfirm={() => { setConfirmDeleteSelected(false); handleDeleteSelected() }}
        />
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thCheckbox}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
            </th>
            <th className={styles.th}>참가자</th>
            {COLUMNS.map(col => (
              <th key={col.key} className={styles.th}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort(col.key)}>
                  {col.label}
                  <span className={styles.sortIcon} aria-hidden="true">
                    {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⌄'}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const meta = STATUS_META[row.statusKey]
            return (
              <tr key={row.id} className={styles.tr}>
                <td className={styles.td}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`${row.name} 선택`}
                  />
                </td>
                <td className={styles.td}>
                  <div className={styles.participant}>
                    <img src={`/characters/${row.character}.png`} alt="" className={styles.avatar} />
                    <div className={styles.participantText}>
                      <span className={styles.participantName}>{row.name}</span>
                      <span className={styles.participantAffiliation}>{row.affiliation}</span>
                    </div>
                  </div>
                </td>
                <td className={styles.td}>{formatWon(row.cash)}</td>
                <td className={styles.td}>{formatWon(row.realEstateValue)}</td>
                <td className={styles.td}>{formatWon(row.stockValue)}</td>
                <td className={`${styles.td} ${styles.totalAssets}`}>{formatWon(row.totalAssets)}</td>
                <td className={styles.td}>
                  <span className={`${styles.statusPill} ${styles[`tone-${meta.tone}`]}`}>{meta.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
