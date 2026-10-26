import { useState, useEffect, useRef } from 'react'
import StepBar from './StepBar'
import JobPicker from './JobPicker'
import BadgePicker from './BadgePicker'
import AssetListEditor from './AssetListEditor'
import NumberInputModal from './NumberInputModal'
import PriceListEditor from './PriceListEditor'
import { DEFAULT_PRICES } from './PriceSettingModal'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES, MAX_CASH,
} from '../constants/gameData'
import styles from '../pages/IndividualPage.module.css'

const STEP_LABELS = {
  job: '직업', badges: '성공열쇠', stockPrices: '주식 가격', stocks: '주식',
  realEstatePrices: '부동산 가격', realEstate: '부동산', cash: '현금',
}
const NORMAL_STEPS = ['job', 'badges', 'stocks', 'realEstate', 'cash']
// 경쟁 모드는 참여자가 직접 가격을 정하므로 수량 입력 앞에 가격 단계를 둔다.
const COMPETITION_STEPS = ['job', 'badges', 'stockPrices', 'stocks', 'realEstatePrices', 'realEstate', 'cash']
const VISITED_KEY_BY_STEP = { job: 'jobVisited', badges: 'badgesVisited', stocks: 'stocksVisited', realEstate: 'realEstateVisited' }
const PRICE_CATEGORY_BY_STEP = { stockPrices: 'stocks', realEstatePrices: 'realEstate' }

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

// 저장된 방문 표시로 어느 단계까지 마쳤는지(steps 안의 인덱스) 계산한다.
// 가격 단계는 따로 표시가 없어 뒤 단계를 마쳤으면 함께 마친 것으로 본다.
export function computeCompletedUpTo(gameState, steps = NORMAL_STEPS) {
  const done = {
    job: gameState.job !== null || gameState.jobVisited,
    badges: gameState.badgesVisited,
    stocks: gameState.stocksVisited,
    realEstate: gameState.realEstateVisited,
    cash: gameState.isCompleted,
  }
  let upTo = -1
  steps.forEach((key, idx) => { if (done[key]) upTo = idx })
  return upTo
}

// 직업 → 성공열쇠 → 주식 → 부동산 → 현금 입력 단계. 일반 모드(IndividualPage)와 경쟁 모드(CompetitionPlay)가 함께 쓴다.
// syncToken: 부모가 서버에서 상태를 다시 받아올 때마다 올리면 완료 단계·현금 표시를 그 상태에 맞춘다.
// editablePrices: 경쟁 모드. 참여자가 주식·부동산 가격을 직접 정하는 단계를 넣고, 수량 단계에 gameState.prices를 보여준다.
export default function AssetInputSteps({ gameState, onChange, onComplete, prices, editablePrices = false, syncToken = 0 }) {
  const steps = editablePrices ? COMPETITION_STEPS : NORMAL_STEPS
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(() => computeCompletedUpTo(gameState, steps))
  const [cashDisplay, setCashDisplay] = useState(() => String(gameState.cash ?? 0))
  const [showCashModal, setShowCashModal] = useState(false)

  const latestGameState = useRef(gameState)
  latestGameState.current = gameState
  useEffect(() => {
    setCompletedUpTo(computeCompletedUpTo(latestGameState.current, steps))
    setCashDisplay(String(latestGameState.current.cash ?? 0))
    // steps는 렌더 동안 바뀌지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncToken])

  const stepKey = steps[step]
  const isLastStep = step === steps.length - 1

  function handleNext() {
    if (isLastStep) { handleComplete(); return }

    const visitedKey = VISITED_KEY_BY_STEP[stepKey]
    if (visitedKey && !gameState[visitedKey]) onChange({ ...gameState, [visitedKey]: true })

    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  function handleComplete() {
    const cashVal = parseInt(cashDisplay.replace(/[^0-9]/g, ''), 10) || 0
    onComplete({ ...gameState, cash: cashVal, isCompleted: true })
  }

  const shownPrices = editablePrices ? gameState.prices : prices
  const priceCategory = PRICE_CATEGORY_BY_STEP[stepKey]

  function handlePriceChange(category, next) {
    onChange({ ...gameState, prices: { ...gameState.prices, [category]: next } })
  }

  return (
    <>
      <StepBar
        steps={steps.map(key => STEP_LABELS[key])}
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

      {priceCategory && (
        <div className={`${styles.stepContent} ${styles.stepContentFill}`}>
          <div className={styles.priceStepHeader}>
            <h1 className={styles.stepTitle}>{STEP_LABELS[stepKey]}</h1>
            <button
              type="button"
              className={styles.priceResetBtn}
              onClick={() => handlePriceChange(priceCategory, DEFAULT_PRICES[priceCategory])}
            >
              초기화
            </button>
          </div>
          <p className={styles.stepSubtitle}>게임이 끝났을 때의 가격을 입력해주세요</p>
          <div className={styles.fillWrapper}>
            <PriceListEditor
              category={priceCategory}
              prices={gameState.prices[priceCategory]}
              onChange={next => handlePriceChange(priceCategory, next)}
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
              priceLabels={priceLabels(shownPrices, 'realEstate')}
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
              labels={STOCK_LABELS}
              images={STOCK_IMAGES}
              priceLabels={priceLabels(shownPrices, 'stocks')}
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
          {isLastStep ? '완료' : '다음'}
        </button>
      </div>
    </>
  )
}
