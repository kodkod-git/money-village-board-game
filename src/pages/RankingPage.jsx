import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingTable from '../components/RankingTable'
import { getPlayerUuid } from '../utils/playerUuid'
import styles from './RankingPage.module.css'

const TABS = [
  { key: 'global', label: '전체' },
  { key: 'affiliation', label: '소속' },
  { key: 'team', label: '팀' },
]

export default function RankingPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const isV2 = Boolean(sessionId)

  const [activeTab, setActiveTab] = useState('global')
  const [rows, setRows] = useState([])
  const [myAffiliation, setMyAffiliation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const myPlayerUuid = getPlayerUuid()

  // V2: 내 소속 파악을 위해 팀 결과에서 내 기록 찾기
  useEffect(() => {
    if (!isV2) return
    fetch(`/api/results/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        const me = data.players?.find(p => p.playerUuid === myPlayerUuid)
        if (me) setMyAffiliation(me.affiliation)
      })
      .catch(() => {})
  }, [sessionId, isV2, myPlayerUuid])

  useEffect(() => {
    setLoading(true)
    setError(null)

    if (isV2 && activeTab === 'affiliation' && myAffiliation === null) return

    let url = '/api/rankings'

    if (isV2) {
      if (activeTab === 'affiliation' && myAffiliation) {
        url = `/api/rankings?affiliation=${encodeURIComponent(myAffiliation)}`
      } else if (activeTab === 'team') {
        fetch(`/api/results/${sessionId}`)
          .then(r => { if (!r.ok) throw new Error(); return r.json() })
          .then(data => {
            setRows(data.players ?? [])
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
  }, [activeTab, sessionId, isV2, myAffiliation])

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>🏆 랭킹</h1>
        </div>

        {isV2 && (
          <div className={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
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
            highlightPlayerUuid={myPlayerUuid}
            onRowClick={row => {
              if (!row || row.isPlaceholder) {
                navigate('/team')
                return
              }
              if (row.sessionId && row.playerUuid) {
                navigate(`/result/${row.sessionId}/player/${row.playerUuid}`)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
