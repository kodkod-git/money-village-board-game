import { ROOM_STATUS_LABELS } from '../constants/gameData'
import styles from './RoomCard.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

const MAX_PLAYERS = 4

// 제목: 관리자가 정한 이름 → 팀장 이름("OO님의 방") → 관리자 화면과 같은 "팀 N" 순으로 쓴다.
// 팀장이 없는 방(관리자가 만든 방)은 "???님의 방"이 아니라 관리자 화면과 같은 번호로 보여준다.
function roomLabel({ title, hostName, teamNumber }) {
  if (title) return title
  if (hostName) return `${hostName}님의 방`
  if (teamNumber) return `팀 ${teamNumber}`
  return '새 팀'
}

export default function RoomCard({ title, hostName, teamNumber, status, characters, onClick }) {
  const badgeClassKey = STATUS_BADGE_CLASS[status]
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => characters[i] ?? null)
  return (
    <button className={styles.card} onClick={onClick} type="button">
      {badgeClassKey && (
        <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
          {ROOM_STATUS_LABELS[status]}
        </span>
      )}
      <span className={styles.title}>{roomLabel({ title, hostName, teamNumber })}</span>
      <div className={styles.characters}>
        {slots.map((character, i) => (
          character ? (
            <img key={i} src={`/characters/${character}.png`} alt={character} className={styles.characterImg} />
          ) : (
            <span key={i} className={styles.emptySlot}>?</span>
          )
        ))}
      </div>
    </button>
  )
}
