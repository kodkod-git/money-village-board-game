import { useState, useEffect, useRef } from 'react'
import StepBar from './StepBar'
import JobPicker from './JobPicker'
import BadgePicker from './BadgePicker'
import AssetListEditor from './AssetListEditor'
import NumberInputModal from './NumberInputModal'
import { DEFAULT_PRICES } from './PriceSettingModal'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES, MAX_CASH,
} from '../constants/gameData'
import styles from '../pages/IndividualPage.module.css'

const STEPS = ['직업', '성공열쇠', '주식', '부동산', '현금']
const VISITED_KEY_BY_STEP = { 0: 'jobVisited', 1: 'badgesVisited', 2: 'stocksVisited', 3: 'realEstateVisited' }

function priceLabels(prices, category) {
  return Object.fromEntries(Object.entries(DEFAULT_PRICES[category]).map(([key, defaultPrice]) => [
    key, `${(prices?.[category]?.[key] ?? defaultPrice).toLocaleString('ko-KR')}원`,
  ]))
}

export function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    jobVisited: false, badgesVisited: false, stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}

export function computeCompletedUpTo(gameState) {
  let upTo = -1
  if (gameState.job !== null || gameState.jobVisited) upTo = 0
  if (gameState.badgesVisited) upTo = 1
  if (gameState.stocksVisited) upTo = 2
  if (gameState.realEstateVisited) upTo = 3
  if (gameState.isCompleted) upTo = 4
  return upTo
}

// 직업 → 성공열쇠 → 주식 → 부동산 → 현금 입력 단계. 일반 모드(IndividualPage)와 경쟁 모드(CompetitionPlay)가 함께 쓴다.
// syncToken: 부모가 서버에서 상태를 다시 받아올 때마다 올리면 완료 단계·현금 표시를 그 상태에 맞춘다.
// hidePrices: 경쟁 모드는 입력 시점에 팀·가격이 정해지지 않으므로 수량만 받는다.
export default function AssetInputSteps({ gameState, onChange, onComplete, prices, hidePrices = false, syncToken = 0 }) {
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(() => computeCompletedUpTo(gameState))
  const [cashDisplay, setCashDisplay] = useState(() => String(gameState.cash ?? 0))
  const [showCashModal, setShowCashModal] = useState(false)

  const latestGameState = useRef(gameState)
  latestGameState.current = gameState
  useEffect(() => {
    setCompletedUpTo(computeCompletedUpTo(latestGameState.current))
    setCashDisplay(String(latestGameState.current.cash ?? 0))
  }, [syncToken])

  function handleNext() {
    if (step === 4) { handleComplete(); return }

    const visitedKey = VISITED_KEY_BY_STEP[step]
    if (visitedKey && !gameState[visitedKey]) onChange({ ...gameState, [visitedKey]: true })

    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  function handleComplete() {
    const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
    onComplete({ ...gameState, cash: cashVal, isCompleted: true })
  }

  const noPrices = {}

  return (
    <>
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
            <JobPicker fill value={gameState.job} onChange={job => onChange({ ...gameState, job })} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>성공열쇠</h1>
          <p className={styles.stepSubtitle}>획득한 성공열쇠를 모두 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <BadgePicker
              fill
              badges={gameState.badges}
              onToggle={i => {
                const badges = [...gameState.badges]
                badges[i] = !badges[i]
                onChange({ ...gameState, badges })
              }}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>부동산</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={REAL_ESTATE_LABELS}
              images={ESTATE_IMAGES}
              priceLabels={hidePrices ? noPrices : priceLabels(prices, 'realEstate')}
              imageFolder="estate"
              values={gameState.realEstate}
              onChange={(key, val) => {
                const realEstate = { ...gameState.realEstate, [key]: val }
                onChange({ ...gameState, realEstate, realEstateVisited: true })
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>주식</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={STOCK_LABELS}
              images={STOCK_IMAGES}
              priceLabels={hidePrices ? noPrices : priceLabels(prices, 'stocks')}
              imageFolder="stock"
              values={gameState.stocks}
              onChange={(key, val) => {
                const stocks = { ...gameState.stocks, [key]: val }
                onChange({ ...gameState, stocks, stocksVisited: true })
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
              <button type="button" className={styles.cashInputBtn} onClick={() => setShowCashModal(true)}>
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
              maxValue={MAX_CASH}
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
        <button className={styles.nextBtn} onClick={handleNext}>
          {step === 4 ? '완료' : '다음'}
        </button>
      </div>
    </>
  )
}
