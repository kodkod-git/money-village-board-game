import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import QRCodeImage from '../components/QRCodeImage'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './Lobby.module.css'

const STOCK_LABELS = {
  semiconductor: '반도체 IT',
  finance: '금융',
  industrial: '산업재·기계',
  auto: '소재·화학',
  bio: '바이오·헬스케어',
  content: '콘텐츠·소비재',
}

const REAL_ESTATE_LABELS = {
  gaon: '공동 가온개미',
  nuri: '공동 누리고양이',
  dami: '다세대 다미원숭이',
  maru: '다세대 마루수리',
  chorong: '아파트 초롱부엉이',
  hani: '아파트 하니여우',
}

const DEFAULT_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

export default function Lobby({ readOnly = false, mockRoom = null }) {
  const { code: routeCode } = useParams()
  const code = readOnly ? mockRoom.code : routeCode
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const [players, setPlayers] = useState(readOnly ? mockRoom.players : [])
  const [roomFetched, setRoomFetched] = useState(readOnly)
  const rejoinAttempted = useRef(false)
  const [showQR, setShowQR] = useState(false)
  const [prices, setPrices] = useState(readOnly ? mockRoom.prices : DEFAULT_PRICES)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

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
  }, [socket, roomFetched, players, code, readOnly])

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
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate, readOnly])

  function handleLeave() {
    socket?.emit('leave-room')
    navigate('/')
  }

  function handlePriceConfirm(newPrices) {
    if (!readOnly) socket?.emit('update-room-prices', { code, prices: newPrices })
    setPrices(newPrices)
    setShowPriceModal(false)
  }

  async function handleSubmit() {
    setShowConfirmModal(false)
    if (readOnly) return
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
  const isHost = !readOnly && (players.find(p => p.socketId === socket?.id)?.isHost ?? false)
  const allCompleted = isHost && players.length > 0 && players.every(p => p.gameState?.isCompleted)
  const canManageRoom = readOnly || isHost
  const canSubmitResult = readOnly || allCompleted
  const myPlayer = readOnly ? null : players.find(p => p.socketId === socket?.id)

  return (
    <div className={styles.page}>
      {!readOnly && <BackButton />}
      {!readOnly && (
        <button className={styles.leaveBtn} onClick={handleLeave} aria-label="팀 나가기">
          <img src="/icons/팀 나가기.png" alt="" className={styles.leaveIcon} />
          <span>팀 나가기</span>
        </button>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>팀 만들기</h1>
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
        {canManageRoom && (
          <button
            className={styles.qrCard}
            onClick={() => setShowQR(true)}
            type="button"
          >
            <span className={styles.codeLabel}>QR 코드</span>
            <QRCodeImage code={code} className={styles.qrImg} />
          </button>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>팀원 현황</span>
        <div className={styles.slots}>
          {slots.map((player, i) => (
            <PlayerSlot
              key={i}
              player={player}
              onEdit={!readOnly && player && myPlayer ? () => navigate(`/lobby/${code}/individual`) : undefined}
              onKick={
                !readOnly && isHost && player && player.socketId !== socket?.id
                  ? () => socket?.emit('kick-player', { targetSocketId: player.socketId })
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {canManageRoom && (
        <div className={styles.bottomBar}>
          <button className={styles.actionBtn} onClick={() => setShowPriceModal(true)}>
            가격 설정
          </button>
          <button
            className={`${styles.actionBtn} ${styles.submitBtn}`}
            onClick={() => setShowConfirmModal(true)}
            disabled={!canSubmitResult || isSubmitting}
          >
            {isSubmitting ? '제출 중...' : '결과 등록'}
          </button>
        </div>
      )}

      {canManageRoom && showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
      {canManageRoom && showConfirmModal && (
        <ConfirmModal
          onConfirm={handleSubmit}
          onClose={() => setShowConfirmModal(false)}
        />
      )}
      {canManageRoom && showPriceModal && (
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
          <div className={styles.popupTitle}>가격 설정</div>
          <div className={styles.categoryGrid}>
            <button className={styles.categoryCard} onClick={() => setStep('stocks')}>
              <span className={styles.categoryIcon}>주</span>
              <span className={styles.categoryLabel}>주식</span>
            </button>
            <button className={styles.categoryCard} onClick={() => setStep('realEstate')}>
              <span className={styles.categoryIcon}>부</span>
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
          {isStocks ? '주식 가격' : '부동산 가격'}
        </div>
        <div className={styles.quantityList}>
          {Object.keys(labels).map(key => (
            <div key={key} className={styles.quantityItem}>
              <span className={styles.quantityLabel}>{labels[key]}</span>
              <div className={styles.quantityControls}>
                <button className={styles.qtyBtn} onClick={() => adjust(category, key, -1)}>-</button>
                <span className={styles.priceDisplay}>
                  {tempPrices[category][key].toLocaleString()}원
                </span>
                <button className={styles.qtyBtn} onClick={() => adjust(category, key, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={() => setStep('select')}>뒤로</button>
          <button className={styles.confirmBtn} onClick={() => onConfirm(tempPrices)}>확인</button>
        </div>
      </div>
    </div>
  )
}
