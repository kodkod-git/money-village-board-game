import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Lobby.module.css'

export default function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const [players, setPlayers] = useState([])
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => { if (data.players) setPlayers(data.players) })
      .catch(() => {})
  }, [code])

  useEffect(() => {
    if (!socket) return
    const handler = ({ players }) => setPlayers(players)
    socket.on('room-updated', handler)
    return () => socket.off('room-updated', handler)
  }, [socket])

  function handleLeave() {
    socket?.emit('leave-room')
    navigate('/')
  }

  const slots = Array.from({ length: 4 }, (_, i) => players[i] ?? null)
  const isHost = players.find(p => p.socketId === socket?.id)?.isHost ?? false
  const allCompleted = isHost && players.length === 4 && players.every(p => p.gameState?.isCompleted)

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.codeBox}>
          팀 코드: <span className={styles.code}>{code}</span>
          <button
            className={styles.copyBtn}
            onClick={() => navigator.clipboard.writeText(code)}
            aria-label="코드 복사"
          >📋</button>
        </div>
        <div className={styles.actions}>
          <button className={styles.qrBtn} onClick={() => setShowQR(true)}>📱 QR</button>
          <button className={styles.leaveBtn} onClick={handleLeave}>팀 나가기</button>
        </div>
      </div>

      <div className={styles.counter}>{players.length} / 4 명 참가</div>

      <div className={styles.characters}>
        {slots.map((player, i) => (
          <PlayerSlot
            key={i}
            player={player}
            isOwnPlayer={player?.socketId === socket?.id}
            onNavigate={() => navigate(`/lobby/${code}/individual`)}
          />
        ))}
      </div>

      <div className={styles.bottomBar}>
        <button
          className={`${styles.registerBtn} ${allCompleted ? styles.registerBtnActive : ''}`}
          disabled={!allCompleted}
        >
          결과 등록하기
        </button>
      </div>

      {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
    </div>
  )
}
