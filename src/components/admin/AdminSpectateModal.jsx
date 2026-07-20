import { useState, useEffect, useRef } from 'react'
import AdminPlayerCard from './AdminPlayerCard'
import AdminEditModal from './AdminEditModal'
import styles from './AdminSpectateModal.module.css'

const POLL_INTERVAL_MS = 3000

export default function AdminSpectateModal({ rooms, initialIndex, onPlayerUpdate, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const [editingPlayerUuid, setEditingPlayerUuid] = useState(null)
  const room = rooms[index]
  const pollTimer = useRef(null)

  useEffect(() => {
    if (room.status !== 'live') return undefined
    pollTimer.current = setInterval(() => {
      fetch(`/api/rooms/${room.code}`)
        .then(r => r.json())
        .then(data => {
          data.players?.forEach(player => onPlayerUpdate(room.code, player))
        })
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(pollTimer.current)
  }, [room.code, room.status, onPlayerUpdate])

  async function handleSave(playerUuid, field, value) {
    const res = await fetch(`/api/admin/rooms/${room.code}/players/${playerUuid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) return
    const updated = await res.json()
    onPlayerUpdate(room.code, updated)
  }

  if (editingPlayerUuid) {
    const player = room.players.find(p => p.playerUuid === editingPlayerUuid)
    return (
      <AdminEditModal
        player={player}
        prices={room.prices}
        onSave={(field, value) => handleSave(editingPlayerUuid, field, value)}
        onClose={() => setEditingPlayerUuid(null)}
      />
    )
  }

  const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)

  return (
    <div className={styles.page}>
      <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navArrow}
          aria-label="이전 팀"
          disabled={index === 0}
          onClick={() => setIndex(i => Math.max(0, i - 1))}
        >
          ‹
        </button>
        <div className={styles.navTitle}>
          <span className={styles.teamName}>{index + 1}팀</span>
          <span className={styles.teamCount}>{index + 1} / {rooms.length}</span>
        </div>
        <button
          type="button"
          className={styles.navArrow}
          aria-label="다음 팀"
          disabled={index === rooms.length - 1}
          onClick={() => setIndex(i => Math.min(rooms.length - 1, i + 1))}
        >
          ›
        </button>
      </div>

      <div className={styles.dots}>
        {rooms.map((r, i) => (
          <span key={r.code} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
        ))}
      </div>

      <div className={styles.grid}>
        {slots.map((player, i) => (
          player ? (
            <AdminPlayerCard
              key={player.playerUuid}
              player={player}
              prices={room.prices}
              onEdit={() => setEditingPlayerUuid(player.playerUuid)}
            />
          ) : (
            <div key={i} className={styles.emptySlot}>대기중</div>
          )
        ))}
      </div>
    </div>
  )
}
