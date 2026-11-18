import { useState, useEffect, useRef } from 'react'
import StepBar from './StepBar'
import JobPicker from './JobPicker'
import BadgePicker from './BadgePicker'
import AssetListEditor from './AssetListEditor'
import NumberInputModal from './NumberInputModal'
import { DEFAULT_PRICES } from './PriceSettingModal'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_IMAGES, MAX_CASH, stockLabelsFor,
} from '../constants/gameData'
import styles from '../pages/IndividualPage.module.css'

// 입력 단계. 5판 게임은 부동산 없이 진행하므로 부동산 단계를 건너뛴다.
const ALL_STEPS = [
  { key: 'job', label: '직업', visitedKey: 'jobVisited' },
  { key: 'badges', label: '성공열쇠', visitedKey: 'badgesVisited' },
  { key: 'stocks', label: '주식', visitedKey: 'stocksVisited' },
  { key: 'realEstate', label: '부동산', visitedKey: 'realEstateVisited' },
  { key: 'cash', label: '현금' },
]

export function assetSteps(hideRealEstate = false) {
  return hideRealEstate ? ALL_STEPS.filter(s => s.key !== 'realEstate') : ALL_STEPS
}

function priceLabels(prices, category) {
  return Object.fromEntries(Object.entries(DEFAULT_PRICES[category]).map(([key, defaultPrice]) => [
    key, `${(prices?.[category]?.[key] ?? defaultPrice).toLocaleString('ko-KR')}원`,
  ]))
}

export function defaultGameState() {
  return {
    cash: 0, job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0, beauty: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    jobVisited: false, badgesVisited: false, stocksVisited: false, realEstateVisited: false, isCompleted: false,
  }
}

function isStepDone(stepKey, gameState) {
  if (stepKey === 'job') return gameState.job !== null || gameState.jobVisited
  if (stepKey === 'cash') return gameState.isCompleted
  const { visitedKey } = ALL_STEPS.find(s => s.key === stepKey)
  return Boolean(gameState[visitedKey])
}

export function computeCompletedUpTo(gameState, hideRealEstate = false) {
  let upTo = -1
  assetSteps(hideRealEstate).forEach((s, i) => {
    if (isStepDone(s.key, gameState)) upTo = i
  })
  return upTo
}

// 직업 → 성공열쇠 → 주식 → 부동산 → 현금 입력 단계(IndividualPage).
// hideRealEstate: 5판 게임이면 부동산 단계를 건너뛴다.
// syncToken: 부모가 서버에서 상태를 다시 받아올 때마다 올리면 완료 단계·현금 표시를 그 상태에 맞춘다.
export default function AssetInputSteps({ gameState, onChange, onComplete, prices, syncToken = 0, hideRealEstate = false }) {
  const steps = assetSteps(hideRealEstate)
  const lastStep = steps.length - 1
  const [step, setStep] = useState(0)
  const stepKey = steps[Math.min(step, lastStep)].key
  const [completedUpTo, setCompletedUpTo] = useState(() => computeCompletedUpTo(gameState, hideRealEstate))
  const [cashDisplay, setCashDisplay] = useState(() => String(gameState.cash ?? 0))
  const [showCashModal, setShowCashModal] = useState(false)

  const latestGameState = useRef(gameState)
  latestGameState.current = gameState
  useEffect(() => {
    setCompletedUpTo(computeCompletedUpTo(latestGameState.current, hideRealEstate))
    setCashDisplay(String(latestGameState.current.cash ?? 0))
  }, [syncToken, hideRealEstate])

  function handleNext() {
    if (step >= lastStep) { handleComplete(); return }

    const visitedKey = steps[step].visitedKey
    if (visitedKey && !gameState[visitedKey]) onChange({ ...gameState, [visitedKey]: true })

    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  function handleComplete() {
    const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
    onComplete({ ...gameState, cash: cashVal, isCompleted: true })
  }

  return (
    <>
      <StepBar
        steps={steps.map(s => s.label)}
        currentStep={step}
        completedUpTo={completedUpTo}
        onStepClick={completedUpTo >= 0 ? i => setStep(i) : undefined}
      />
      <hr className={styles.divider} />

      {stepKey === 'job' && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>직업 선택</h1>
          <p className={styles.stepSubtitle}>나의 직업을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <JobPicker fill value={gameState.job} onChange={job => onChange({ ...gameState, job })} />
          </div>
        </div>
      )}

      {stepKey === 'badges' && (
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

      {stepKey === 'realEstate' && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>부동산</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={REAL_ESTATE_LABELS}
              images={ESTATE_IMAGES}
              priceLabels={priceLabels(prices, 'realEstate')}
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

      {stepKey === 'stocks' && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <h1 className={styles.stepTitle}>주식</h1>
          <p className={styles.stepSubtitle}>보유 수량을 선택해주세요</p>
          <div className={styles.fillWrapper}>
            <AssetListEditor
              fill
              labels={stockLabelsFor(hideRealEstate)}
              images={STOCK_IMAGES}
              priceLabels={priceLabels(prices, 'stocks')}
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

      {stepKey === 'cash' && (
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
          {step >= lastStep ? '완료' : '다음'}
        </button>
      </div>
    </>
  )
}
