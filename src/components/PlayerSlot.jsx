import styles from './PlayerSlot.module.css'

export default function PlayerSlot({ player, isOwnPlayer, onNavigate }) {
  if (!player) {
    return (
      <div className={styles.slot}>
        <div className={styles.emptyImg} />
        <div className={styles.badgeEmpty}>대기 중...</div>
      </div>
    )
  }
  return (
    <div
      className={`${styles.slot} ${isOwnPlayer ? styles.clickable : ''}`}
      onClick={isOwnPlayer ? onNavigate : undefined}
    >
      <img
        src={`/characters/${player.character}.png`}
        alt={player.character}
        className={styles.img}
      />
      <div className={styles.badge}>
        <span className={styles.name}>{player.name}</span>
        {player.isHost && <span className={styles.host}>방장 ★</span>}
        {player.gameState?.isCompleted && <span className={styles.completed}>입력완료</span>}
      </div>
    </div>
  )
}
