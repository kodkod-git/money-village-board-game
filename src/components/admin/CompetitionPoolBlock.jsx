import { PLAYER_DRAG_TYPE } from '../../constants/competition'
import styles from './CompetitionPoolBlock.module.css'

function statusOf(player) {
  if (player.connected === false) return { label: '연결 끊김', className: styles.statusOff }
  if (player.gameState?.isCompleted) return { label: '입력 완료', className: styles.statusDone }
  return { label: '입력 중', className: styles.statusInput }
}

// 경쟁 모드 팀 현황 페이지: QR로 들어왔지만 아직 팀에 배정되지 않은 참여자.
// 카드를 팀 카드로 끌어 배정하고, 팀의 플레이어를 여기로 끌어오면 배정을 취소한다.
export default function CompetitionPoolBlock({ players, onAssign, onDelete }) {
  function handleDrop(e) {
    e.preventDefault()
    const playerUuid = e.dataTransfer.getData(PLAYER_DRAG_TYPE)
    if (!playerUuid || players.some(p => p.playerUuid === playerUuid)) return
    onAssign(playerUuid, null)
  }

  return (
    <section className={styles.block} aria-label="참여자" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <div className={styles.header}>
        <h2 className={styles.title}>참여자</h2>
        <span className={styles.count}>{players.length}명 대기 중</span>
        <span className={styles.hint}>팀 카드로 끌어다 놓아 배정하세요</span>
      </div>
      {players.length === 0 ? (
        <p className={styles.empty}>QR로 들어온 참여자가 여기에 표시돼요</p>
      ) : (
        <ul className={styles.list}>
          {players.map(player => {
            const status = statusOf(player)
            return (
              <li
                key={player.playerUuid}
                className={styles.item}
                draggable
                onDragStart={e => e.dataTransfer.setData(PLAYER_DRAG_TYPE, player.playerUuid)}
              >
                <img src={`/characters/${player.character}.png`} alt={player.name} className={styles.avatar} />
                <span className={styles.name}>{player.name}</span>
                <span className={`${styles.status} ${status.className}`}>{status.label}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={`${player.name} 삭제`}
                  onClick={() => onDelete(player)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
