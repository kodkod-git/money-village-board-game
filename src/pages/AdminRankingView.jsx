import { useState, useEffect, useMemo } from 'react'
import RankBadge from '../components/admin/RankBadge'
import AdminEditModal from '../components/admin/AdminEditModal'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import { toAdminPlayer, toAdminPrices } from '../utils/adminPlayerAdapters'
import { JOB_LABELS } from '../constants/gameData'
import styles from './AdminRankingView.module.css'

const CATEGORY_TABS = [
  { key: 'totalAssets', label: '총자산' },
  { key: 'cash', label: '현금' },
  { key: 'realEstate', label: '부동산' },
  { key: 'stock', label: '주식' },
]

const VALUE_KEYS = { totalAssets: 'totalAssets', cash: 'cash', stock: 'stockValue', realEstate: 'realEstateValue' }
const PODIUM_ORDER = [1, 0, 2]
const BADGE_SIZES = { 1: 46, 2: 38, 3: 28 }

function formatWon(value) {
  return value != null ? `${value.toLocaleString()}원` : '-원'
}

function formatManwon(value) {
  return value != null ? `${Math.round(value / 10000).toLocaleString()}만원` : '-'
}

function matchesSearch(row, query) {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return row.name?.toLowerCase().includes(q) || row.teamCode?.toLowerCase().includes(q)
}

export default function AdminRankingView({ classId, classDisplayName }) {
  const [category, setCategory] = useState('totalAssets')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [viewingPlayer, setViewingPlayer] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ classId })
    if (category !== 'totalAssets') params.set('category', category)

    fetch(`/api/rankings?${params.toString()}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [category, classId])

  const valueKey = VALUE_KEYS[category]
  const filteredRows = useMemo(() => rows.filter(row => matchesSearch(row, search)), [rows, search])
  const podiumRows = PODIUM_ORDER.map(i => rows[i]).filter(Boolean)
  const activeLabel = CATEGORY_TABS.find(t => t.key === category)?.label

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>자산 랭킹</h1>
          <p className={styles.subtitle}>{classDisplayName} · {activeLabel} 기준 순위를 확인할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder="이름 또는 팀 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.tabs}>
            {CATEGORY_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.tab} ${category === tab.key ? styles.tabActive : ''}`}
                onClick={() => { setRows([]); setCategory(tab.key) }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className={styles.adminBadge}>★ 관리자 모드</span>
        </div>
      </div>

      <div className={styles.content}>
        {loading && <p className={styles.message}>불러오는 중...</p>}
        {error && <p className={styles.message}>{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <AdminEmptyState
            title="표시할 랭킹 데이터가 없습니다."
            subtitle="팀 결과가 등록되면 랭킹을 확인할 수 있습니다."
          />
        )}
        {!loading && !error && rows.length > 0 && (
          <>
            {podiumRows.length === 3 && (
              <div className={styles.hero}>
                <div className={styles.heroBlobLeft} aria-hidden="true" />
                <div className={styles.heroBlobRight} aria-hidden="true" />
                <div className={styles.heroBlobBottom} aria-hidden="true" />
                <p className={styles.heroHeading}>
                  명예의 전당에 오른 주인공은<br />누구였을까요?
                </p>
                <div className={styles.podium}>
                  {podiumRows.map(row => (
                    <button
                      key={row.playerUuid}
                      type="button"
                      className={`${styles.podiumCard} ${styles[`podium-${row.rank}`]}`}
                      onClick={() => setViewingPlayer(row)}
                    >
                      <div className={styles.podiumAvatarWrap}>
                        <img src={`/characters/${row.character}.png`} alt={row.name} className={styles.podiumAvatar} />
                      </div>
                      <span className={styles.podiumName}>{row.name}</span>
                      <div className={styles.podiumBlock}>
                        <div className={styles.podiumBadgeValue}>
                          <RankBadge rank={row.rank} size={BADGE_SIZES[row.rank]} />
                          <span className={styles.podiumValue}>{formatManwon(row[valueKey])}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thRank}>순위</th>
                    <th className={styles.th}>참가자</th>
                    <th className={styles.th}>팀</th>
                    <th className={styles.thRight}>현금</th>
                    <th className={styles.thRight}>부동산</th>
                    <th className={styles.thRight}>주식</th>
                    <th className={styles.thRight}>총자산</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => (
                    <tr key={row.playerUuid} className={styles.tr} onClick={() => setViewingPlayer(row)}>
                      <td className={styles.tdRank}>
                        <RankBadge rank={row.rank} size={32} />
                      </td>
                      <td className={styles.td}>
                        <div className={styles.participant}>
                          <img src={`/characters/${row.character}.png`} alt="" className={styles.avatar} />
                          <div className={styles.participantText}>
                            <span className={styles.participantName}>{row.name}</span>
                            <span className={styles.participantAffiliation}>{row.affiliation}</span>
                            <span className={styles.participantJob}>{JOB_LABELS[row.job] ?? '미입력'}</span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>{row.teamName || row.teamCode}</td>
                      <td className={styles.tdRight}>{formatWon(row.cash)}</td>
                      <td className={styles.tdRight}>{formatWon(row.realEstateValue)}</td>
                      <td className={styles.tdRight}>{formatWon(row.stockValue)}</td>
                      <td className={`${styles.tdRight} ${styles.totalAssets}`}>{formatWon(row.totalAssets)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {viewingPlayer && (
        <div className={styles.overlay} onClick={() => setViewingPlayer(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <AdminEditModal
              player={toAdminPlayer(viewingPlayer)}
              prices={toAdminPrices(viewingPlayer)}
              onClose={() => setViewingPlayer(null)}
              readOnly
            />
          </div>
        </div>
      )}
    </div>
  )
}
