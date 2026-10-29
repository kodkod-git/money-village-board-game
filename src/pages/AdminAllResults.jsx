import { useEffect, useMemo, useState } from 'react'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import TypeDistribution from '../components/admin/TypeDistribution'
import dashboardStyles from './AdminDashboard.module.css'
import tableStyles from '../components/admin/AdminTableView.module.css'
import styles from './AdminAllResults.module.css'

const TABS = [
  { key: 'table', label: '테이블 뷰', icon: '/icons/IconTable.png' },
  { key: 'chart', label: '유형 분포 뷰', icon: '/icons/IconChart.svg' },
]

const COLUMNS = [
  { key: 'cash', label: '현금' },
  { key: 'realEstateValue', label: '부동산총액' },
  { key: 'stockValue', label: '주식총액' },
  { key: 'totalAssets', label: '총자산' },
]

function formatWon(value) {
  return value != null ? `${Number(value).toLocaleString()}원` : '-'
}

function reportPath(row) {
  return `/result/${row.sessionId}/report?player=${encodeURIComponent(row.playerUuid)}`
}

function guidePath(row) {
  return `/result/${row.sessionId}/guide?player=${encodeURIComponent(row.playerUuid)}`
}

function ResultsTable({ rows }) {
  const [sort, setSort] = useState({ key: null, dir: 'desc' })

  // 정렬 기준을 고르기 전에는 결과를 등록한 최신순으로 보여 준다(API는 총자산 랭킹순으로 내려온다).
  const sorted = useMemo(() => {
    if (!sort.key) return [...rows].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    return [...rows].sort((a, b) => {
      const diff = (a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity)
      return sort.dir === 'asc' ? diff : -diff
    })
  }, [rows, sort])

  function toggleSort(key) {
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  }

  return (
    <div className={tableStyles.tableWrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th className={tableStyles.th}>참가자</th>
            <th className={tableStyles.th}>수업 · 팀</th>
            {COLUMNS.map(col => (
              <th key={col.key} className={tableStyles.th}>
                <button type="button" className={tableStyles.sortBtn} onClick={() => toggleSort(col.key)}>
                  {col.label}
                  <span className={tableStyles.sortIcon} aria-hidden="true">
                    {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⌄'}
                  </span>
                </button>
              </th>
            ))}
            <th className={tableStyles.th}>보고서</th>
            <th className={tableStyles.th}>안내서</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={`${row.sessionId}-${row.playerUuid}`} className={tableStyles.tr}>
              <td className={tableStyles.td}>
                <div className={tableStyles.participant}>
                  <img src={`/characters/${row.character}.png`} alt="" className={tableStyles.avatar} />
                  <div className={tableStyles.participantText}>
                    <span className={tableStyles.participantName}>{row.name}</span>
                    <span className={tableStyles.participantAffiliation}>{row.affiliation}</span>
                  </div>
                </div>
              </td>
              <td className={tableStyles.td}>
                <span className={styles.classTeam}>{row.className}</span>
                <span className={styles.teamName}>{row.teamName}</span>
              </td>
              <td className={tableStyles.td}>{formatWon(row.cash)}</td>
              <td className={tableStyles.td}>{formatWon(row.realEstateValue)}</td>
              <td className={tableStyles.td}>{formatWon(row.stockValue)}</td>
              <td className={`${tableStyles.td} ${tableStyles.totalAssets}`}>{formatWon(row.totalAssets)}</td>
              <td className={tableStyles.td}>
                {row.sessionId && row.playerUuid ? (
                  <a className={styles.reportLink} href={reportPath(row)} target="_blank" rel="noopener noreferrer">
                    보고서
                  </a>
                ) : '-'}
              </td>
              <td className={tableStyles.td}>
                {row.sessionId && row.playerUuid ? (
                  <a className={styles.reportLink} href={guidePath(row)} target="_blank" rel="noopener noreferrer">
                    안내서
                  </a>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminAllResults() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState('chart')

  useEffect(() => {
    fetch('/api/rankings')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setRows)
      .catch(() => setError(true))
  }, [])

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.header}>
        <div>
          <h1 className={dashboardStyles.title}>게임 분석</h1>
          <p className={dashboardStyles.subtitle}>모든 수업·팀의 게임 결과를 한 곳에서 확인합니다</p>
        </div>
        <div className={dashboardStyles.headerActions}>
          <div className={dashboardStyles.viewToggle} role="tablist" aria-label="보기 선택">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-label={tab.label}
                title={tab.label}
                className={`${dashboardStyles.viewToggleBtn} ${activeTab === tab.key ? dashboardStyles.viewToggleBtnActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span
                  className={dashboardStyles.viewToggleIcon}
                  style={{ WebkitMaskImage: `url(${tab.icon})`, maskImage: `url(${tab.icon})` }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className={styles.message}>결과를 불러오는 중 오류가 발생했습니다.</p>}
      {!error && rows === null && <p className={styles.message}>불러오는 중...</p>}
      {!error && rows?.length === 0 && (
        <AdminEmptyState title="등록된 게임 결과가 없습니다." subtitle="팀 결과를 등록하면 여기에서 확인할 수 있습니다." />
      )}
      {!error && rows?.length > 0 && activeTab === 'table' && <ResultsTable rows={rows} />}
      {!error && rows?.length > 0 && activeTab === 'chart' && <TypeDistribution rows={rows} />}
    </div>
  )
}
