import styles from './TeamStatSlide.module.css'

// 경쟁 모드 결과 화면: 한 가지 수치(valueKey)로 같은 수업의 팀들을 가로 막대그래프로 비교한다.
// 값이 큰 팀부터 놓고(동점이면 팀 순서), 막대 길이는 1위 값을 기준으로 정한다.
export default function TeamStatSlide({ title, valueKey, teams, mySessionId }) {
  const sorted = [...teams].sort((a, b) => b[valueKey] - a[valueKey])
  const top = sorted[0]?.[valueKey] ?? 0
  const winners = sorted.filter(team => team[valueKey] === top).map(team => team.name)

  return (
    <section className={styles.slide} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.winner}>🏆 {winners.join(' · ')}</p>
      <ol className={styles.bars}>
        {sorted.map(team => {
          const value = team[valueKey]
          const mine = team.sessionId === mySessionId
          return (
            <li
              key={team.sessionId}
              className={`${styles.row} ${mine ? styles.mine : ''}`}
              data-testid="team-stat-row"
              data-mine={mine ? 'true' : undefined}
            >
              <span className={styles.name} data-testid="team-stat-name">
                {team.name}
                {mine && <span className={styles.myTag}>우리 팀</span>}
              </span>
              <span className={styles.track}>
                <span
                  className={styles.bar}
                  data-testid="team-stat-bar"
                  style={{ width: `${top > 0 ? (value / top) * 100 : 0}%` }}
                />
              </span>
              <span className={styles.value}>{value.toLocaleString('ko-KR')}원</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
