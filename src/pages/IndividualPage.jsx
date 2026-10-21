import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import AssetInputSteps, { defaultGameState } from '../components/AssetInputSteps'
import AlertModal from '../components/AlertModal'
import { DEFAULT_PRICES } from '../components/PriceSettingModal'
import { useSocketContext } from '../contexts/SocketContext'
import useBodyClass from '../hooks/useBodyClass'
import styles from './IndividualPage.module.css'

export default function IndividualPage() {
  useBodyClass('onboarding-mode')
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const [player, setPlayer] = useState(null)
  const [prices, setPrices] = useState(DEFAULT_PRICES)
  const [gameState, setGameState] = useState(defaultGameState)
  // 서버에서 참가자 정보를 다시 받을 때마다 올려서 입력 단계의 완료 표시·현금을 다시 맞춘다.
  const [syncToken, setSyncToken] = useState(0)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  // 강퇴 시 안내 모달을 먼저 띄우고, "확인"을 눌러야 로비로 이동한다.
  const [exitNotice, setExitNotice] = useState(null)

  useEffect(() => {
    if (!socket) return

    function applyPlayer(me) {
      setPlayer(me)
      setGameState(me.gameState ?? defaultGameState())
      setSyncToken(t => t + 1)
    }

    function syncPlayer() {
      fetch(`/api/rooms/${code}`)
        .then(r => r.json())
        .then(data => {
          setPrices(data.prices)
          const me = data.players?.find(p => p.socketId === socket.id)
          if (me) { applyPlayer(me); return }
          const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
          const playerUuid = sessionStorage.getItem('player_uuid')
          if (!stored || stored.code !== code) { navigate(`/team/${code}`); return }
          socket.emit('join-room', {
            code, name: stored.name, affiliation: stored.affiliation,
            character: stored.character, isHost: false, playerUuid,
          }, ({ ok }) => {
            if (!ok) { navigate(`/team/${code}`); return }
            fetch(`/api/rooms/${code}`)
              .then(r => r.json())
              .then(data2 => {
                setPrices(data2.prices)
                const me2 = data2.players?.find(p => p.socketId === socket.id)
                if (!me2) { navigate(`/team/${code}`); return }
                applyPlayer(me2)
              })
              .catch(() => navigate(`/team/${code}`))
          })
        })
        .catch(() => navigate(`/team/${code}`))
    }

    syncPlayer()
    socket.on('connect', syncPlayer)
    return () => socket.off('connect', syncPlayer)
  }, [code, socket, navigate])

  useEffect(() => {
    if (!socket) return
    const handler = ({ prices }) => setPrices(prices)
    socket.on('room-prices-updated', handler)
    return () => socket.off('room-prices-updated', handler)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const handler = () => setExitNotice({
      title: '팀에서 나가게 되었어요',
      message: '방장이 팀에서 내보냈어요.',
    })
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket])

  function goToLobby() {
    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const params = new URLSearchParams({ name: stored?.name ?? '', character: stored?.character ?? '' })
    if (stored?.affiliation) params.set('affiliation', stored.affiliation)
    if (stored?.classId) params.set('classId', stored.classId)
    navigate(`/lobby?${params}`)
  }

  function updateState(next) {
    setGameState(next)
    socket?.emit('update-player-state', { code, gameState: next })
  }

  if (!player) return null

  return (
    <div className={`${styles.page} ${styles.pageFill}`}>
      <BackButton onClick={() => setShowLeaveConfirm(true)} />
      <AssetInputSteps
        gameState={gameState}
        prices={prices}
        syncToken={syncToken}
        onChange={updateState}
        onComplete={next => { updateState(next); navigate(`/team/${code}`) }}
      />

      {showLeaveConfirm && (
        <LeaveConfirmModal
          onConfirm={() => { setShowLeaveConfirm(false); navigate(-1) }}
          onClose={() => setShowLeaveConfirm(false)}
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
        <div className={styles.popupTitle}>이전 화면으로 이동</div>
        <p className={styles.confirmText}>
          입력 도중에 뒤로가기 버튼을 누르는 경우, 현재까지 입력한 내용이 사라질 수 있습니다.<br />
          이전 화면으로 돌아가시겠습니까?
        </p>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>이동</button>
        </div>
      </div>
    </div>
  )
}
