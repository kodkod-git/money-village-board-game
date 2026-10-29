import { rankTeams, formatWon } from '../../../utils/clanRecap'
import styles from './RecapFinalSlide.module.css'

// 시상대는 가운데 1위, 왼쪽 2위, 오른쪽 3위. 순위는 총 자산 정렬 순서 그대로(동점이어도 앞선 팀이 높은 순위).
const PODIUM_ORDER = [1, 0, 2]
const MEDALS = ['🥇', '🥈', '🥉']

export default function RecapFinalSlide({ teams }) {
  const ranked = rankTeams(teams, 'totalAssets')
  const podium = PODIUM_ORDER.filter(i => ranked[i]).map(i => ({ team: ranked[i], rank: i + 1 }))
  const rest = ranked.slice(3)

  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>최종 순위</h2>
      <p className={styles.subtitle}>총 자산 기준</p>
      <div className={styles.podium}>
        {podium.map(({ team, rank }) => (
          <div key={team.id} className={`${styles.slot} ${styles[`rank${rank}`]}`} data-testid={`podium-${rank}`}>
            <span className={styles.medal} aria-hidden="true">{MEDALS[rank - 1]}</span>
            <span className={styles.name}>{team.name}</span>
            <span className={styles.value}>{formatWon(team.totalAssets)}</span>
            <div className={styles.block}>{rank}위</div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className={styles.rest}>
          {rest.map((team, i) => (
            <li key={team.id} className={styles.restRow} data-testid="recap-rest-row">
              <span className={styles.restRank}>{i + 4}위</span>
              <span className={styles.restName}>{team.name}</span>
              <span className={styles.restValue}>{formatWon(team.totalAssets)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
