import { useState } from 'react'
import { ROOM_STATUS_LABELS } from '../../constants/gameData'
import PriceSettingModal, { STOCK_LABELS, STOCK_IMAGES, REAL_ESTATE_LABELS, REAL_ESTATE_IMAGES } from '../PriceSettingModal'
import { adminFetch } from '../../utils/adminAuth'
import { teamDisplayName } from '../../utils/teamDisplayName'
import { toast } from '../../utils/toast'
import { PLAYER_DRAG_TYPE, TEAM_FULL_MESSAGE, MAX_TEAM_PLAYERS } from '../../constants/competition'
import styles from './AdminGridCard.module.css'

const STATUS_BADGE_CLASS = {
  live: 'badgeLive',
  stale: 'badgeStale',
  abandoned: 'badgeAbandoned',
  'completed-but-unregistered': 'badgeUnregistered',
}

const TABS = [
  { key: 'lobby', label: '팀' },
  { key: 'stocks', label: '주식' },
  { key: 'realEstate', label: '부동산' },
]

// competition: 경쟁 모드 수업. 팀 코드·팀장 표시를 숨기고, onAssign이 있으면 참여자를 끌어다 놓아 배정할 수 있다.
export default function AdminGridCard({ room, index = 0, onSpectate, onRoomChanged, competition = false, onAssign }) {
  const [tab, setTab] = useState('lobby')
  const [showPriceModal, setShowPriceModal] = useState(false)

  const displayName = teamDisplayName(room, index)
  const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)
  const badgeClassKey = !room.registered ? STATUS_BADGE_CLASS[room.status] : undefined
  const priceLabels = tab === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const priceImages = tab === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const priceFolder = tab === 'stocks' ? 'stock' : 'estate'
  const priceValues = tab === 'stocks' ? room.prices?.stocks : room.prices?.realEstate
  const canDrag = competition && !room.registered && Boolean(onAssign)

  function handleDrop(e) {
    e.preventDefault()
    const playerUuid = e.dataTransfer.getData(PLAYER_DRAG_TYPE)
    if (!playerUuid || room.players.some(p => p?.playerUuid === playerUuid)) return
    if (room.players.length >= MAX_TEAM_PLAYERS) {
      toast(TEAM_FULL_MESSAGE)
      return
    }
    onAssign(playerUuid, room.code)
  }

  async function handlePriceConfirm(newPrices) {
    const res = await adminFetch(`/api/admin/rooms/${room.code}/prices`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrices),
    })
    setShowPriceModal(false)
    if (!res.ok) return
    onRoomChanged?.()
  }

  function handleCardClick() {
    if (tab === 'lobby') {
      onSpectate(room)
      return
    }
    setShowPriceModal(true)
  }

  return (
    <div
      className={styles.cardWrapper}
      data-testid="admin-team-card"
      onDragOver={canDrag ? e => e.preventDefault() : undefined}
      onDrop={canDrag ? handleDrop : undefined}
    >
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.titleBadge}>{displayName}</span>
          {!competition && <span className={styles.codeBadge}>{room.code}</span>}
        </div>
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button className={styles.card} onClick={handleCardClick} type="button">
        {tab === 'lobby' && room.registered && (
          <span className={`${styles.badge} ${styles.badgeRegistered}`}>등록 완료</span>
        )}
        {badgeClassKey && (
          <span className={`${styles.badge} ${styles[badgeClassKey]}`}>
            {ROOM_STATUS_LABELS[room.status]}
          </span>
        )}

        {tab === 'lobby' ? (
          <div className={styles.slots}>
            {slots.map((player, i) => (
              <div
                key={i}
                className={styles.slot}
                data-testid="admin-player-slot"
                draggable={canDrag && player ? true : undefined}
                onDragStart={canDrag && player ? e => e.dataTransfer.setData(PLAYER_DRAG_TYPE, player.playerUuid) : undefined}
              >
                {player ? (
                  <>
                    {i === 0 && !competition && <span className={styles.leaderBadge} aria-hidden="true">★</span>}
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
        ) : (
          <div className={styles.priceList}>
            {Object.keys(priceLabels).map(key => (
              <div key={key} className={styles.priceRow}>
                <img src={`/badges/${priceFolder}/${priceImages[key]}.png`} alt="" className={styles.priceIcon} />
                <span className={styles.priceLabel}>{priceLabels[key]}</span>
                <span className={styles.priceValue}>{(priceValues?.[key] ?? 0).toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}
      </button>

      {showPriceModal && (
        <PriceSettingModal
          prices={room.prices}
          initialCategory={tab === 'realEstate' ? 'realEstate' : 'stocks'}
          onConfirm={handlePriceConfirm}
          onClose={() => setShowPriceModal(false)}
        />
      )}
    </div>
  )
}
