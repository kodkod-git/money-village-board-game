import { useMemo } from 'react'
import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../../constants/gameData'
import { DEFAULT_PRICES } from '../PriceSettingModal'
import { formatWon } from '../../utils/clanRecap'
import styles from './TeamPriceCharts.module.css'

// 막대 색은 종목(시리즈)마다 고정한다 — 팀 수가 바뀌어도 같은 종목은 같은 색.
const STOCK_SERIES = [
  { key: 'bio', color: '#2a78d6' },
  { key: 'semiconductor', color: '#eb6834' },
  { key: 'finance', color: '#1baf7a' },
].map(s => ({ ...s, label: STOCK_LABELS[s.key] }))

const ESTATE_SERIES = [
  { key: 'gaon', color: '#2a78d6' },
  { key: 'chorong', color: '#eb6834' },
  { key: 'dami', color: '#1baf7a' },
].map(s => ({ ...s, label: REAL_ESTATE_LABELS[s.key] }))

const TICK_COUNT = 4

// 팀이 적으면 굵게, 많으면 가늘게 — 팀 묶음이 플롯 폭 안에 들어가도록 막대 폭을 정한다.
export function barWidthFor(teamCount) {
  return Math.max(6, Math.min(36, Math.round(240 / Math.max(teamCount, 1))))
}

// 0부터 시작하고, 눈금 간격을 1·2·5 단위의 보기 좋은 값으로 맞춘 축 범위.
export function niceRange(values) {
  const hi = Math.max(0, ...values)
  const raw = hi / TICK_COUNT || 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].find(n => n * magnitude >= raw) * magnitude
  const max = Math.max(Math.ceil(hi / step) * step, step)
  const ticks = []
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(t)
  return { max, ticks }
}

function formatAxis(value) {
  if (value >= 10000) return `${(value / 10000).toLocaleString('ko-KR')}만`
  return value.toLocaleString('ko-KR')
}

// 결과 행은 참가자 단위라 같은 팀(세션)이 여러 번 나온다. 팀마다 한 번만, 그 게임의 최종 가격을 쓴다.
export function teamPrices(rows) {
  const teams = new Map()
  for (const row of rows) {
    if (teams.has(row.sessionId)) continue
    teams.set(row.sessionId, {
      id: row.sessionId,
      name: row.teamName || '이름 없는 팀',
      stockPrices: row.stockPrices ?? {},
      realEstatePrices: row.realEstatePrices ?? {},
    })
  }
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))
}

function GroupedBars({ title, teams: allTeams, series, pricesKey, basePrices }) {
  // 가격 기록이 없는 옛 결과는 0원으로 오해되지 않게 빼고 그린다.
  const teams = allTeams.filter(team => series.some(s => team[pricesKey][s.key] != null))
  if (teams.length === 0) return null

  // 가격을 한 번도 바꾸지 않은 종목은 저장값이 없을 수 있어 시작 가격으로 본다.
  const prices = teams.map(team => series.map(s => Number(team[pricesKey][s.key] ?? basePrices[s.key])))
  const { max, ticks } = niceRange(prices.flat())
  const barWidth = barWidthFor(teams.length)

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <span className={styles.chartHint}>게임 종료 시점 가격 · 팀 {teams.length}개</span>
        <ul className={styles.legend}>
          {series.map(s => (
            <li key={s.key}>
              <span className={styles.legendSwatch} style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map(t => <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>{formatAxis(t)}</span>)}
        </div>
        <div className={styles.plotArea}>
          <div className={styles.gridLines} aria-hidden="true">
            {ticks.map(t => <span key={t} style={{ bottom: `${(t / max) * 100}%` }} />)}
          </div>
          <div
            className={styles.groups}
            role="img"
            aria-label={`${title}: ${teams.map((team, i) =>
              `${team.name} ${series.map((s, j) => `${s.label} ${formatWon(prices[i][j])}`).join(', ')}`
            ).join(' / ')}`}
          >
            {teams.map((team, i) => (
              <div key={team.id} className={styles.group}>
                {series.map((s, j) => {
                  const height = (prices[i][j] / max) * 100
                  return (
                    <div key={s.key} className={styles.slot} style={{ width: barWidth }}>
                      <div className={styles.bar} style={{ height: `${height}%`, background: s.color }} />
                      <span className={styles.tooltip} role="tooltip" style={{ bottom: `${height}%` }}>
                        <strong>{team.name}</strong> {s.label} {formatWon(prices[i][j])}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        {teams.map(team => <span key={team.id} className={styles.xLabel}>{team.name}</span>)}
      </div>
    </div>
  )
}

// 팀 현황(수업 대시보드) 유형 분포 탭 아래에 팀별 최종 주가·부동산 가격을 비교해 보여 준다.
export default function TeamPriceCharts({ rows }) {
  const teams = useMemo(() => teamPrices(rows), [rows])
  if (teams.length === 0) return null

  return (
    <div className={styles.charts}>
      <GroupedBars title="팀별 주식 가격" teams={teams} series={STOCK_SERIES} pricesKey="stockPrices" basePrices={DEFAULT_PRICES.stocks} />
      <GroupedBars title="팀별 부동산 가격" teams={teams} series={ESTATE_SERIES} pricesKey="realEstatePrices" basePrices={DEFAULT_PRICES.realEstate} />
    </div>
  )
}
