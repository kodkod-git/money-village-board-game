import { formatWon } from '../../../utils/clanRecap'
import styles from './RecapPriceSlide.module.css'

// 색은 게임을 따라간다 — 어느 차트에서든 같은 게임은 같은 색. 어두운 차트 면(#14161f) 기준으로 검증한 순서다.
// 게임이 8개를 넘으면 새 색을 만들지 않고 회색으로 둔다(막대마다 게임 이름이 붙어 있어 구분된다).
const GAME_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const OVERFLOW_COLOR = '#7b8090'

// 2-7, 2-8: 같은 종목끼리 게임별 가격을 비교한다. 세 차트는 같은 축(maxPrice)을 쓴다.
export default function RecapPriceSlide({ comparison }) {
  const { title, charts, maxPrice } = comparison
  const barCount = charts[0].bars.length

  return (
    <div className={styles.slide} data-compact={barCount >= 5 ? 'true' : undefined}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.charts}>
        {charts.map(chart => (
          <section
            key={chart.key}
            className={styles.chart}
            role="img"
            aria-label={`${chart.label}: ${chart.bars.map(bar =>
              `${bar.gameName} ${formatWon(bar.price)}${bar.isTop ? '(그 게임 최고가)' : ''}`
            ).join(', ')}`}
          >
            <header className={styles.chartHeader}>
              <img src={chart.image} alt="" className={styles.icon} />
              <h3 className={styles.chartTitle}>{chart.label}</h3>
            </header>
            <ul className={styles.rows}>
              {chart.bars.map(bar => (
                <li key={bar.gameId} className={styles.row}>
                  <span className={styles.gameName}>{bar.gameName}</span>
                  <span className={styles.track}>
                    <span
                      className={styles.bar}
                      data-testid="recap-price-bar"
                      style={{
                        width: `${maxPrice > 0 ? (bar.price / maxPrice) * 100 : 0}%`,
                        background: GAME_COLORS[bar.colorIndex] ?? OVERFLOW_COLOR,
                      }}
                    />
                  </span>
                  <span className={styles.value}>
                    {bar.isTop && <span aria-hidden="true">👑 </span>}
                    {formatWon(bar.price)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className={styles.note}>👑 그 게임에서 가장 비싼 종목 · 게임 종료 시점 가격</p>
    </div>
  )
}
