import { useState } from 'react'
import { ROOM_STATUS_LABELS } from '../../constants/gameData'
import PriceSettingModal, { STOCK_LABELS, STOCK_IMAGES, REAL_ESTATE_LABELS, REAL_ESTATE_IMAGES } from '../PriceSettingModal'
import { adminFetch } from '../../utils/adminAuth'
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

export default function AdminGridCard({ room, index = 0, onSpectate, onRoomChanged }) {
  const [tab, setTab] = useState('lobby')
  const [showPriceModal, setShowPriceModal] = useState(false)

  const displayName = room.title || `팀 ${index + 1}`
  const slots = Array.from({ length: 4 }, (_, i) => room.players[i] ?? null)
  const badgeClassKey = !room.registered ? STATUS_BADGE_CLASS[room.status] : undefined
  const priceLabels = tab === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const priceImages = tab === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const priceFolder = tab === 'stocks' ? 'stock' : 'estate'
  const priceValues = tab === 'stocks' ? room.prices?.stocks : room.prices?.realEstate

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
    <div className={styles.cardWrapper}>
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.titleBadge}>{displayName}</span>
          <span className={styles.codeBadge}>{room.code}</span>
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
              <div key={i} className={styles.slot} data-testid="admin-player-slot">
                {player ? (
                  <>
                    {i === 0 && <span className={styles.leaderBadge} aria-hidden="true">★</span>}
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
