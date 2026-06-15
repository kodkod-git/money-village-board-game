import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './IndividualPage.module.css'

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

const JOB_LABELS = {
  a: '경영·금융',
  b: '연구·기술',
  c: '보건·교육',
  d: '문화·콘텐츠',
  e: '서비스·판매',
  f: '생산·운송',
}

const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']

function defaultGameState() {
  return {
    cash: null,
    job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false,
    realEstateVisited: false,
    isCompleted: false,
  }
}

function useLongPress(callback, { delay = 400, interval = 80 } = {}) {
  const timeoutRef = useRef(null)
  const intervalRef = useRef(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const stop = useCallback(() => {
    clearTimeout(timeoutRef.current)
    clearInterval(intervalRef.current)
  }, [])

  const start = useCallback((e) => {
    e.preventDefault()
    callbackRef.current()
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => callbackRef.current(), interval)
    }, delay)
  }, [delay, interval])

  useEffect(() => () => stop(), [stop])

  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop }
}

export default function IndividualPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const [player, setPlayer] = useState(null)
  const [gameState, setGameState] = useState(defaultGameState)
  const [activePopup, setActivePopup] = useState(null)
  const [tempCash, setTempCash] = useState(0)
  const [tempStocks, setTempStocks] = useState(null)
  const [tempRealEstate, setTempRealEstate] = useState(null)

  useEffect(() => {
    if (!socket) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        const me = data.players?.find(p => p.socketId === socket.id)
        if (!me) { navigate(`/lobby/${code}`); return }
        setPlayer(me)
        setGameState(me.gameState ?? defaultGameState())
      })
      .catch(() => navigate(`/lobby/${code}`))
  }, [code, socket])

  function emitState(newState) {
    socket?.emit('update-player-state', { code, gameState: newState })
  }

  function toggleBadge(i) {
    const badges = [...gameState.badges]
    badges[i] = !badges[i]
    const next = { ...gameState, badges }
    setGameState(next)
    emitState(next)
  }

  function openCash() {
    setTempCash(gameState.cash ?? 0)
    setActivePopup('cash')
  }

  function confirmCash() {
    const next = { ...gameState, cash: tempCash }
    setGameState(next)
    emitState(next)
    setActivePopup(null)
  }

  function openStocks() {
    setTempStocks({ ...gameState.stocks })
    setActivePopup('stocks')
  }

  function confirmStocks() {
    const next = { ...gameState, stocks: tempStocks, stocksVisited: true }
    setGameState(next)
    emitState(next)
    setActivePopup(null)
  }

  function openRealEstate() {
    setTempRealEstate({ ...gameState.realEstate })
    setActivePopup('realEstate')
  }

  function confirmRealEstate() {
    const next = { ...gameState, realEstate: tempRealEstate, realEstateVisited: true }
    setGameState(next)
    emitState(next)
    setActivePopup(null)
  }

  function selectJob(key) {
    const next = { ...gameState, job: key }
    setGameState(next)
    emitState(next)
    setActivePopup(null)
  }

  function handleComplete() {
    const next = { ...gameState, isCompleted: true }
    setGameState(next)
    emitState(next)
    navigate(`/lobby/${code}`)
  }

  const canComplete =
    gameState.cash !== null &&
    gameState.job !== null &&
    gameState.stocksVisited &&
    gameState.realEstateVisited &&
    gameState.badges.some(Boolean)

  const totalStocks = Object.values(gameState.stocks).reduce((a, b) => a + b, 0)
  const totalRealEstate = Object.values(gameState.realEstate).reduce((a, b) => a + b, 0)

  if (!player) return null

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(`/lobby/${code}`)}>← 뒤로</button>
        <span className={styles.playerName}>{player.name}</span>
        <div className={styles.badges}>
          {BADGE_NAMES.map((name, i) => (
            <button key={name} className={styles.badgeBtn} onClick={() => toggleBadge(i)}>
              <img
                src={`/badges/${name}.png`}
                alt={name}
                className={`${styles.badgeImg} ${!gameState.badges[i] ? styles.badgeLocked : ''}`}
              />
              {!gameState.badges[i] && <span className={styles.lockIcon}>🔒</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.leftCol}>
          <button className={styles.card} onClick={openStocks}>
            <div className={styles.cardTitle}>📈 주식</div>
            <div className={styles.cardValue}>{totalStocks}주</div>
            {!gameState.stocksVisited && <div className={styles.cardHint}>탭하여 입력</div>}
          </button>
          <button className={styles.card} onClick={openRealEstate}>
            <div className={styles.cardTitle}>🏠 부동산</div>
            <div className={styles.cardValue}>{totalRealEstate}개</div>
            {!gameState.realEstateVisited && <div className={styles.cardHint}>탭하여 입력</div>}
          </button>
          <button className={styles.card} onClick={() => setActivePopup('job')}>
            <div className={styles.cardTitle}>💼 직업</div>
            <div className={styles.cardValue}>{gameState.job ? JOB_LABELS[gameState.job] : '—'}</div>
            {!gameState.job && <div className={styles.cardHint}>탭하여 선택</div>}
          </button>
        </div>

        <div className={styles.centerCol}>
          <img
            src={`/characters/${player.character}.png`}
            alt={player.character}
            className={styles.characterImg}
          />
        </div>

        <div className={styles.rightCol}>
          <button className={styles.card} onClick={openCash}>
            <div className={styles.cardTitle}>💵 현금</div>
            <div className={styles.cardValue}>
              {gameState.cash !== null ? `${gameState.cash.toLocaleString()}원` : '—'}
            </div>
            {gameState.cash === null && <div className={styles.cardHint}>탭하여 입력</div>}
          </button>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <button
          className={[
            styles.completeBtn,
            gameState.isCompleted ? styles.completeBtnDone : canComplete ? styles.completeBtnActive : '',
          ].join(' ')}
          disabled={!canComplete || gameState.isCompleted}
          onClick={handleComplete}
        >
          {gameState.isCompleted ? '입력완료 ✓' : '입력완료'}
        </button>
      </div>

      {activePopup === 'cash' && (
        <CashPopup
          value={tempCash}
          onChange={setTempCash}
          onConfirm={confirmCash}
          onClose={() => setActivePopup(null)}
        />
      )}
      {activePopup === 'stocks' && tempStocks && (
        <QuantityPopup
          title="📈 주식 보유 수량"
          items={tempStocks}
          labels={STOCK_LABELS}
          onChange={setTempStocks}
          onConfirm={confirmStocks}
          onClose={() => setActivePopup(null)}
        />
      )}
      {activePopup === 'realEstate' && tempRealEstate && (
        <QuantityPopup
          title="🏠 부동산 보유 수량"
          items={tempRealEstate}
          labels={REAL_ESTATE_LABELS}
          onChange={setTempRealEstate}
          onConfirm={confirmRealEstate}
          onClose={() => setActivePopup(null)}
        />
      )}
      {activePopup === 'job' && (
        <JobPopup onSelect={selectJob} onClose={() => setActivePopup(null)} />
      )}
    </div>
  )
}

function CashPopup({ value, onChange, onConfirm, onClose }) {
  const incHandlers = useLongPress(() => onChange(v => v + 1000))
  const decHandlers = useLongPress(() => onChange(v => Math.max(0, v - 1000)))
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>💵 현금 보유량</div>
        <div className={styles.cashDisplay}>{value.toLocaleString()}원</div>
        <div className={styles.cashControls}>
          <button className={styles.cashBtn} {...decHandlers}>−</button>
          <span className={styles.cashUnit}>1,000원 단위<br />꾹 누르면 빨라져요</span>
          <button className={styles.cashBtn} {...incHandlers}>+</button>
        </div>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>
  )
}

function QuantityPopup({ title, items, labels, onChange, onConfirm, onClose }) {
  function adjust(key, delta) {
    onChange(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }))
  }
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>{title}</div>
        <div className={styles.quantityList}>
          {Object.keys(labels).map(key => (
            <div key={key} className={styles.quantityRow}>
              <span className={styles.quantityLabel}>{labels[key]}</span>
              <div className={styles.quantityControls}>
                <button className={styles.qtyBtn} onClick={() => adjust(key, -1)}>−</button>
                <span className={styles.qtyValue}>{items[key]}</span>
                <button className={styles.qtyBtn} onClick={() => adjust(key, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.popupActions}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>
  )
}

function JobPopup({ onSelect, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>💼 직업 선택</div>
        <div className={styles.jobList}>
          {Object.entries(JOB_LABELS).map(([key, label]) => (
            <button key={key} className={styles.jobOption} onClick={() => onSelect(key)}>
              {label}
            </button>
          ))}
        </div>
        <button className={styles.cancelBtn} onClick={onClose}>취소</button>
      </div>
    </div>
  )
}
