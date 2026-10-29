import { rankTeams, topTeams, formatWon } from '../../../utils/clanRecap'
import styles from './RecapCategorySlide.module.css'

const MAX_STEP_MS = 350
const TOTAL_STEP_MS = 2400
const FILL_MS = 500

// 한 가지 수치로 클랜을 비교하는 장. 맨 아래(꼴찌) 막대부터 차례로 차오르고,
// 1위 막대가 다 찬 뒤 위쪽에 1위 팀 이름이 떠오른다. 지연 시간은 CSS 변수 --delay로 넘긴다.
export default function RecapCategorySlide({ title, valueKey, teams }) {
  const ranked = rankTeams(teams, valueKey)
  const topValue = ranked[0]?.[valueKey] ?? 0
  const winners = topTeams(teams, valueKey).map(team => team.name)
  const step = Math.min(MAX_STEP_MS, TOTAL_STEP_MS / Math.max(ranked.length, 1))
  const delayOf = index => Math.round((ranked.length - 1 - index) * step)

  return (
    <div className={styles.slide} data-compact={ranked.length >= 8 ? 'true' : undefined}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.winner} data-testid="recap-winner" style={{ '--delay': `${delayOf(0) + FILL_MS}ms` }}>
        🏆 {winners.join(' · ')}
      </p>
      <ol className={styles.bars}>
        {ranked.map((team, index) => (
          <li key={team.id} className={styles.row} data-testid="recap-row" style={{ '--delay': `${delayOf(index)}ms` }}>
            <span className={styles.name}>{team.name}</span>
            <span className={styles.track}>
              <span
                className={styles.bar}
                data-testid="recap-bar"
                style={{
                  width: `${topValue > 0 ? (Math.max(0, team[valueKey]) / topValue) * 100 : 0}%`,
                  '--delay': `${delayOf(index)}ms`,
                }}
              />
            </span>
            <span className={styles.value}>{formatWon(team[valueKey])}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
