import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import BoothCategoryTabs from '../components/BoothCategoryTabs'
import AdminEditModal from '../components/admin/AdminEditModal'
import { getPlayerUuid } from '../utils/playerUuid'
import styles from './RankingPage.module.css'

const TOP_TABS = [
  { key: 'overall', label: '전체 랭킹' },
  { key: 'booth', label: '부스 랭킹' },
]

const TABS = [
  { key: 'global', label: '전체' },
  { key: 'class', label: '수업' },
  { key: 'team', label: '팀' },
]

const BOOTH_VALUE_KEYS = { stock: 'stockValue', realEstate: 'realEstateValue' }

function toAdminPlayer(row) {
  return {
    playerUuid: row.playerUuid,
    name: row.name,
    character: row.character,
    affiliation: row.affiliation,
    gameState: {
      job: row.job ?? null,
      cash: row.cash ?? 0,
      stocks: row.stockHoldings ?? {},
      realEstate: row.realEstateHoldings ?? {},
      badges: row.badges ?? [false, false, false, false, false, false],
      isCompleted: true,
    },
  }
}

function toAdminPrices(row) {
  return {
    stocks: row.stockPrices ?? {},
    realEstate: row.realEstatePrices ?? {},
  }
}

export default function RankingPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const isV2 = Boolean(sessionId)

  const [topTab, setTopTab] = useState('overall')
  const [activeTab, setActiveTab] = useState('global')
  const [boothCategory, setBoothCategory] = useState('stock')
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

    if (topTab === 'booth') {
      fetch(`/api/rankings?category=${boothCategory}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(data => { setRows(data); setLoading(false) })
        .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
      return
    }

    if (isV2 && activeTab === 'class' && myClassId === undefined) return

    let url = '/api/rankings'

    if (isV2) {
      if (activeTab === 'class') {
        url = `/api/rankings?classId=${encodeURIComponent(myClassId)}`
      } else if (activeTab === 'team') {
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
    }

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => { setError('불러오는 중 오류가 발생했습니다.'); setLoading(false) })
  }, [activeTab, sessionId, isV2, myClassId, topTab, boothCategory])

  const valueKey = topTab === 'booth' ? BOOTH_VALUE_KEYS[boothCategory] : 'totalAssets'
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
          {TOP_TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.topTab} ${topTab === tab.key ? styles.topTabActive : ''}`}
              onClick={() => {
                // rows를 함께 비워야 이전 탭의 데이터(다른 valueKey 형태)가
                // 새 탭의 렌더에 잘못 섞여 RankingPodium이 깨지는 것을 막는다.
                setRows([])
                setTopTab(tab.key)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {topTab === 'overall' && isV2 && (
          <div className={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => {
                  setRows([])
                  setActiveTab(tab.key)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {topTab === 'booth' && (
          <BoothCategoryTabs
            activeCategory={boothCategory}
            onSelect={category => {
              setRows([])
              setBoothCategory(category)
            }}
          />
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
