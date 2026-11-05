import RecapCelebration from './RecapCelebration'
import styles from './RecapSpotlightSlide.module.css'

// 1등(또는 공동 1등)이 많을수록 작게.
function winnerSizeFor(count) {
  if (count === 1) return 58
  if (count === 2) return 42
  if (count <= 4) return 32
  if (count <= 9) return 26
  return 18
}

function otherSizeFor(count) {
  if (count <= 3) return 22
  if (count <= 6) return 18
  return 13
}

// 1등을 크게 보여 주는 장. 위쪽은 화사한 빛, 나머지 참여자가 있으면 아래쪽은 우울한 배경.
// celebrate면 커튼이 걷히고 빵빠레가 터진다. hideTitleUntilReveal은 제목이 결과를 말해 버리는 장에 쓴다.
export default function RecapSpotlightSlide({ title, winners, caption, others = [], celebrate = false, hideTitleUntilReveal = false }) {
  return (
    <div className={styles.slide} data-celebrate={celebrate ? 'true' : undefined}>
      <div className={styles.rays} aria-hidden="true" />
      {celebrate && <RecapCelebration />}
      <h2 className={`${styles.title} ${hideTitleUntilReveal ? styles.titleLate : ''}`}>{title}</h2>
      <div className={styles.stage}>
        <ul className={styles.winners} style={{ '--size': `${winnerSizeFor(winners.length)}cqw` }}>
          {winners.map(winner => (
            <li key={winner.id} className={styles.winner} data-testid="recap-winner">
              <img src={`/characters/${winner.character}.png`} alt="" className={styles.winnerImage} />
              <span className={styles.winnerName}>{winner.name}</span>
            </li>
          ))}
        </ul>
        {caption && <p className={styles.caption}>{caption}</p>}
      </div>
      {others.length > 0 && (
        <ul className={styles.others} style={{ '--size': `${otherSizeFor(others.length)}cqw` }}>
          {others.map(other => (
            <li key={other.id} className={styles.other} data-testid="recap-other">
              <img src={`/characters/${other.character}.png`} alt="" className={styles.otherImage} />
              <span className={styles.otherName}>{other.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
