import { useEffect, useMemo, useState } from 'react'
import { RESULT_GROUPS } from '../constants/quizData'
import {
  calcEconomicPotential, FUTURE_INVEST_RATIO, RISKY_CONCENTRATION_RATIO,
} from '../utils/economicPotential'
import AdminEmptyState from '../components/admin/AdminEmptyState'
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

// 막대 순서: 미래형 2개 → 현재형 2개
const GROUP_ORDER = ['Blue Group', 'Orange Group', 'Red Group', 'Green Group']
const GROUP_AXES = {
  'Blue Group': '미래 · 위험',
  'Orange Group': '미래 · 안전',
  'Red Group': '현재 · 위험',
  'Green Group': '현재 · 안전',
}

const DEFAULT_FUTURE = Math.round(FUTURE_INVEST_RATIO * 100)
const DEFAULT_RISKY = Math.round(RISKY_CONCENTRATION_RATIO * 100)

function formatWon(value) {
  return value != null ? `${Number(value).toLocaleString()}원` : '-'
}

function reportPath(row) {
  return `/result/${row.sessionId}/report?player=${encodeURIComponent(row.playerUuid)}`
}

function ResultsTable({ rows }) {
  const [sort, setSort] = useState({ key: null, dir: 'desc' })

  const sorted = useMemo(() => {
    if (!sort.key) return rows
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ThresholdSlider({ id, label, description, value, defaultValue, onChange, summary }) {
  return (
    <div className={styles.slider}>
      <div className={styles.sliderHeader}>
        <label htmlFor={id} className={styles.sliderLabel}>{label}</label>
        <span className={styles.sliderValue}>{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      <div className={styles.sliderFooter}>
        <span>{description}</span>
        {value !== defaultValue && (
          <button type="button" className={styles.resetBtn} onClick={() => onChange(defaultValue)}>
            기본값 {defaultValue}%
          </button>
        )}
      </div>
      <p className={styles.sliderSummary}>{summary}</p>
    </div>
  )
}

// 게임 결과(보유 자산)로 계산한 유형만 쓴다 — 경제적 잠재력 "테스트" 응답은 섞지 않는다.
function TypeDistribution({ rows }) {
  const [future, setFuture] = useState(DEFAULT_FUTURE)
  const [risky, setRisky] = useState(DEFAULT_RISKY)

  const results = useMemo(
    () => rows.map(row => calcEconomicPotential(row, {
      futureInvestRatio: future / 100,
      riskyConcentrationRatio: risky / 100,
    })),
    [rows, future, risky]
  )
  const total = results.length
  const counts = Object.fromEntries(GROUP_ORDER.map(g => [g, results.filter(r => r.group === g).length]))
  const futureCount = results.filter(r => r.horizon === 'future').length
  const riskyCount = results.filter(r => r.risk === 'risky').length
  // 막대 높이는 전체 인원을 기준으로 고정해, 기준값을 바꾸면 막대가 실제로 늘고 줄어 보이게 한다.
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className={styles.distribution}>
      <div className={styles.sliders}>
        <ThresholdSlider
          id="future-threshold"
          label="미래형 기준 · 순자산 중 투자 비율"
          description={`투자 비율이 ${future}%를 넘으면 미래형`}
          value={future}
          defaultValue={DEFAULT_FUTURE}
          onChange={setFuture}
          summary={`미래형 ${futureCount}명 : 현재형 ${total - futureCount}명`}
        />
        <ThresholdSlider
          id="risky-threshold"
          label="위험형 기준 · 투자 금액 중 한 종목 비중"
          description={`한 종목이 ${risky}% 이상이면 위험형`}
          value={risky}
          defaultValue={DEFAULT_RISKY}
          onChange={setRisky}
          summary={`위험형 ${riskyCount}명 : 안전형 ${total - riskyCount}명`}
        />
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h2 className={styles.chartTitle}>경제적 잠재력 유형 분포</h2>
          <span className={styles.chartHint}>게임 결과 기준 · 전체 {total}명</span>
        </div>
        <div className={styles.plot}>
          <div className={styles.yAxis} aria-hidden="true">
            {ticks.map(t => <span key={t} style={{ bottom: `${t * 100}%` }}>{Math.round(total * t)}</span>)}
          </div>
          <div className={styles.plotArea}>
            <div className={styles.gridLines} aria-hidden="true">
              {ticks.map(t => <span key={t} style={{ bottom: `${t * 100}%` }} />)}
            </div>
            <div
              className={styles.bars}
              role="img"
              aria-label={`유형 분포: ${GROUP_ORDER.map(g => `${g} ${counts[g]}명`).join(', ')}`}
            >
              {GROUP_ORDER.map(group => {
                const ratio = total ? counts[group] / total : 0
                return (
                  <div key={group} className={styles.barColumn}>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.bar}
                        style={{ height: `${ratio * 100}%`, background: RESULT_GROUPS[group].color }}
                      >
                        <span className={styles.barValue}>
                          {counts[group]}명 <small>{(ratio * 100).toFixed(0)}%</small>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className={styles.xAxis}>
          {GROUP_ORDER.map(group => (
            <div key={group} className={styles.xLabel}>
              <span className={styles.xGroup}>{group}</span>
              <span className={styles.xAxes}>{GROUP_AXES[group]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminAllResults() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState('table')

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
          <h1 className={dashboardStyles.title}>전체 결과</h1>
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
