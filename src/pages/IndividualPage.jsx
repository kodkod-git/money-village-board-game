import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
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

const REAL_ESTATE_COLORS = {
  gaon:   '#66bb6a',
  nuri:   '#26a69a',
  dami:   '#ffa726',
  maru:   '#ff7043',
  chorong:'#ab47bc',
  hani:   '#7e57c2',
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

const STOCK_COLORS = {
  semiconductor: '#2196f3',
  finance:       '#ff9800',
  industrial:    '#78909c',
  auto:          '#4caf50',
  bio:           '#00bcd4',
  content:       '#9c27b0',
}

const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}

const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

function defaultGameState() {
  return {
    cash: 0,
    job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false,
    realEstateVisited: false,
    isCompleted: false,
  }
}


function CellBar({ count = 0, isEditing = false, small = false, color = '#e91e63' }) {
  const filled = Math.min(count, 10)
  const overflow = !isEditing && count > 10
  return (
    <div className={styles.cellBarWrapper}>
      <div className={`${styles.cellBar} ${small ? styles.cellBarSmall : ''}`}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`${styles.cell} ${small ? styles.cellSmall : ''} ${i >= filled ? styles.cellEmpty : ''}`}
            style={i < filled ? { background: color } : undefined}
          />
        ))}
      </div>
      {overflow && <span className={styles.overflowLabel} style={{ color }}>10+</span>}
      {isEditing && <span className={styles.editCount}>{count}</span>}
    </div>
  )
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
  const [isSequential, setIsSequential] = useState(false)

  useEffect(() => {
    if (!socket) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        const me = data.players?.find(p => p.socketId === socket.id)
        if (!me) { navigate(`/lobby/${code}`); return }
        setPlayer(me)
        const gs = me.gameState ?? defaultGameState()
        setGameState(gs)
        if (gs.job === null) {
          setIsSequential(true)
          setActivePopup('job')
        }
      })
      .catch(() => navigate(`/lobby/${code}`))
  }, [code, socket, navigate])

  useEffect(() => {
    if (!socket) return
    const handler = () => navigate('/team')
    socket.on('you-were-kicked', handler)
    return () => socket.off('you-were-kicked', handler)
  }, [socket, navigate])

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
    if (isSequential) setIsSequential(false)
  }

  function openStocks() {
    setTempStocks({ ...gameState.stocks })
    setActivePopup('stocks')
  }
  function confirmStocks() {
    const next = { ...gameState, stocks: tempStocks, stocksVisited: true }
    setGameState(next)
    emitState(next)
    if (isSequential) {
      setTempCash(next.cash ?? 0)
      setActivePopup('cash')
    } else {
      setActivePopup(null)
    }
  }

  function openRealEstate() {
    setTempRealEstate({ ...gameState.realEstate })
    setActivePopup('realEstate')
  }
  function confirmRealEstate() {
    const next = { ...gameState, realEstate: tempRealEstate, realEstateVisited: true }
    setGameState(next)
    emitState(next)
    if (isSequential) {
      setTempStocks({ ...next.stocks })
      setActivePopup('stocks')
    } else {
      setActivePopup(null)
    }
  }

  function selectJob(key) {
    const next = { ...gameState, job: key }
    setGameState(next)
    emitState(next)
    if (isSequential) {
      setActivePopup('badges')
    } else {
      setActivePopup(null)
    }
  }

  function confirmBadges(newBadges) {
    const next = { ...gameState, badges: newBadges }
    setGameState(next)
    emitState(next)
    if (isSequential) {
      setTempRealEstate({ ...next.realEstate })
      setActivePopup('realEstate')
    } else {
      setActivePopup(null)
    }
  }

  function handleComplete() {
    const next = { ...gameState, isCompleted: true }
    setGameState(next)
    emitState(next)
    navigate(`/lobby/${code}`)
  }

  function handleCancel() {
    const next = { ...gameState, isCompleted: false }
    setGameState(next)
    emitState(next)
  }

  const canComplete =
    gameState.job !== null &&
    gameState.stocksVisited &&
    gameState.realEstateVisited &&
    gameState.badges.some(Boolean)

  if (!player) return null

  return (
    <div className={styles.page}>
      <BackButton />

      <div className={styles.main}>
        {/* LEFT: name, job */}
        <div className={styles.leftCol}>
          <div className={styles.leftContent}>
            <div className={styles.nameText}>{player.name}</div>
            <button className={styles.jobBtn} onClick={() => setActivePopup('job')}>
              <span className={`${styles.jobValue}${!gameState.job ? ' ' + styles.placeholder : ''}`}>
                {gameState.job ? JOB_LABELS[gameState.job] : '직업 선택'}
              </span>
            </button>
          </div>
        </div>

        {/* CENTER: character */}
        <div className={styles.centerCol}>
          <img
            src={`/characters/${player.character}.png`}
            alt={player.character}
            className={styles.characterImg}
          />
        </div>

        {/* RIGHT: badges, real estate, stocks */}
        <div className={styles.rightCol}>
          <div className={styles.rightGroup}>
            <div className={styles.section}>
              <div className={styles.sectionLabel}>성공카드</div>
              <div className={styles.badgeGrid}>
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

            <button className={styles.assetSection} onClick={openRealEstate}>
              <div className={styles.sectionLabel}>부동산</div>
              <div className={styles.cellBars}>
                {Object.keys(REAL_ESTATE_LABELS).map(key => (
                  <CellBar key={key} count={gameState.realEstate[key]} color={REAL_ESTATE_COLORS[key]} />
                ))}
              </div>
            </button>

            <button className={styles.assetSection} onClick={openStocks}>
              <div className={styles.sectionLabel}>주식</div>
              <div className={styles.cellBars}>
                {Object.keys(STOCK_LABELS).map(key => (
                  <CellBar key={key} count={gameState.stocks[key]} color={STOCK_COLORS[key]} />
                ))}
              </div>
            </button>

            <button className={styles.cashSection} onClick={openCash}>
              <div className={styles.sectionLabel}>현금</div>
              <span className={styles.cashInlineValue}>
                {(gameState.cash ?? 0).toLocaleString()}원
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        {gameState.isCompleted ? (
          <button className={`${styles.completeBtn} ${styles.cancelBtn}`} onClick={handleCancel}>
            입력취소
          </button>
        ) : (
          <button
            className={`${styles.completeBtn} ${canComplete ? styles.completeBtnActive : ''}`}
            disabled={!canComplete}
            onClick={handleComplete}
          >
            입력완료
          </button>
        )}
      </div>

      {activePopup === 'cash' && (
        <CashPopup
          value={tempCash}
          onChange={setTempCash}
          onConfirm={confirmCash}
          onClose={() => setActivePopup(null)}
          isSequential={isSequential}
        />
      )}
      {activePopup === 'stocks' && tempStocks && (
        <QuantityPopup
          title="📈 주식 보유 수량"
          items={tempStocks}
          labels={STOCK_LABELS}
          colors={STOCK_COLORS}
          images={STOCK_IMAGES}
          imageDir="stock"
          onChange={setTempStocks}
          onConfirm={confirmStocks}
          onClose={() => setActivePopup(null)}
          isSequential={isSequential}
        />
      )}
      {activePopup === 'realEstate' && tempRealEstate && (
        <QuantityPopup
          title="🏠 부동산 보유 수량"
          items={tempRealEstate}
          labels={REAL_ESTATE_LABELS}
          colors={REAL_ESTATE_COLORS}
          images={ESTATE_IMAGES}
          imageDir="estate"
          onChange={setTempRealEstate}
          onConfirm={confirmRealEstate}
          onClose={() => setActivePopup(null)}
          isSequential={isSequential}
        />
      )}
      {activePopup === 'job' && (
        <JobPopup onSelect={selectJob} onClose={() => setActivePopup(null)} />
      )}
      {activePopup === 'badges' && (
        <BadgePopup
          badges={gameState.badges}
          onConfirm={confirmBadges}
          onClose={() => setActivePopup(null)}
          isSequential={isSequential}
        />
      )}
    </div>
  )
}

function CashPopup({ value, onChange, onConfirm, onClose, isSequential }) {
  const [input, setInput] = useState(value > 0 ? String(value) : '')

  function press(key) {
    if (key === '←') {
      setInput(prev => prev.slice(0, -1))
    } else if (key === '00') {
      setInput(prev => (prev === '' ? '' : prev + '00'))
    } else {
      setInput(prev => (prev === '0' ? key : prev + key))
    }
  }

  function handleConfirm() {
    onChange(input === '' ? 0 : Number(input))
    onConfirm()
  }

  const display = input === '' ? '0' : Number(input).toLocaleString()

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '←']

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>💵 현금</div>
        <div className={styles.cashDisplay}>{display}원</div>
        <div className={styles.numpad}>
          {KEYS.map(k => (
            <button key={k} className={styles.numpadKey} onClick={() => press(k)}>
              {k}
            </button>
          ))}
        </div>
        <div className={styles.popupActions}>
          {!isSequential && <button className={styles.cancelBtn} onClick={onClose}>취소</button>}
          <button className={styles.confirmBtn} onClick={handleConfirm}>
            {isSequential ? '완료' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuantityPopup({ title, items, labels, colors, images, imageDir, onChange, onConfirm, onClose, isSequential }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>{title}</div>
        <div className={styles.quantityList}>
          {Object.keys(labels).map(key => {
            const qty = items[key]
            return (
              <div key={key} className={styles.quantityItem}>
                <div className={styles.quantityRow}>
                  <span className={styles.quantityLabel}>{labels[key]}</span>
                  <span className={styles.quantityCount} style={{ color: colors?.[key] }}>{qty}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={qty}
                  className={styles.qtySlider}
                  style={{ accentColor: colors?.[key] }}
                  onChange={e => onChange(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                />
                {images && imageDir && qty > 0 && (
                  <div className={styles.qtyImages}>
                    {Array.from({ length: qty }, (_, i) => (
                      <img
                        key={i}
                        src={`/badges/${imageDir}/${images[key]}.png`}
                        alt={images[key]}
                        className={styles.qtyImg}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className={styles.popupActions}>
          {!isSequential && <button className={styles.cancelBtn} onClick={onClose}>취소</button>}
          <button className={styles.confirmBtn} onClick={onConfirm}>
            {isSequential ? '다음' : '확인'}
          </button>
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

function BadgePopup({ badges, onConfirm, onClose, isSequential }) {
  const [tempBadges, setTempBadges] = useState([...badges])

  function toggle(i) {
    setTempBadges(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitle}>🏅 성공카드</div>
        <div className={styles.badgeGrid}>
          {BADGE_NAMES.map((name, i) => (
            <button key={name} className={styles.badgeBtn} onClick={() => toggle(i)}>
              <img
                src={`/badges/${name}.png`}
                alt={name}
                className={`${styles.badgeImg} ${!tempBadges[i] ? styles.badgeLocked : ''}`}
              />
              {!tempBadges[i] && <span className={styles.lockIcon}>🔒</span>}
            </button>
          ))}
        </div>
        <div className={styles.popupActions}>
          {!isSequential && <button className={styles.cancelBtn} onClick={onClose}>취소</button>}
          <button className={styles.confirmBtn} onClick={() => onConfirm(tempBadges)}>
            {isSequential ? '다음' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
