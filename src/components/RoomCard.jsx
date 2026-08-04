import { ROOM_STATUS_LABELS } from '../constants/gameData'
import styles from './RoomCard.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

export default function RoomCard({ code, status, playerCount, characters, onClick }) {
  const badgeClassKey = STATUS_BADGE_CLASS[status]
  return (
    <button className={styles.card} onClick={onClick} type="button">
      {badgeClassKey && (
        <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
          {ROOM_STATUS_LABELS[status]}
        </span>
      )}
      <span className={styles.title}>{code}</span>
      <div className={styles.characters}>
        {characters.map((character, i) => (
          <img key={i} src={`/characters/${character}.png`} alt={character} className={styles.characterImg} />
        ))}
      </div>
      <span className={styles.count}>{playerCount}/4</span>
    </button>
  )
}
