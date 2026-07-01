import styles from './AdminGridView.module.css'

export default function AdminGridView({ rooms, onSpectate }) {
  return (
    <div className={styles.grid}>
      {rooms.map(room => {
        const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)
        return (
          <button
            key={room.code}
            className={`${styles.card} ${room.registered ? styles.registered : ''}`}
            onClick={() => onSpectate(room)}
            type="button"
          >
            {room.registered && <span className={styles.badge}>등록 완료</span>}
            <div className={styles.slots}>
              {slots.map((player, i) => (
                <div key={i} className={styles.slot} data-testid="admin-player-slot">
                  {player ? (
                    <>
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
    </div>
  )
}
