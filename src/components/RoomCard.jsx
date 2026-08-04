import { ROOM_STATUS_LABELS } from '../constants/gameData'
import styles from './RoomCard.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

const MAX_PLAYERS = 4

export default function RoomCard({ hostName, status, playerCount, characters, onClick }) {
  const badgeClassKey = STATUS_BADGE_CLASS[status]
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => characters[i] ?? null)
  return (
    <button className={styles.card} onClick={onClick} type="button">
      {badgeClassKey && (
        <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
          {ROOM_STATUS_LABELS[status]}
        </span>
      )}
      <span className={styles.title}>{hostName ?? '???'}님의 방</span>
      <div className={styles.characters}>
        {slots.map((character, i) => (
          character ? (
            <img key={i} src={`/characters/${character}.png`} alt={character} className={styles.characterImg} />
          ) : (
            <span key={i} className={styles.emptySlot}>?</span>
          )
        ))}
      </div>
      <span className={styles.count}>{playerCount}/4</span>
    </button>
  )
}
