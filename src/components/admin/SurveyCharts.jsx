import { useState } from 'react'
import { RESULT_GROUPS } from '../../constants/quizData'
import styles from './SurveyCharts.module.css'

const DONUT_SIZE = 200
const DONUT_STROKE = 32
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS
// 인접 조각 사이를 표면색으로 띄워 색만으로 구분하지 않게 한다.
const SEGMENT_GAP = 2

function percent(ratio) {
  return `${(ratio * 100).toFixed(1)}%`
}

// groups: countByGroup() 결과
export function GroupDonutChart({ groups }) {
  const [hovered, setHovered] = useState(null)
  const total = groups.reduce((sum, g) => sum + g.count, 0)
  const visible = groups.filter(g => g.count > 0)
  const gap = visible.length > 1 ? SEGMENT_GAP : 0
  const active = groups.find(g => g.group === hovered)

  let offset = 0
  const segments = visible.map(g => {
    const length = g.ratio * DONUT_CIRCUMFERENCE
    const segment = { ...g, dash: Math.max(length - gap, 0.01), offset }
    offset += length
    return segment
  })

  return (
    <div className={styles.donutLayout}>
      <div className={styles.donutWrap}>
        <svg
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          className={styles.donut}
          role="img"
          aria-label={`그룹별 응답 수: ${groups.map(g => `${g.group} ${g.count}명`).join(', ')}`}
        >
          <circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_RADIUS}
            fill="none"
            stroke="var(--admin-bg)"
            strokeWidth={DONUT_STROKE}
          />
          <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
            {segments.map(s => (
              <circle
                key={s.group}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={hovered === s.group ? DONUT_STROKE + 6 : DONUT_STROKE}
                strokeDasharray={`${s.dash} ${DONUT_CIRCUMFERENCE - s.dash}`}
                strokeDashoffset={-s.offset}
                className={styles.segment}
                onMouseEnter={() => setHovered(s.group)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </g>
        </svg>
        <div className={styles.donutCenter} aria-hidden="true">
          <span className={styles.donutValue}>{active ? active.count : total}명</span>
          <span className={styles.donutCaption}>{active ? `${active.group} · ${percent(active.ratio)}` : '전체 응답'}</span>
        </div>
      </div>

      <ul className={styles.legend}>
        {groups.map(g => (
          <li
            key={g.group}
            className={`${styles.legendItem} ${hovered === g.group ? styles.legendItemActive : ''}`}
            onMouseEnter={() => setHovered(g.group)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className={styles.swatch} style={{ background: g.color }} aria-hidden="true" />
            <div className={styles.legendText}>
              <span className={styles.legendName}>{g.group}</span>
              <span className={styles.legendSub}>{g.tagline}</span>
            </div>
            <span className={styles.legendCount}>{g.count}명</span>
            <span className={styles.legendRatio}>{percent(g.ratio)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// types: countByType() 결과
export function TypeHistogram({ types }) {
  const [hovered, setHovered] = useState(null)
  const max = Math.max(1, ...types.map(t => t.count))

  return (
    <div className={styles.histogram}>
      <div className={styles.barsScroll}>
        <div className={styles.bars} role="img" aria-label={`EFTI 유형별 응답 수: ${types.map(t => `${t.type} ${t.count}명`).join(', ')}`}>
          {types.map((t, i) => (
            <div
              key={t.type}
              className={styles.barColumn}
              onMouseEnter={() => setHovered(t.type)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === t.type && (
                <div className={`${styles.tooltip} ${i < 3 ? styles.tooltipStart : i >= types.length - 3 ? styles.tooltipEnd : ''}`}>
                  <strong>{t.type} · {t.title}</strong>
                  <span>{t.animal} · {t.group}</span>
                  <span>{t.count}명</span>
                </div>
              )}
              {/* 0명 유형까지 숫자를 달면 막대보다 숫자가 먼저 읽히므로 값이 있는 막대에만 단다 */}
              <span className={styles.barCount}>{t.count > 0 && t.count}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ height: `${(t.count / max) * 100}%`, background: t.color, opacity: hovered && hovered !== t.type ? 0.45 : 1 }}
                />
              </div>
              <span className={styles.barLabel}>{t.type}</span>
              <span className={styles.barSub}>{t.animal}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className={styles.groupLegend}>
        {Object.entries(RESULT_GROUPS).map(([group, meta]) => (
          <li key={group} className={styles.groupLegendItem}>
            <span className={styles.swatch} style={{ background: meta.color }} aria-hidden="true" />
            {group}
          </li>
        ))}
      </ul>
    </div>
  )
}

// y축 눈금: 정수 건수라 0부터 4칸 이내로 나눈다.
function countTicks(max) {
  if (max <= 4) return Array.from({ length: Math.max(max, 1) + 1 }, (_, i) => i)
  const step = Math.ceil(max / 4)
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

// days: countByDay() 결과, valueKey: 막대로 그릴 값(현재는 completed만 수집)
export function DailyBarChart({ days, valueKey, label, color = 'var(--admin-blue)' }) {
  const [hovered, setHovered] = useState(null)
  const ticks = countTicks(Math.max(0, ...days.map(d => d[valueKey])))
  const top = ticks.at(-1)
  // x축 라벨이 겹치지 않도록 최대 10개 정도만 단다.
  const labelEvery = Math.ceil(days.length / 10)
  const total = days.reduce((sum, d) => sum + d[valueKey], 0)

  return (
    <div className={styles.daily}>
      <div className={styles.dailyPlot}>
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{t}</span>)}
        </div>
        <div className={styles.dailyArea}>
          <div className={styles.gridLines} aria-hidden="true">
            {ticks.map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }} />)}
          </div>
          <div
            className={styles.dailyBars}
            role="img"
            aria-label={`일자별 ${label}: ${days.filter(d => d[valueKey] > 0).map(d => `${d.date} ${d[valueKey]}건`).join(', ') || '없음'}`}
          >
            {days.map((d, i) => (
              <div
                key={d.date}
                className={styles.dailyColumn}
                onMouseEnter={() => setHovered(d.date)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === d.date && (
                  <div className={`${styles.tooltip} ${i < 3 ? styles.tooltipStart : i >= days.length - 3 ? styles.tooltipEnd : ''}`}>
                    <strong>{d.date}</strong>
                    <span>{label} {d[valueKey]}건</span>
                  </div>
                )}
                <div
                  className={styles.dailyBar}
                  style={{ height: `${(d[valueKey] / top) * 100}%`, background: color, opacity: hovered && hovered !== d.date ? 0.45 : 1 }}
                />
              </div>
            ))}
          </div>
          <div className={styles.xAxis} aria-hidden="true">
            {days.map((d, i) => (
              <span key={d.date}>{i % labelEvery === 0 || i === days.length - 1 ? d.date.slice(5) : ''}</span>
            ))}
          </div>
        </div>
      </div>
      <p className={styles.dailySummary}>기간 합계 {label} <strong>{total}건</strong> · 일 평균 {(total / days.length).toFixed(1)}건</p>
    </div>
  )
}
