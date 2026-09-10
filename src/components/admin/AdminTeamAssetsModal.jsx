import { useEffect } from 'react'
import PlayerAssetReceipt from './PlayerAssetReceipt'
import styles from './AdminTeamAssetsModal.module.css'

export default function AdminTeamAssetsModal({ room, prices, teamLabel, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const players = (room.players ?? []).filter(Boolean)

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${teamLabel} 팀원 자산 상세`}
    >
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{teamLabel} · 팀원 자산 상세</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="자세히 보기 닫기">✕</button>
        </div>

        {players.length === 0 ? (
          <div className={styles.empty}>표시할 팀원이 없습니다</div>
        ) : (
          <div className={styles.strip}>
            {players.map(player => (
              <PlayerAssetReceipt key={player.playerUuid} player={player} prices={prices} />
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.footerCloseBtn} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
