import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import StepBar from '../components/StepBar'
import JobPicker from '../components/JobPicker'
import BadgePicker from '../components/BadgePicker'
import AssetListEditor from '../components/AssetListEditor'
import NumberInputModal from '../components/NumberInputModal'
import { useSocketContext } from '../contexts/SocketContext'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../constants/gameData'
import styles from './IndividualPage.module.css'

const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']
const STOCK_PRICE_LABELS = Object.fromEntries(Object.keys(STOCK_LABELS).map(key => [key, '가격 설정']))

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

    function syncPlayer() {
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
          const stored = JSON.parse(sessionStorage.getItem('player_profile') || 'null')
          const playerUuid = sessionStorage.getItem('player_uuid')
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
    }

    syncPlayer()
    socket.on('connect', syncPlayer)
    return () => socket.off('connect', syncPlayer)
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

  const isFillStep = step >= 0 && step <= 4

  return (
    <div className={`${styles.page} ${isFillStep ? styles.pageFill : ''}`}>
      <BackButton />
      <StepBar
        steps={STEPS}
        currentStep={step}
        completedUpTo={completedUpTo}
        onStepClick={completedUpTo >= 0 ? i => setStep(i) : undefined}
      />
      <hr className={styles.divider} />

      {step === 0 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>직업 선택</h1>
          <p className={styles.stepSubtitle}>나의 직업을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <JobPicker
              fill
              value={gameState.job}
              onChange={job => {
                const next = { ...gameState, job }
                setGameState(next)
                emitState(next)
              }}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>성공카드</h1>
          <p className={styles.stepSubtitle}>획득한 성공카드를 모두 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <BadgePicker
              fill
              badges={gameState.badges}
              onToggle={i => {
                const badges = [...gameState.badges]
                badges[i] = !badges[i]
                const next = { ...gameState, badges }
                setGameState(next)
                emitState(next)
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>부동산</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={REAL_ESTATE_LABELS}
              images={ESTATE_IMAGES}
              priceLabels={ESTATE_PRICES}
              imageFolder="estate"
              values={gameState.realEstate}
              onChange={(key, val) => {
                const realEstate = { ...gameState.realEstate, [key]: val }
                const next = { ...gameState, realEstate, realEstateVisited: true }
                setGameState(next)
                emitState(next)
              }}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>주식</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={STOCK_LABELS}
              images={STOCK_IMAGES}
              priceLabels={STOCK_PRICE_LABELS}
              imageFolder="stock"
              values={gameState.stocks}
              onChange={(key, val) => {
                const stocks = { ...gameState.stocks, [key]: val }
                const next = { ...gameState, stocks, stocksVisited: true }
                setGameState(next)
                emitState(next)
              }}
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>현금</h1>
          <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
          <div className={styles.fillWrapper}>
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
