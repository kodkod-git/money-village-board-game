import { formatWon } from '../../../utils/clanRecap'
import styles from './RecapVersusSlide.module.css'

const TEAM_COLORS = ['#1d5fc4', '#c62a3c', '#0f7d57', '#6a35c0', '#a8560a', '#0b6f8a', '#b02a6e', '#4b5563']

// 2~4팀은 대각선으로 나눈 대결 구도, 그 밖에는 줄로 쌓는다.
function layoutOf(teamCount) {
  if (teamCount === 2) return 'duel'
  if (teamCount === 3) return 'triple'
  if (teamCount === 4) return 'quad'
  return 'list'
}

// 팀원이 많을수록, 팀 칸이 좁을수록 캐릭터를 작게 그린다.
function avatarSizeFor(memberCount, layout) {
  if (layout === 'list') return memberCount <= 6 ? 8 : 5
  const wide = layout === 'duel'
  if (memberCount <= 4) return wide ? 24 : 18
  if (memberCount <= 6) return wide ? 21 : 14
  if (memberCount <= 10) return wide ? 15 : 10
  return wide ? 11 : 7
}

// 2-9: 팀별 총 자산. 아직 승자를 강조하지 않고 클랜 순서대로 맞세운다.
export default function RecapVersusSlide({ teams }) {
  const layout = layoutOf(teams.length)

  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>다음은 팀(클랜)별 총 자산 합산 결과입니다!</h2>
      <div className={`${styles.arena} ${styles[layout]}`} data-testid="recap-arena" data-layout={layout}>
        {teams.map((team, i) => (
          <section
            key={team.id}
            className={styles.panel}
            style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] }}
            data-testid="recap-team"
          >
            <div className={styles.body}>
              <h3 className={styles.teamName}>{team.name}</h3>
              <p className={styles.total}>{formatWon(team.totalAssets)}</p>
              <ul className={styles.crowd} style={{ '--size': `${avatarSizeFor(team.members.length, layout)}cqw` }}>
                {team.members.map((member, j) => (
                  <li key={member.id} className={styles.member} style={{ '--delay': `${Math.min(j * 70, 700)}ms` }}>
                    <img src={`/characters/${member.character}.png`} alt={member.name} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
        {layout !== 'list' && <span className={styles.vs} aria-hidden="true">VS</span>}
      </div>
    </div>
  )
}
