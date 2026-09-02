import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import QRCodeImage from '../components/QRCodeImage'
import PriceSettingModal, { DEFAULT_PRICES } from '../components/PriceSettingModal'
import AlertModal from '../components/AlertModal'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Team.module.css'

export default function Team({ readOnly = false, mockRoom = null }) {
  const { code: routeCode } = useParams()
  const code = readOnly ? mockRoom.code : routeCode
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const [players, setPlayers] = useState(readOnly ? mockRoom.players : [])
  const [roomFetched, setRoomFetched] = useState(readOnly)
  const [showQR, setShowQR] = useState(false)
  const [prices, setPrices] = useState(readOnly ? mockRoom.prices : DEFAULT_PRICES)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  // 방에서 강제로 나가게 된 사유(강퇴 / 방 삭제). 안내 모달을 먼저 띄우고
  // 학생이 "확인"을 눌러야 로비로 이동한다.
  const [exitNotice, setExitNotice] = useState(null)

  useEffect(() => {
    if (readOnly) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.players) setPlayers(data.players)
        if (data.prices) setPrices(data.prices)
      })
      .catch(() => {})
      .finally(() => setRoomFetched(true))
  }, [code, readOnly])

  useEffect(() => {
    if (readOnly) return
    if (!socket || !roomFetched) return
    if (players.find(p => p.socketId === socket.id)) return

    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const playerUuid = sessionStorage.getItem('player_uuid')
    if (!stored || stored.code !== code) return

    socket.emit('join-room', {
      code,
      name: stored.name,
      affiliation: stored.affiliation,
      character: stored.character,
      isHost: stored.isHost ?? false,
      playerUuid,
    })
  }, [socket, roomFetched, players, code, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return

    function rejoin() {
      const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
      const playerUuid = sessionStorage.getItem('player_uuid')
      if (!stored || stored.code !== code) return

      socket.emit('join-room', {
        code,
        name: stored.name,
        affiliation: stored.affiliation,
        character: stored.character,
        isHost: stored.isHost ?? false,
        playerUuid,
      })
    }

    socket.on('connect', rejoin)
    return () => socket.off('connect', rejoin)
  }, [socket, code, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = ({ players }) => setPlayers(players)
    socket.on('room-updated', handler)
    return () => socket.off('room-updated', handler)
  }, [socket, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = ({ prices }) => setPrices(prices)
    socket.on('room-prices-updated', handler)
    return () => socket.off('room-prices-updated', handler)
  }, [socket, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = ({ sessionId }) => navigate(`/result/${sessionId}`)
    socket.on('game-submitted', handler)
    return () => socket.off('game-submitted', handler)
  }, [socket, navigate, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = () => setExitNotice({
      title: '팀에서 나가게 되었어요',
      message: '방장이 팀에서 내보냈어요.',
    })
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, readOnly])

  useEffect(() => {
    if (readOnly || !socket) return
    const handler = () => setExitNotice({
      title: '방이 사라졌어요',
      message: '방장이 나가서 방이 삭제되었어요.',
    })
    socket.on('room-closed', handler)
    return () => socket.off('room-closed', handler)
  }, [socket, readOnly])

  function goToLobby() {
    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const params = new URLSearchParams({ name: stored?.name ?? '', character: stored?.character ?? '' })
    if (stored?.affiliation) params.set('affiliation', stored.affiliation)
    if (stored?.classId) params.set('classId', stored.classId)
    navigate(`/lobby?${params}`)
  }

  function handleConfirmLeave() {
    socket?.emit('leave-room')
    setShowLeaveConfirm(false)
    goToLobby()
  }

  function handlePriceConfirm(newPrices) {
    if (!readOnly) socket?.emit('update-room-prices', { code, prices: newPrices })
    setPrices(newPrices)
    setShowPriceModal(false)
  }

  const slots = Array.from({ length: 4 }, (_, i) => players[i] ?? null)
  const isHost = !readOnly && (players.find(p => p.socketId === socket?.id)?.isHost ?? false)
  const myPlayer = readOnly ? null : players.find(p => p.socketId === socket?.id)

  return (
    <div className={styles.page}>
      {!readOnly && <BackButton onClick={() => setShowLeaveConfirm(true)} />}
      <button
        className={styles.priceSettingBtn}
        onClick={() => setShowPriceModal(true)}
        type="button"
      >
        <img src="/icons/settings-outline.svg" alt="" className={styles.priceSettingIcon} />
        가격 설정
      </button>

      <div className={styles.header}>
        <h1 className={styles.title}>팀 화면</h1>
        <p className={styles.subtitle}>
          {readOnly ? '관전 모드입니다' : '코드를 팀원에게 공유하세요'}
        </p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.inviteGrid}>
        <div className={styles.codeCard}>
          <span className={styles.codeLabel}>팀 초대 코드</span>
          <div className={styles.codeRow}>
            <span className={styles.code}>{code}</span>
            {!readOnly && (
              <button
                className={styles.copyBtn}
                onClick={() => navigator.clipboard.writeText(code)}
                aria-label="코드 복사"
              >
                <img src="/icons/복사하기.png" alt="" className={styles.copyIcon} />
              </button>
            )}
          </div>
        </div>
        <button
          className={styles.qrCard}
          onClick={() => setShowQR(true)}
          type="button"
        >
          <span className={styles.codeLabel}>QR 코드</span>
          <QRCodeImage code={code} className={styles.qrImg} />
        </button>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>팀원 현황</span>
        <div className={styles.slots}>
          {slots.map((player, i) => (
            <PlayerSlot
              key={i}
              player={player}
              onEdit={!readOnly && player && myPlayer && player.socketId === myPlayer.socketId ? () => navigate(`/team/${code}/individual`) : undefined}
              onKick={
                !readOnly && isHost && player && player.socketId !== socket?.id
                  ? () => socket?.emit('kick-player', { targetSocketId: player.socketId })
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {!readOnly && myPlayer && (
        <div className={styles.bottomBar}>
          <button
            className={styles.assetEntryBtn}
            onClick={() => navigate(`/team/${code}/individual`)}
            type="button"
          >
            자산 입력
          </button>
        </div>
      )}

      {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
      {!readOnly && showLeaveConfirm && (
        <LeaveConfirmModal
          onConfirm={handleConfirmLeave}
          onClose={() => setShowLeaveConfirm(false)}
        />
      )}
      {showPriceModal && (
        <PriceSettingModal
          prices={prices}
          onConfirm={handlePriceConfirm}
          onClose={() => setShowPriceModal(false)}
        />
      )}
      {exitNotice && (
        <AlertModal
          title={exitNotice.title}
          message={exitNotice.message}
          onConfirm={() => { setExitNotice(null); goToLobby() }}
        />
      )}
    </div>
  )
}

function LeaveConfirmModal({ onConfirm, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>방 나가기</div>
        <p className={styles.confirmText}>
          현재 방을 나가시겠습니까?<br />
          팀 인원이 혼자이거나 자신이 방장인 경우 현재 방이 사라질 수 있습니다.
        </p>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>나가기</button>
        </div>
      </div>
    </div>
  )
}
