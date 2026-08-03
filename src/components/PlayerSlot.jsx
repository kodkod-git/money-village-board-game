import styles from './PlayerSlot.module.css'

export default function PlayerSlot({ player, onKick, onEdit }) {
  if (!player) {
    return (
      <div className={styles.slot}>
        <div className={styles.emptyAvatar}>?</div>
        <span className={styles.emptyLabel}>대기중</span>
      </div>
    )
  }

  function handleKeyDown(e) {
    if (!onEdit) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onEdit()
    }
  }

  return (
    <div
      className={`${styles.slot} ${onEdit ? styles.clickable : ''}`}
      onClick={onEdit}
      onKeyDown={handleKeyDown}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
    >
      {player.gameState?.isCompleted && (
        <span className={styles.completedIcon} aria-label="입력완료">✓</span>
      )}
      {onEdit && <span className={styles.editIcon} aria-hidden="true">✎</span>}
      {player.connected === false && (
        <span className={styles.disconnectedBadge}>연결 끊김</span>
      )}
      <img
        src={`/characters/${player.character}.png`}
        alt={player.character}
        className={styles.img}
      />
      <span className={styles.name}>{player.name}</span>
      {onKick && (
        <button
          className={styles.kickBtn}
          onClick={e => { e.stopPropagation(); onKick() }}
          aria-label="추방"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  )
}
