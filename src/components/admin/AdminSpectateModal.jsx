import { useState, useEffect, useRef } from 'react'
import AdminPlayerCard from './AdminPlayerCard'
import AdminEditModal from './AdminEditModal'
import AdminPriceSettingModal from './AdminPriceSettingModal'
import ConfirmDialog from './ConfirmDialog'
import AdminTeamAssetsModal from './AdminTeamAssetsModal'
import AdminAddPlayerModal from './AdminAddPlayerModal'
import { adminFetch } from '../../utils/adminAuth'
import { copyGameResultLink, shareGameResultToKakao } from '../../utils/shareGameResult'
import styles from './AdminSpectateModal.module.css'

const POLL_INTERVAL_MS = 3000

export default function AdminSpectateModal({ rooms, initialIndex, onPlayerUpdate, onClose, onRoomChanged }) {
  // 코드로 현재 팀을 추적한다 — onRoomChanged로 목록을 다시 불러오면
  // 최신순 재정렬 때문에 이 방의 배열 인덱스가 바뀔 수 있으므로,
  // 숫자 인덱스만 들고 있으면 편집 중 다른 팀으로 화면이 튈 수 있다.
  const [currentCode, setCurrentCode] = useState(rooms[initialIndex].code)
  const [editingPlayerUuid, setEditingPlayerUuid] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [kickTarget, setKickTarget] = useState(null)
  const [confirmRegister, setConfirmRegister] = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [shareNotice, setShareNotice] = useState('')
  const index = rooms.findIndex(r => r.code === currentCode)
  const room = rooms[index]
  const hasDisconnectedPlayer = room.players.some(p => p?.connected === false)
  const pollTimer = useRef(null)
  const [titleDraft, setTitleDraft] = useState(room.title ?? '')

  useEffect(() => {
    setTitleDraft(room.title ?? '')
  }, [room.code, room.title])

  // 다른 팀으로 넘기면 이전 팀의 공유 안내는 지운다.
  useEffect(() => {
    setShareNotice('')
  }, [room.code])

  useEffect(() => {
    if (!shareNotice) return undefined
    const timer = setTimeout(() => setShareNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [shareNotice])

  const canShare = room.registered && Boolean(room.sessionId)

  useEffect(() => {
    if (room.registered) return undefined
    pollTimer.current = setInterval(() => {
      fetch(`/api/rooms/${room.code}`)
        .then(r => r.json())
        .then(data => {
          data.players?.forEach(player => onPlayerUpdate(room.code, player))
        })
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(pollTimer.current)
  }, [room.code, room.registered, onPlayerUpdate])

  async function handleSave(playerUuid, field, value) {
    const res = await adminFetch(`/api/admin/rooms/${room.code}/players/${playerUuid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) return
    const updated = await res.json()
    onPlayerUpdate(room.code, updated)
    // 관리자가 필드를 저장하면 서버에서 해당 플레이어를 완료 처리하므로,
    // 방 목록도 다시 불러와 상태 배지(예: 등록 대기)가 최신 상태를 반영하게 한다.
    onRoomChanged?.()
  }

  async function handleDelete() {
    const res = await adminFetch(`/api/admin/rooms/${room.code}`, { method: 'DELETE' })
    setConfirmDelete(false)
    if (!res.ok) return
    onRoomChanged()
    onClose()
  }

  async function handleKick(playerUuid) {
    const res = await adminFetch(`/api/admin/rooms/${room.code}/players/${playerUuid}`, { method: 'DELETE' })
    setKickTarget(null)
    if (!res.ok) return
    onRoomChanged?.()
  }

  async function handleTitleBlur() {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === room.title) return
    const res = await adminFetch(`/api/admin/rooms/${room.code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (!res.ok) {
      setTitleDraft(room.title ?? '')
      return
    }
    onRoomChanged?.()
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

  async function handleRegister() {
    const res = await fetch(`/api/rooms/${room.code}/submit`, { method: 'POST' })
    if (!res.ok) return
    onRoomChanged()
    onClose()
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

  return (
    <div className={styles.page}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navArrow}
          aria-label="이전 팀"
          disabled={index === 0}
          onClick={() => setCurrentCode(rooms[Math.max(0, index - 1)].code)}
        >
          ‹
        </button>
        <div className={styles.navTitle}>
          {room.title != null ? (
            <input
              className={styles.teamNameInput}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
            />
          ) : (
            <span className={styles.teamName}>{index + 1}팀</span>
          )}
          <span className={styles.teamCount}>{index + 1} / {rooms.length}</span>
        </div>
        <button
          type="button"
          className={styles.navArrow}
          aria-label="다음 팀"
          disabled={index === rooms.length - 1}
          onClick={() => setCurrentCode(rooms[Math.min(rooms.length - 1, index + 1)].code)}
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
        {room.players.map((player, i) => (
          player ? (
            <AdminPlayerCard
              key={player.playerUuid}
              player={player}
              prices={room.prices}
              onEdit={() => setEditingPlayerUuid(player.playerUuid)}
              onKick={room.registered ? undefined : () => setKickTarget(player.playerUuid)}
            />
          ) : (
            <div key={i} className={styles.emptySlot}>대기중</div>
          )
        ))}
      </div>

      <div className={styles.actions}>
        {!room.registered && (
          <button type="button" className={styles.priceBtn} onClick={() => setShowPriceModal(true)}>가격 설정</button>
        )}
        {room.status === 'completed-but-unregistered' && (
          <button type="button" className={styles.registerBtn} onClick={() => setConfirmRegister(true)}>결과 등록</button>
        )}
        <button type="button" className={styles.detailBtn} onClick={() => setShowDetail(true)}>자세히 보기</button>
        {canShare && (
          <button
            type="button"
            className={`${styles.shareIconBtn} ${styles.kakaoIconBtn}`}
            onClick={() => setShareNotice(shareGameResultToKakao(room.sessionId))}
            aria-label="카카오톡 공유하기"
          >
            <img className={styles.shareIconImg} src="/icons/mode_comment.png" alt="" aria-hidden="true" />
          </button>
        )}
        {canShare && (
          <button
            type="button"
            className={styles.shareIconBtn}
            onClick={async () => setShareNotice(await copyGameResultLink(room.sessionId))}
            aria-label="링크 복사하기"
          >
            <img className={styles.shareIconImg} src="/icons/link_2.png" alt="" aria-hidden="true" />
          </button>
        )}
        {!room.registered && room.players.length < 4 && (
          <button type="button" className={styles.addPlayerBtn} onClick={() => setShowAddPlayer(true)}>직접 등록하기</button>
        )}
        <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>삭제</button>
      </div>
      {shareNotice && <p role="status" className={styles.shareNotice}>{shareNotice}</p>}

      {confirmDelete && (
        <ConfirmDialog
          tone="danger"
          title="팀 삭제"
          description={<>이 방을 삭제하면 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {kickTarget && (
        <ConfirmDialog
          tone="danger"
          title="학생 퇴장"
          description="이 학생을 팀에서 퇴장시키겠습니까?"
          confirmLabel="퇴장시키기"
          onCancel={() => setKickTarget(null)}
          onConfirm={() => handleKick(kickTarget)}
        />
      )}

      {confirmRegister && (
        <ConfirmDialog
          tone="primary"
          title="결과 등록"
          description={
            hasDisconnectedPlayer
              ? '연결끊김 상태인 참가자가 존재하고, 일부 참여자에게는 결과화면이 나오지 않을 수 있습니다. 그래도 진행하시겠습니까?'
              : '이 팀의 결과를 등록하시겠습니까?'
          }
          onCancel={() => setConfirmRegister(false)}
          onConfirm={() => { setConfirmRegister(false); handleRegister() }}
        />
      )}

      {showPriceModal && (
        <AdminPriceSettingModal
          prices={room.prices}
          onConfirm={handlePriceConfirm}
          onClose={() => setShowPriceModal(false)}
        />
      )}

      {showDetail && (
        <AdminTeamAssetsModal
          room={room}
          prices={room.prices}
          teamLabel={room.title ?? `${index + 1}팀`}
          onClose={() => setShowDetail(false)}
        />
      )}

      {showAddPlayer && (
        <AdminAddPlayerModal
          code={room.code}
          prices={room.prices}
          onClose={() => setShowAddPlayer(false)}
          onSaved={() => { setShowAddPlayer(false); onRoomChanged?.() }}
        />
      )}
    </div>
  )
}
