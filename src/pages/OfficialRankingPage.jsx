import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import RankingPodium from '../components/RankingPodium'
import RankingTable from '../components/RankingTable'
import useBodyClass from '../hooks/useBodyClass'
import { getRememberedOfficialPlayers } from '../utils/officialPlayer'
import rankingStyles from './RankingPage.module.css'
import styles from './OfficialRankingPage.module.css'

const TABS = [
  { key: 'bestAssets', label: '총자산' },
  { key: 'points', label: '승점' },
]

function formatPoints(points) {
  return `${Number.isInteger(points) ? points : points.toFixed(1)}점`
}

function formatWon(value) {
  return `${value.toLocaleString()}원`
}

export default function OfficialRankingPage() {
  useBodyClass('onboarding-mode')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const contestId = searchParams.get('classId') || ''
  const [tab, setTab] = useState('bestAssets')
  const [data, setData] = useState({ contests: [], points: [], bestAssets: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // 범위를 빠르게 바꾸면 이전 요청이 나중에 도착할 수 있으므로, 정리된 요청의 응답은 버린다.
    let ignore = false
    setLoading(true)
    setError(null)
    const url = contestId ? `/api/official-rankings?classId=${encodeURIComponent(contestId)}` : '/api/official-rankings'
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(json => { if (!ignore) setData(json) })
      .catch(() => { if (!ignore) setError('랭킹을 불러오지 못했어요') })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [contestId, reloadKey])

  const isAllContests = !contestId
  // 이름은 실명만 쓴다. 같은 실명이 대회마다 따로 오르는 전체 대회 범위에서는 보조 줄의 대회 이름으로 구분한다.
  const rows = useMemo(() => (data[tab] ?? []).map(p => ({ ...p, name: p.realName })), [data, tab])

  // 내 기록: 결과 화면에서 기억해 둔 공식 참가자 id. 대회별 범위는 그 대회의 id,
  // 전체 대회 범위는 기억한 id 중 순위에 있는 첫 번째를 쓴다.
  const myId = useMemo(() => {
    const remembered = getRememberedOfficialPlayers()
    if (contestId) return remembered[contestId] ?? null
    const ids = new Set(Object.values(remembered))
    return rows.find(r => ids.has(r.officialPlayerId))?.officialPlayerId ?? null
  }, [contestId, rows])

  const isPoints = tab === 'points'
  const formatValue = isPoints ? row => formatPoints(row.points) : row => formatWon(row.bestAssets)
  // 보조 줄. 총자산 탭: 대회 · 팀 · 팀 내 순위 (최고 자산을 기록한 게임 기준).
  // 승점 탭: 게임 수와 1위 횟수, 전체 대회 범위에서는 앞에 대회 이름을 붙인다.
  const getSub = isPoints
    ? row => [isAllContests && row.contestName, `${row.games}게임`, `1위 ${row.wins}회`].filter(Boolean).join(' · ')
    : row => [row.contestName, row.bestTeamName, row.bestTableRank && `팀 내 ${row.bestTableRank}위`].filter(Boolean).join(' · ')
  const getRowKey = row => row.officialPlayerId
  const podiumRows = rows.slice(0, 3)

  function handleBack() {
    // 이전 화면(일반 랭킹이나 결과 화면)으로 돌아간다. 공식 랭킹으로 바로 들어와 이전 기록이 없으면 일반 랭킹으로 간다.
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/ranking')
  }

  function handleContestChange(e) {
    const next = e.target.value
    setSearchParams(next ? { classId: next } : {}, { replace: true })
  }

  return (
    <div className={rankingStyles.page}>
      <BackButton onClick={handleBack} />
      <div className={rankingStyles.inner}>
        <div className={rankingStyles.header}>
          <h1 className={rankingStyles.title}>공식 랭킹</h1>
          <p className={rankingStyles.subtitle}>대회 순위를 확인하세요.</p>
        </div>

        <div className={styles.scopeRow}>
          <select
            aria-label="대회 선택"
            className={styles.contestSelect}
            value={contestId}
            onChange={handleContestChange}
          >
            <option value="">전체 대회</option>
            {data.contests.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className={rankingStyles.topTabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`${rankingStyles.topTab} ${tab === t.key ? rankingStyles.topTabActive : ''}`}
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <hr className={rankingStyles.divider} />

        {loading && <p className={rankingStyles.message}>불러오는 중...</p>}
        {error && (
          <div className={styles.errorBox}>
            <p className={rankingStyles.message}>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={() => setReloadKey(k => k + 1)}>
              다시 시도
            </button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className={rankingStyles.message}>아직 집계된 공식 게임이 없어요</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <RankingTable
            rows={rows}
            formatValue={formatValue}
            getSub={getSub}
            getRowKey={getRowKey}
            highlightKey={myId ?? undefined}
            getHighlightId={row => row.officialPlayerId}
            podium={podiumRows.length === 3
              ? <RankingPodium rows={podiumRows} formatValue={formatValue} getRowKey={getRowKey} />
              : null}
          />
        )}
      </div>
    </div>
  )
}
