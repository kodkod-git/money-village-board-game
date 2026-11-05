import styles from './RecapIntroSlide.module.css'

export default function RecapIntroSlide({ className, teams, gameCount }) {
  return (
    <div className={styles.slide}>
      <span className={styles.trophy} aria-hidden="true">🏆</span>
      <h2 className={styles.title}>{className} 팀 대결 결과</h2>
      <p className={styles.summary}>{teams.length}개 팀(클랜) 인원이 나뉘어져 {gameCount}개의 게임을 진행했어요.</p>
      <ul className={styles.teams}>
        {teams.map(team => (
          <li key={team.id} className={styles.team}>{team.name} · {team.memberCount}명</li>
        ))}
      </ul>
      <p className={styles.hint}>오른쪽으로 넘겨 결과를 확인하세요 ›</p>
    </div>
  )
}
