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

// 시작 가격 대비 등락률(%). 0%면 시작가 그대로.
export function changeRate(price, base) {
  return ((price - base) / base) * 100
}

// 0%를 반드시 포함하고, 눈금 간격을 1·2·5 단위의 보기 좋은 값으로 맞춘 축 범위.
export function niceRange(values) {
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const raw = (hi - lo) / TICK_COUNT || 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].find(n => n * magnitude >= raw) * magnitude
  const min = Math.floor(lo / step) * step
  const max = Math.max(Math.ceil(hi / step) * step, min + step)
  const ticks = []
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 100) / 100)
  return { min, max, ticks }
}

function formatRate(rate) {
  const rounded = Math.round(rate)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function formatPriceAxis(value) {
  if (value >= 10000) return `${(value / 10000).toLocaleString('ko-KR')}만`
  return value.toLocaleString('ko-KR')
}

// price: 게임 종료 시점 가격(원), rate: 시작 가격 대비 등락률(%)
const METRICS = {
  price: { hint: () => '게임 종료 시점 가격', axis: formatPriceAxis, label: formatWon },
  rate: { hint: base => `시작 가격(${formatWon(base)}) 대비 등락률`, axis: formatRate, label: formatRate },
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

// 막대는 0 선에서 위·아래로 뻗는다 — 등락률이면 위가 상승, 아래가 하락. 색은 종목을 나타낸다.
function GroupedBars({ title, teams: allTeams, series, pricesKey, basePrices, metric }) {
  // 가격 기록이 없는 옛 결과는 0원·0%로 오해되지 않게 빼고 그린다.
  const teams = allTeams.filter(team => series.some(s => team[pricesKey][s.key] != null))
  if (teams.length === 0) return null

  const format = METRICS[metric]
  const prices = teams.map(team => series.map(s => Number(team[pricesKey][s.key] ?? basePrices[s.key])))
  const rates = prices.map(row => row.map((price, j) => changeRate(price, basePrices[series[j].key])))
  const values = metric === 'rate' ? rates : prices
  const { min, max, ticks } = niceRange(values.flat())
  const position = value => ((value - min) / (max - min)) * 100
  const zero = position(0)
  const barWidth = barWidthFor(teams.length)

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <span className={styles.chartHint}>
          {format.hint(basePrices[series[0].key])} · 팀 {teams.length}개
        </span>
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
          {ticks.map(t => <span key={t} style={{ bottom: `${position(t)}%` }}>{format.axis(t)}</span>)}
        </div>
        <div className={styles.plotArea}>
          <div className={styles.gridLines} aria-hidden="true">
            {ticks.map(t => <span key={t} className={t === 0 ? styles.zeroLine : undefined} style={{ bottom: `${position(t)}%` }} />)}
          </div>
          <div
            className={styles.groups}
            role="img"
            aria-label={`${title}: ${teams.map((team, i) =>
              `${team.name} ${series.map((s, j) => `${s.label} ${format.label(values[i][j])}`).join(', ')}`
            ).join(' / ')}`}
          >
            {teams.map((team, i) => (
              <div key={team.id} className={styles.group}>
                {series.map((s, j) => {
                  const value = values[i][j]
                  const end = position(value)
                  return (
                    <div key={s.key} className={styles.slot} style={{ width: barWidth }}>
                      <div
                        className={`${styles.bar} ${value < 0 ? styles.barDown : ''}`}
                        style={{ bottom: `${Math.min(end, zero)}%`, height: `${Math.abs(end - zero)}%`, background: s.color }}
                      />
                      <span className={styles.tooltip} role="tooltip" style={{ bottom: `${Math.max(end, zero)}%` }}>
                        <strong>{team.name}</strong> {s.label} {format.label(value)}
                        <small>
                          {formatWon(basePrices[s.key])} → {formatWon(prices[i][j])} ({formatRate(rates[i][j])})
                        </small>
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

// 팀 현황(수업 대시보드) 유형 분포 탭 아래에 팀별 최종 주가·부동산 가격과, 시작가 대비 등락률을 보여 준다.
// 위 줄은 가격, 아래 줄은 같은 종목의 등락률이라 화면이 넓으면 주식·부동산이 좌우로 짝지어진다.
export default function TeamPriceCharts({ rows }) {
  const teams = useMemo(() => teamPrices(rows), [rows])
  if (teams.length === 0) return null

  const stocks = { teams, series: STOCK_SERIES, pricesKey: 'stockPrices', basePrices: DEFAULT_PRICES.stocks }
  const estates = { teams, series: ESTATE_SERIES, pricesKey: 'realEstatePrices', basePrices: DEFAULT_PRICES.realEstate }

  return (
    <div className={styles.charts}>
      <GroupedBars title="팀별 주식 가격" metric="price" {...stocks} />
      <GroupedBars title="팀별 부동산 가격" metric="price" {...estates} />
      <GroupedBars title="팀별 주식 가격 등락" metric="rate" {...stocks} />
      <GroupedBars title="팀별 부동산 가격 등락" metric="rate" {...estates} />
    </div>
  )
}
