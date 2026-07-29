import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import PlayerSlot from '../components/PlayerSlot'
import QRModal from '../components/QRModal'
import QRCodeImage from '../components/QRCodeImage'
import NumberInputModal from '../components/NumberInputModal'
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

const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

const REAL_ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
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

    const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
    const playerUuid = sessionStorage.getItem('player_uuid')
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
      {canManageRoom && (
        <button
          className={styles.priceSettingBtn}
          onClick={() => setShowPriceModal(true)}
          type="button"
        >
          <span aria-hidden="true">⚙️</span> 가격 설정
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
              onEdit={!readOnly && player && myPlayer && player.socketId === myPlayer.socketId ? () => navigate(`/lobby/${code}/individual`) : undefined}
              onKick={
                !readOnly && isHost && player && player.socketId !== socket?.id
                  ? () => socket?.emit('kick-player', { targetSocketId: player.socketId })
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className={styles.bottomBar}>
        {!readOnly && (
          <button
            className={styles.exitBtn}
            onClick={handleLeave}
            aria-label="팀 나가기"
            type="button"
          >
            <img src="/icons/exit_to_app.png" alt="" className={styles.exitIcon} />
          </button>
        )}
        <button
          className={styles.actionBtn}
          onClick={() => setShowConfirmModal(true)}
          disabled={!canManageRoom || !canSubmitResult || isSubmitting}
        >
          {isSubmitting ? '제출 중...' : '결과 등록'}
        </button>
      </div>

      {showQR && <QRModal code={code} onClose={() => setShowQR(false)} />}
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
  const [category, setCategory] = useState('stocks')
  const [tempPrices, setTempPrices] = useState(prices)
  const [editingKey, setEditingKey] = useState(null)

  function handleReset() {
    setTempPrices(prev => ({ ...prev, [category]: DEFAULT_PRICES[category] }))
  }

  const labels = category === 'stocks' ? STOCK_LABELS : REAL_ESTATE_LABELS
  const images = category === 'stocks' ? STOCK_IMAGES : REAL_ESTATE_IMAGES
  const folder = category === 'stocks' ? 'stock' : 'estate'
  const editingLabel = editingKey ? labels[editingKey] : null

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.priceModal} onClick={e => e.stopPropagation()}>
          <div className={styles.priceModalHeader}>
            <button className={styles.priceBackBtn} onClick={onClose} type="button">‹ 뒤로</button>
            <span className={styles.priceModalTitle}>가격 설정</span>
            <button className={styles.priceResetBtn} onClick={handleReset} type="button">초기화</button>
          </div>

          <div className={styles.priceTabs}>
            <button
              className={`${styles.priceTab} ${category === 'stocks' ? styles.priceTabActive : ''}`}
              onClick={() => setCategory('stocks')}
              type="button"
            >
              주식
            </button>
            <button
              className={`${styles.priceTab} ${category === 'realEstate' ? styles.priceTabActive : ''}`}
              onClick={() => setCategory('realEstate')}
              type="button"
            >
              부동산
            </button>
          </div>

          <div className={styles.priceList}>
            {Object.keys(labels).map(key => (
              <div key={key} className={styles.priceRow}>
                <img src={`/badges/${folder}/${images[key]}.png`} alt="" className={styles.priceIcon} />
                <div className={styles.priceInfo}>
                  <span className={styles.priceLabel}>{labels[key]}</span>
                  <span className={styles.priceUnit}>단위: 원</span>
                </div>
                <button
                  className={styles.pricePill}
                  onClick={() => setEditingKey(key)}
                  type="button"
                >
                  {tempPrices[category][key].toLocaleString()} 원 ›
                </button>
              </div>
            ))}
          </div>

          <button className={styles.priceConfirmBtn} onClick={() => onConfirm(tempPrices)} type="button">
            확인하기
          </button>
        </div>
      </div>

      {editingKey && (
        <NumberInputModal
          title={editingLabel}
          initialValue={tempPrices[category][editingKey]}
          unit="원"
          onConfirm={val => {
            setTempPrices(prev => ({ ...prev, [category]: { ...prev[category], [editingKey]: val } }))
            setEditingKey(null)
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </>
  )
}
