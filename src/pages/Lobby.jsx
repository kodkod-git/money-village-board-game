import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Lobby.module.css'

const STOCK_LABELS = {
  semiconductor: '반도체·IT',
  finance: '금융',
  industrial: '산업재·기계',
  auto: '자동차·쇼핑',
  bio: '바이오·헬스케어',
  content: '콘텐츠·플랫폼',
}

const REAL_ESTATE_LABELS = {
  gaon: '단독 가온개미',
  nuri: '단독 누리고양이',
  dami: '다세대 다미원숭이',
  maru: '다세대 마루수리',
  chorong: '아파트 초롱부엉이',
  hani: '아파트 하늬여우',
}

const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

export default function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const [players, setPlayers] = useState([])
  const [roomFetched, setRoomFetched] = useState(false)
  const rejoinAttempted = useRef(false)
  const [showQR, setShowQR] = useState(false)
  const [prices, setPrices] = useState(DEFAULT_PRICES)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.players) setPlayers(data.players)
        if (data.prices) setPrices(data.prices)
      })
      .catch(() => {})
      .finally(() => setRoomFetched(true))
  }, [code])

  useEffect(() => {
    if (!socket || !roomFetched || rejoinAttempted.current) return
    if (players.find(p => p.socketId === socket.id)) return

    const stored = JSON.parse(localStorage.getItem('player_profile') || 'null')
    const playerUuid = localStorage.getItem('player_uuid')
    if (!stored || stored.code !== code) return

    rejoinAttempted.current = true
    socket.emit('join-room', {
      code,
      name: stored.name,
      affiliation: stored.affiliation,
      character: stored.character,
      isHost: stored.isHost ?? false,
      playerUuid,
    }, ({ ok }) => {
      if (!ok) rejoinAttempted.current = false
    })
  }, [socket, roomFetched, players, code])

  useEffect(() => {
    if (!socket) return
    const handler = ({ players }) => setPlayers(players)
    socket.on('room-updated', handler)
    return () => socket.off('room-updated', handler)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const handler = ({ prices }) => setPrices(prices)
    socket.on('room-prices-updated', handler)
    return () => socket.off('room-prices-updated', handler)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const handler = ({ sessionId }) => navigate(`/result/${sessionId}`)
    socket.on('game-submitted', handler)
    return () => socket.off('game-submitted', handler)
  }, [socket, navigate])

  useEffect(() => {
    if (!socket) return
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate])

  function handleLeave() {
    socket?.emit('leave-room')
    navigate('/')
  }

  function handlePriceConfirm(newPrices) {
    socket?.emit('update-room-prices', { code, prices: newPrices })
    setPrices(newPrices)
    setShowPriceModal(false)
  }

  async function handleSubmit() {
    setShowConfirmModal(false)
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/rooms/${code}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
    } catch (err) {
      alert(err.message)
      setIsSubmitting(false)
    }
  }

  const slots = Array.from({ length: 4 }, (_, i) => players[i] ?? null)
  const isHost = players.find(p => p.socketId === socket?.id)?.isHost ?? false
  const allCompleted = isHost && players.length > 0 && players.every(p => p.gameState?.isCompleted)

  return (
    <div className={styles.page}>
      <BackButton />
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
            onKick={
              isHost && player && player.socketId !== socket?.id
                ? () => socket?.emit('kick-player', { targetSocketId: player.socketId })
                : undefined
            }
          />
        ))}
      </div>

      <div className={styles.bottomBar}>
        {isHost && (
          <button className={styles.priceBtn} onClick={() => setShowPriceModal(true)}>
            가격 설정
          </button>
        )}
        {isHost && (
          <button
            className={`${styles.registerBtn} ${allCompleted ? styles.registerBtnActive : ''}`}
            disabled={!allCompleted || isSubmitting}
            onClick={() => setShowConfirmModal(true)}
          >
            {isSubmitting ? '저장 중...' : '결과 등록하기'}
          </button>
        )}
      </div>

      {showConfirmModal && (
        <ConfirmModal
          onConfirm={handleSubmit}
          onClose={() => setShowConfirmModal(false)}
        />
      )}
      {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
      {showPriceModal && (
        <PriceSettingModal
          prices={prices}
          onConfirm={handlePriceConfirm}
          onClose={() => setShowPriceModal(false)}
        />
      )}
    </div>
  )
}

function ConfirmModal({ onConfirm, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>결과 등록</div>
        <p className={styles.confirmText}>더 이상 수정할 수 없습니다.<br />결과를 등록하시겠습니까?</p>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>등록</button>
        </div>
      </div>
    </div>
  )
}

function PriceSettingModal({ prices, onConfirm, onClose }) {
  const [step, setStep] = useState('select')
  const [tempPrices, setTempPrices] = useState(prices)

  function adjust(category, key, delta) {
    const stepAmt = category === 'stocks' ? 2000 : 10000
    const min = category === 'stocks' ? 2000 : 10000
    const max = category === 'stocks' ? 20000 : 100000
    setTempPrices(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: Math.min(max, Math.max(min, prev[category][key] + delta * stepAmt)),
      },
    }))
  }

  if (step === 'select') {
    return (
      <div className={styles.overlay}>
        <div className={styles.popup}>
          <div className={styles.popupTitle}>💰 가격 설정</div>
          <div className={styles.categoryGrid}>
            <button className={styles.categoryCard} onClick={() => setStep('stocks')}>
              <span className={styles.categoryIcon}>📈</span>
              <span className={styles.categoryLabel}>주식</span>
            </button>
            <button className={styles.categoryCard} onClick={() => setStep('realEstate')}>
              <span className={styles.categoryIcon}>🏠</span>
              <span className={styles.categoryLabel}>부동산</span>
            </button>
          </div>
          <button className={styles.cancelBtn} onClick={onClose}>닫기</button>
        </div>
      </div>
    )
  }

  const isStocks = step === 'stocks'
  const category = isStocks ? 'stocks' : 'realEstate'
  const labels = isStocks ? STOCK_LABELS : REAL_ESTATE_LABELS

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>
          {isStocks ? '📈 주식 가격' : '🏠 부동산 가격'}
        </div>
        <div className={styles.quantityList}>
          {Object.keys(labels).map(key => (
            <div key={key} className={styles.quantityItem}>
              <span className={styles.quantityLabel}>{labels[key]}</span>
              <div className={styles.quantityControls}>
                <button className={styles.qtyBtn} onClick={() => adjust(category, key, -1)}>−</button>
                <span className={styles.priceDisplay}>
                  {tempPrices[category][key].toLocaleString()}원
                </span>
                <button className={styles.qtyBtn} onClick={() => adjust(category, key, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={() => setStep('select')}>← 뒤로</button>
          <button className={styles.confirmBtn} onClick={() => onConfirm(tempPrices)}>확인</button>
        </div>
      </div>
    </div>
  )
}
