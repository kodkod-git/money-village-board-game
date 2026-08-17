import { useState, useEffect } from 'react'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import AdminEditModal from '../components/admin/AdminEditModal'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import { toAdminPlayer, toAdminPrices } from '../utils/adminPlayerAdapters'
import styles from './AdminRankingView.module.css'

const CATEGORY_TABS = [
  { key: 'totalAssets', label: '총자산' },
  { key: 'stock', label: '주식' },
  { key: 'realEstate', label: '부동산' },
]

const VALUE_KEYS = { totalAssets: 'totalAssets', stock: 'stockValue', realEstate: 'realEstateValue' }

export default function AdminRankingView({ classId, classDisplayName }) {
  const [category, setCategory] = useState('totalAssets')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
  const podiumRows = rows.slice(0, 3)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>랭킹 보기</h1>
          <p className={styles.subtitle}>{classDisplayName} 수업의 랭킹을 확인할 수 있습니다</p>
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
          <RankingTable
            rows={rows}
            valueKey={valueKey}
            onRowClick={setViewingPlayer}
            podium={
              podiumRows.length === 3
                ? <RankingPodium rows={podiumRows} valueKey={valueKey} onRowClick={setViewingPlayer} />
                : null
            }
          />
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
