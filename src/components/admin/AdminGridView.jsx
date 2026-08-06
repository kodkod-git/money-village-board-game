import { ROOM_STATUS_LABELS } from '../../constants/gameData'
import styles from './AdminGridView.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

export default function AdminGridView({ rooms, onSpectate, onCreate }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => {
        const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)
        const badgeClassKey = !room.registered ? STATUS_BADGE_CLASS[room.status] : undefined
        return (
          <button
            key={room.code}
            className={`${styles.card} ${room.registered ? styles.registered : ''}`}
            onClick={() => onSpectate(room)}
            type="button"
          >
            <span className={styles.codeBadge}>{room.code}</span>
            {room.registered && <span className={styles.badge}>등록 완료</span>}
            {badgeClassKey && (
              <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
                {ROOM_STATUS_LABELS[room.status]}
              </span>
            )}
            <div className={styles.slots}>
              {slots.map((player, i) => (
                <div key={i} className={styles.slot} data-testid="admin-player-slot">
                  {player ? (
                    <>
                      {player.connected === false && (
                        <span className={styles.disconnectedBadge}>연결 끊김</span>
                      )}
                      <img
                        src={`/characters/${player.character}.png`}
                        alt={player.name}
                        className={styles.slotImg}
                      />
                      <span className={styles.slotName}>{player.name}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.slotEmpty}>?</span>
                      <span className={styles.emptyName}>대기중</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </button>
        )
      })}
      {onCreate && (
        <button className={styles.createCard} onClick={onCreate} type="button">
          <span className={styles.createIcon} aria-hidden="true">+</span>
          <span className={styles.createLabel}>방 만들기</span>
        </button>
      )}
    </div>
  )
}
