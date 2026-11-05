import styles from './RecapCastSlide.module.css'

// 인원이 많을수록 작게 — 모두 한 화면에 들어오도록 카드 폭 대비 크기를 정한다.
function sizeFor(count) {
  if (count <= 4) return 36
  if (count <= 6) return 30
  if (count <= 9) return 26
  if (count <= 16) return 20
  return 14
}

// 참여한 캐릭터가 아래쪽에 차례로 등장하는 장.
export default function RecapCastSlide({ title, players }) {
  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.cast} style={{ '--size': `${sizeFor(players.length)}cqw` }}>
        {players.map((player, i) => (
          <li key={player.id} className={styles.member} style={{ '--delay': `${Math.min(i * 90, 1200)}ms` }}>
            <img src={`/characters/${player.character}.png`} alt="" className={styles.avatar} />
            <span className={styles.name}>{player.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
