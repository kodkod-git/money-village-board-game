import styles from './PlayerSlot.module.css'

export default function PlayerSlot({ player, onKick }) {
  if (!player) {
    return (
      <div className={styles.slot}>
        <div className={styles.emptyAvatar}>?</div>
        <span className={styles.emptyLabel}>대기중</span>
      </div>
    )
  }
  return (
    <div className={styles.slot}>
      <img
        src={`/characters/${player.character}.png`}
        alt={player.character}
        className={styles.img}
      />
      <span className={styles.name}>{player.name}</span>
      {player.isHost && <span className={styles.host}>방장 ★</span>}
      {player.gameState?.isCompleted && <span className={styles.completed}>입력완료</span>}
      {onKick && (
        <button
          className={styles.kickBtn}
          onClick={e => { e.stopPropagation(); onKick() }}
          aria-label="추방"
        >
          ✕
        </button>
      )}
    </div>
  )
}
