import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import AdminEditModal from '../components/admin/AdminEditModal'
import { getPlayerUuid } from '../utils/playerUuid'
import { toAdminPlayer, toAdminPrices } from '../utils/adminPlayerAdapters'
import styles from './RankingPage.module.css'

const CATEGORY_TABS = [
  { key: 'totalAssets', label: '총자산' },
  { key: 'stock', label: '주식' },
  { key: 'realEstate', label: '부동산' },
]

const SCOPE_TABS = [
  { key: 'global', label: '전체' },
  { key: 'class', label: '수업' },
  { key: 'team', label: '팀' },
]

const VALUE_KEYS = { totalAssets: 'totalAssets', stock: 'stockValue', realEstate: 'realEstateValue' }

export default function RankingPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const isV2 = Boolean(sessionId)

  const [category, setCategory] = useState('totalAssets')
  const [scope, setScope] = useState('global')
  const [rows, setRows] = useState([])
  const [myClassId, setMyClassId] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewingPlayer, setViewingPlayer] = useState(null)

  const myPlayerUuid = getPlayerUuid()

  // V2: 내 수업 파악을 위해 세션 정보에서 classId 조회
  useEffect(() => {
    if (!isV2) return
    fetch(`/api/results/${sessionId}`)
      .then(r => r.json())
      .then(data => setMyClassId(data.classId ?? 'unassigned'))
      .catch(() => {})
  }, [sessionId, isV2])

  useEffect(() => {
    setLoading(true)
    setError(null)

    if (isV2 && scope === 'class' && myClassId === undefined) return

    if (isV2 && scope === 'team') {
      fetch(`/api/results/${sessionId}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(data => {
          const players = (data.players ?? []).map(p => ({
            ...p,
            stockPrices: data.stockPrices,
            realEstatePrices: data.realEstatePrices,
          }))
          setRows(players)
          setLoading(false)
        })
        .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
      return
    }

    const params = new URLSearchParams()
    if (isV2 && scope === 'class') params.set('classId', myClassId)
    if (category !== 'totalAssets') params.set('category', category)
    const query = params.toString()

    fetch(`/api/rankings${query ? `?${query}` : ''}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [category, scope, sessionId, isV2, myClassId])

  const valueKey = VALUE_KEYS[category]
  const podiumRows = rows.slice(0, 3)

  function handleRowClick(row) {
    if (!row || row.isPlaceholder) {
      navigate('/join')
      return
    }
    setViewingPlayer(row)
  }

  return (
    <div className={styles.page}>
      {isV2 ? <BackButton to="/" label="처음으로" /> : <BackButton />}
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>랭킹</h1>
          <p className={styles.subtitle}>총 자산 순위를 확인하세요</p>
        </div>
        <hr className={styles.divider} />
        <div className={styles.topTabs}>
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.topTab} ${category === tab.key ? styles.topTabActive : ''}`}
              onClick={() => {
                // rows를 함께 비워야 이전 탭의 데이터(다른 valueKey 형태)가
                // 새 탭의 렌더에 잘못 섞여 RankingPodium이 깨지는 것을 막는다.
                setRows([])
                setCategory(tab.key)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isV2 && (
          <div className={styles.tabs}>
            {SCOPE_TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${scope === tab.key ? styles.tabActive : ''}`}
                onClick={() => {
                  setRows([])
                  setScope(tab.key)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {loading && <p className={styles.message}>불러오는 중...</p>}
        {error && <p className={styles.message}>{error}</p>}
        {!loading && !error && (
          <RankingTable
            rows={rows}
            valueKey={valueKey}
            highlightPlayerUuid={isV2 ? myPlayerUuid : undefined}
            onRowClick={handleRowClick}
            podium={
              // 순위 1~3위가 모두 있을 때만 시상대를 보여준다. 아래 목록에도 동일한
              // 상위 랭커가 다시 나타나므로, 일부만 채워진 시상대는 오히려 어색하다.
              // 목록과 같은 스크롤 영역 안에 있어야 하므로 RankingTable에 넘겨 그
              // 안에서 렌더링한다.
              podiumRows.length === 3
                ? <RankingPodium rows={podiumRows} valueKey={valueKey} onRowClick={handleRowClick} />
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
