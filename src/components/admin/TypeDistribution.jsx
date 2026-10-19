import { useMemo, useState } from 'react'
import { RESULT_GROUPS } from '../../constants/quizData'
import {
  calcEconomicPotential, FUTURE_INVEST_RATIO, RISKY_CONCENTRATION_RATIO,
} from '../../utils/economicPotential'
import styles from './TypeDistribution.module.css'

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

function percent(ratio) {
  return `${Math.round(ratio * 100)}%`
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

function DistributionBars({ counts, total, scopeLabel }) {
  // 막대 높이는 전체 인원을 기준으로 고정해, 기준값을 바꾸면 막대가 실제로 늘고 줄어 보이게 한다.
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>경제적 잠재력 유형 분포</h2>
        <span className={styles.chartHint}>게임 결과 기준 · {scopeLabel} {total}명</span>
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
  )
}

// 기준값이 항상 축의 가운데(50%)에 오도록 0~기준값을 앞쪽 절반, 기준값~100%를 뒤쪽 절반에 나눠 그린다.
// 그래서 축 눈금 간격은 양쪽이 서로 다를 수 있다.
function centerOnThreshold(value, threshold) {
  if (value <= threshold) return threshold > 0 ? (value / threshold) * 0.5 : 0.5
  return 0.5 + ((value - threshold) / (1 - threshold)) * 0.5
}

// 0%·100%에 놓인 캐릭터가 사분면 밖으로 넘치지 않게 축을 -10%~110%로 넓혀 그린다(가운데는 그대로 50%).
const AXIS_MARGIN = 0.1

function withMargin(position) {
  return (position + AXIS_MARGIN) / (1 + AXIS_MARGIN * 2)
}

// 같은 자리에 겹치는 참가자는 해바라기 모양으로 살짝 흩어 놓는다(좌표 의미는 유지).
const DEFAULT_AVATAR_SIZE = 30

// 인원이 적은 화면(팀 현황)에서는 사분면이 비어 보이지 않게 인원에 반비례해 아이콘을 키운다.
// 좌표가 조금 겹쳐도 알아보기 쉬운 쪽을 택했다.
function largeAvatarSize(count) {
  return Math.max(44, Math.min(70, Math.round(400 / Math.sqrt(Math.max(count, 1)))))
}

function spreadOffsets(points, avatarSize) {
  const clusters = new Map()
  return points.map(point => {
    const key = `${Math.round(point.x * 50)}-${Math.round(point.y * 50)}`
    const index = clusters.get(key) ?? 0
    clusters.set(key, index + 1)
    if (index === 0) return { ...point, dx: 0, dy: 0 }
    const angle = index * 2.4
    const radius = avatarSize * 0.55 * Math.sqrt(index)
    return { ...point, dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius }
  })
}

// 가로축 = 순자산 중 투자 비율(오른쪽이 미래형), 세로축 = 투자 금액 중 한 종목 비중(위쪽이 위험형).
// 사분면 경계(가운데 선)는 늘 슬라이더 기준값이고, 기준값을 바꾸면 참가자 위치가 움직인다.
function TypeQuadrant({ rows, results, future, risky, counts, largePoints }) {
  // 캐릭터를 그룹 색 테두리 원에 담아 볼지, 캐릭터 그림만 볼지 비교용 토글. 기본은 원 표시.
  const [showRing, setShowRing] = useState(true)
  const avatarSize = largePoints ? largeAvatarSize(rows.length) : DEFAULT_AVATAR_SIZE
  // 가장자리(0%·100%)의 캐릭터가 카드 밖으로 나가지 않게 아이콘 크기만큼 위·오른쪽 여유를 둔다.
  const edge = Math.max(32, Math.round(avatarSize / 2) + 8)
  const points = useMemo(
    () => spreadOffsets(rows.map((row, i) => {
      const { investRatio, topAssetRatio } = results[i].investment
      return {
        row,
        group: results[i].group,
        investRatio,
        topAssetRatio,
        x: withMargin(centerOnThreshold(investRatio, future / 100)),
        y: withMargin(centerOnThreshold(topAssetRatio, risky / 100)),
      }
    }), avatarSize),
    [rows, results, future, risky, avatarSize]
  )

  const regions = [
    { group: 'Red Group', style: { left: 0, top: 0, width: '50%', height: '50%' }, corner: 'topLeft' },
    { group: 'Blue Group', style: { right: 0, top: 0, width: '50%', height: '50%' }, corner: 'topRight' },
    { group: 'Green Group', style: { left: 0, bottom: 0, width: '50%', height: '50%' }, corner: 'bottomLeft' },
    { group: 'Orange Group', style: { right: 0, bottom: 0, width: '50%', height: '50%' }, corner: 'bottomRight' },
  ]
  const ticks = threshold => [
    { value: 0, at: withMargin(0) * 100 },
    { value: threshold, at: 50 },
    { value: 100, at: withMargin(1) * 100 },
  ]

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>유형 사분면</h2>
        <span className={styles.chartHint}>가로 · 순자산 중 투자 비율 / 세로 · 투자 금액 중 한 종목 비중</span>
        <button
          type="button"
          className={styles.ringToggle}
          aria-pressed={showRing}
          onClick={() => setShowRing(v => !v)}
        >
          원 표시 {showRing ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className={styles.quadrantWrap} style={{ paddingTop: edge, paddingRight: edge }}>
        <div className={styles.quadrantYAxis} aria-hidden="true">
          <span className={styles.axisTitleY}>한 종목 비중 →</span>
          {ticks(risky).map(t => <span key={t.at} className={styles.yTick} style={{ bottom: `${t.at}%` }}>{t.value}%</span>)}
        </div>
        <div
          className={styles.quadrant}
          role="group"
          aria-label="유형 사분면"
          style={{ '--avatar-size': `${avatarSize}px`, '--name-size': `${Math.max(10, Math.round(avatarSize * 0.2))}px` }}
        >
          {regions.map(({ group, style, corner }) => (
            <div key={group} className={styles.region} style={style}>
              <span className={styles.regionFill} style={{ background: RESULT_GROUPS[group].color }} />
              <span className={`${styles.regionLabel} ${styles[corner]}`} style={{ color: RESULT_GROUPS[group].color }}>
                {group} <small>{GROUP_AXES[group]} · {counts[group]}명</small>
              </span>
            </div>
          ))}
          <span className={styles.divider} style={{ left: '50%', top: 0, bottom: 0, width: 0 }} aria-hidden="true" />
          <span className={styles.divider} style={{ bottom: '50%', left: 0, right: 0, height: 0 }} aria-hidden="true" />
          {points.map(({ row, group, investRatio, topAssetRatio, x, y, dx, dy }) => (
            <div
              key={`${row.sessionId}-${row.playerUuid}`}
              className={styles.point}
              style={{
                left: `${x * 100}%`,
                bottom: `${y * 100}%`,
                transform: `translate(calc(-50% + ${dx}px), calc(50% + ${dy}px))`,
              }}
              title={`${row.name} · ${group} · 투자 ${percent(investRatio)} · 한 종목 ${percent(topAssetRatio)}`}
            >
              {row.character ? (
                <img
                  src={`/characters/${row.character}.png`}
                  alt=""
                  className={showRing ? styles.pointAvatar : styles.pointCharacter}
                  style={showRing ? { borderColor: RESULT_GROUPS[group].color } : undefined}
                />
              ) : (
                // 캐릭터가 없으면 원 표시와 상관없이 그룹 색 원으로 자리를 표시한다.
                <span className={styles.pointAvatar} style={{ borderColor: RESULT_GROUPS[group].color }} />
              )}
              <span className={styles.pointName}>{row.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.quadrantXAxis} style={{ marginRight: edge }} aria-hidden="true">
        {ticks(future).map(t => <span key={t.at} className={styles.xTick} style={{ left: `${t.at}%` }}>{t.value}%</span>)}
        <span className={styles.axisTitleX}>투자 비율 →</span>
      </div>
    </div>
  )
}

// 게임 결과(보유 자산)로 계산한 유형만 쓴다 — 경제적 잠재력 "테스트" 응답은 섞지 않는다.
// scopeLabel: 차트 설명에 붙는 집단 이름(예: "전체", "수업").
// largePoints: 사분면 캐릭터·이름을 인원에 맞춰 크게 그린다(팀 현황처럼 인원이 적은 화면용).
export default function TypeDistribution({ rows, scopeLabel = '전체', largePoints = false }) {
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

      {/* 화면이 넓으면 두 카드를 한 줄에, 좁으면 위아래로 놓는다 */}
      <div className={styles.charts}>
        <DistributionBars counts={counts} total={total} scopeLabel={scopeLabel} />
        <TypeQuadrant rows={rows} results={results} future={future} risky={risky} counts={counts} largePoints={largePoints} />
      </div>
    </div>
  )
}
