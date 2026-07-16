import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import StepBar from '../components/StepBar'
import AssetCard from '../components/AssetCard'
import NumberInputModal from '../components/NumberInputModal'
import { useSocketContext } from '../contexts/SocketContext'
import styles from './IndividualPage.module.css'

const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}
const JOB_ICONS = { a: '💼', b: '⚙️', c: '🏥', d: '🎨', e: '🛒', f: '🚚' }

const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']
const BADGE_LABELS = {
  communication: '의사소통 및 협상능력', global: '글로벌경제이해력',
  idea: '문제해결능력', money: '재정관리능력',
  thinking: '기업가정신', trust: '신용과 신뢰',
}

const REAL_ESTATE_LABELS = {
  gaon: '단독 가온개미', nuri: '단독 누리고양이', dami: '다세대 다미원숭이',
  maru: '다세대 마루수리', chorong: '아파트 초롱부엉이', hani: '아파트 하늬여우',
}
const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
const ESTATE_PRICES = {
  gaon: '2만원', nuri: '2만원', dami: '7만원',
  maru: '7만원', chorong: '10만원', hani: '10만원',
}

const STOCK_LABELS = {
  semiconductor: '반도체·IT', finance: '금융', industrial: '산업재·기계',
  auto: '자동차·쇼핑', bio: '바이오·헬스케어', content: '콘텐츠·플랫폼',
}
const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}

export default function IndividualPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  const [player, setPlayer] = useState(null)
  const [gameState, setGameState] = useState(defaultGameState)
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)
  const [cashDisplay, setCashDisplay] = useState('0')
  const [showCashModal, setShowCashModal] = useState(false)

  useEffect(() => {
    if (!socket) return
    fetch(`/api/rooms/${code}`)
      .then(r => r.json())
      .then(data => {
        const me = data.players?.find(p => p.socketId === socket.id)
        if (me) {
          setPlayer(me)
          const gs = me.gameState ?? defaultGameState()
          setGameState(gs)
          setCashDisplay(String(gs.cash ?? 0))
          if (gs.job !== null) setCompletedUpTo(4)
          return
        }
        const stored = JSON.parse(localStorage.getItem('player_profile') || 'null')
        const playerUuid = localStorage.getItem('player_uuid')
        if (!stored || stored.code !== code) { navigate(`/lobby/${code}`); return }
        socket.emit('join-room', {
          code, name: stored.name, affiliation: stored.affiliation,
          character: stored.character, isHost: false, playerUuid,
        }, ({ ok }) => {
          if (!ok) { navigate(`/lobby/${code}`); return }
          fetch(`/api/rooms/${code}`)
            .then(r => r.json())
            .then(data2 => {
              const me2 = data2.players?.find(p => p.socketId === socket.id)
              if (!me2) { navigate(`/lobby/${code}`); return }
              setPlayer(me2)
              const gs = me2.gameState ?? defaultGameState()
              setGameState(gs)
              setCashDisplay(String(gs.cash ?? 0))
              if (gs.job !== null) setCompletedUpTo(4)
            })
            .catch(() => navigate(`/lobby/${code}`))
        })
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

  function handleNext() {
    if (step === 0 && !gameState.job) return
    if (step === 4) { handleComplete(); return }
    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  function handleComplete() {
    const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
    const next = { ...gameState, cash: cashVal, isCompleted: true }
    setGameState(next)
    emitState(next)
    navigate(`/lobby/${code}`)
  }

  if (!player) return null

  return (
    <div className={styles.page}>
      <BackButton />
      <StepBar
        steps={STEPS}
        currentStep={step}
        completedUpTo={completedUpTo}
        onStepClick={completedUpTo >= 0 ? i => setStep(i) : undefined}
      />
      <hr className={styles.divider} />

      {step === 0 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>직업 선택</h1>
          <p className={styles.stepSubtitle}>나의 직업을 선택해주세요</p>
          <div className={styles.jobGrid}>
            {Object.entries(JOB_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.jobTile} ${gameState.job === key ? styles.tileSelected : ''}`}
                onClick={() => {
                  const next = { ...gameState, job: key }
                  setGameState(next)
                  emitState(next)
                }}
              >
                {gameState.job === key && <span className={styles.tileBadge}>✓</span>}
                <span className={styles.jobIcon}>{JOB_ICONS[key]}</span>
                <span className={styles.tileLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>성공카드</h1>
          <p className={styles.stepSubtitle}>획득한 성공카드를 모두 선택해주세요</p>
          <div className={`${styles.jobGrid} ${styles.badgeGrid}`}>
            {BADGE_NAMES.map((name, i) => (
              <button
                key={name}
                className={`${styles.jobTile} ${styles.badgeTile} ${gameState.badges[i] ? styles.tileSelected : ''}`}
                onClick={() => {
                  const badges = [...gameState.badges]
                  badges[i] = !badges[i]
                  const next = { ...gameState, badges }
                  setGameState(next)
                  emitState(next)
                }}
              >
                {gameState.badges[i] && <span className={styles.tileBadge}>✓</span>}
                <img src={`/badges/${name}.png`} alt={name} className={styles.badgeImg} />
                <span className={styles.tileLabel}>{BADGE_LABELS[name]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>부동산</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.assetList}>
            {Object.keys(REAL_ESTATE_LABELS).map(key => (
              <AssetCard
                key={key}
                image={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                label={REAL_ESTATE_LABELS[key]}
                price={ESTATE_PRICES[key]}
                value={gameState.realEstate[key]}
                onChange={val => {
                  const realEstate = { ...gameState.realEstate, [key]: val }
                  const next = { ...gameState, realEstate, realEstateVisited: true }
                  setGameState(next)
                  emitState(next)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>주식</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.assetList}>
            {Object.keys(STOCK_LABELS).map(key => (
              <AssetCard
                key={key}
                image={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                label={STOCK_LABELS[key]}
                price="가격 설정"
                value={gameState.stocks[key]}
                onChange={val => {
                  const stocks = { ...gameState.stocks, [key]: val }
                  const next = { ...gameState, stocks, stocksVisited: true }
                  setGameState(next)
                  emitState(next)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className={styles.stepContent}>
          <h1 className={styles.stepTitle}>현금</h1>
          <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
          <div className={styles.cashCard}>
            <span className={styles.cashLabel}>현금 (원)</span>
            <button
              type="button"
              className={styles.cashInputBtn}
              onClick={() => setShowCashModal(true)}
            >
              {cashDisplay === '0' ? (
                <span className={styles.cashPlaceholder}>예: 5000</span>
              ) : (
                <span className={styles.cashValue}>{Number(cashDisplay).toLocaleString()}원</span>
              )}
            </button>
          </div>

          {showCashModal && (
            <NumberInputModal
              title="현금 입력"
              initialValue={Number(cashDisplay)}
              unit="원"
              onConfirm={val => {
                setCashDisplay(String(val))
                setShowCashModal(false)
              }}
              onClose={() => setShowCashModal(false)}
            />
          )}
        </div>
      )}

      <div className={styles.bottomBar}>
        <button
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={step === 0 && !gameState.job}
        >
          {step === 4 ? '완료' : '다음'}
        </button>
      </div>
    </div>
  )
}
