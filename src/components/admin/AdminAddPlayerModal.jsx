import { useState, useRef } from 'react'
import BackButton from '../BackButton'
import StepBar from '../StepBar'
import JobPicker from '../JobPicker'
import BadgePicker from '../BadgePicker'
import AssetListEditor from '../AssetListEditor'
import NumberInputModal from '../NumberInputModal'
import CharacterCard from '../CharacterCard'
import ConfirmDialog from './ConfirmDialog'
import { CHARACTERS } from '../../constants/characters'
import { DEFAULT_PRICES } from '../PriceSettingModal'
import {
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES, MAX_CASH,
} from '../../constants/gameData'
import { adminFetch } from '../../utils/adminAuth'
import nameStyles from '../../pages/NameInput.module.css'
import characterStyles from '../../pages/CharacterSelect.module.css'
import assetStyles from '../../pages/IndividualPage.module.css'
import styles from './AdminAddPlayerModal.module.css'

// 참가자가 실제로 거치는 화면(NameInput → CharacterSelect → IndividualPage)과
// 똑같이 보이도록 각 화면의 CSS 모듈을 그대로 가져다 쓴다. 자산 입력 단계의
// StepBar도 참가자 화면과 같은 5단계다.
const STEP_NAME = 0
const STEP_CHARACTER = 1
const ASSET_STEP_OFFSET = 2
const ASSET_STEPS = ['직업', '성공열쇠', '주식', '부동산', '현금']
const LAST_STEP = ASSET_STEP_OFFSET + ASSET_STEPS.length - 1

function defaultDraft() {
  return {
    name: '', character: null, job: null,
    badges: [false, false, false, false, false, false],
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
  }
}

function priceLabelsFor(prices, category) {
  return Object.fromEntries(Object.entries(DEFAULT_PRICES[category]).map(([key, defaultPrice]) => [
    key, `${(prices?.[category]?.[key] ?? defaultPrice).toLocaleString('ko-KR')}원`,
  ]))
}

export default function AdminAddPlayerModal({ code, prices, onSaved, onClose }) {
  const [step, setStep] = useState(STEP_NAME)
  const [completedUpTo, setCompletedUpTo] = useState(-1)
  const [draft, setDraft] = useState(defaultDraft)
  const [cashDisplay, setCashDisplay] = useState('0')
  const [showCashModal, setShowCashModal] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saving, setSaving] = useState(false)
  const frameRef = useRef(null)

  const assetStep = step - ASSET_STEP_OFFSET

  async function handleFinish() {
    if (saving) return
    setSaving(true)
    const cash = Math.min(parseInt(cashDisplay, 10) || 0, MAX_CASH)
    const res = await adminFetch(`/api/admin/rooms/${code}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim(),
        character: draft.character,
        job: draft.job,
        badges: draft.badges,
        stocks: draft.stocks,
        realEstate: draft.realEstate,
        cash,
      }),
    })
    setSaving(false)
    if (!res.ok) return
    onSaved()
  }

  function handleNext() {
    if (step === STEP_NAME && !draft.name.trim()) return
    if (step === STEP_CHARACTER && !draft.character) return
    if (step === LAST_STEP) { handleFinish(); return }
    if (assetStep >= 0) setCompletedUpTo(prev => Math.max(prev, assetStep))
    setStep(step + 1)
  }

  // 뒤로 가기는 한 단계씩 되돌아가고, 첫 단계에서는 입력 취소를 확인한다.
  function handleBack() {
    if (step === STEP_NAME) { setConfirmCancel(true); return }
    setStep(step - 1)
  }

  function renderAssetStep() {
    return (
      <div className={`${assetStyles.page} ${assetStyles.pageFill}`}>
        <BackButton onClick={handleBack} />
        <StepBar
          steps={ASSET_STEPS}
          currentStep={assetStep}
          completedUpTo={completedUpTo}
          onStepClick={completedUpTo >= 0 ? i => setStep(ASSET_STEP_OFFSET + i) : undefined}
        />
        <hr className={assetStyles.divider} />

        {assetStep === 0 && (
          <div className={`${assetStyles.stepContent} ${assetStyles.stepContentFill}`}>
            <h1 className={assetStyles.stepTitle}>직업 선택</h1>
            <p className={assetStyles.stepSubtitle}>나의 직업을 선택해주세요</p>
            <div className={assetStyles.fillWrapper}>
              <JobPicker fill value={draft.job} onChange={job => setDraft(prev => ({ ...prev, job }))} />
            </div>
          </div>
        )}

        {assetStep === 1 && (
          <div className={`${assetStyles.stepContent} ${assetStyles.stepContentFill}`}>
            <h1 className={assetStyles.stepTitle}>성공열쇠</h1>
            <p className={assetStyles.stepSubtitle}>획득한 성공열쇠를 모두 선택해주세요</p>
            <div className={assetStyles.fillWrapper}>
              <BadgePicker
                fill
                badges={draft.badges}
                onToggle={i => setDraft(prev => {
                  const badges = [...prev.badges]
                  badges[i] = !badges[i]
                  return { ...prev, badges }
                })}
              />
            </div>
          </div>
        )}

        {assetStep === 2 && (
          <div className={`${assetStyles.stepContent} ${assetStyles.stepContentFill}`}>
            <h1 className={assetStyles.stepTitle}>주식</h1>
            <p className={assetStyles.stepSubtitle}>보유 수량을 선택해주세요</p>
            <div className={assetStyles.fillWrapper}>
              <AssetListEditor
                fill
                labels={STOCK_LABELS}
                images={STOCK_IMAGES}
                priceLabels={priceLabelsFor(prices, 'stocks')}
                imageFolder="stock"
                values={draft.stocks}
                onChange={(key, val) => setDraft(prev => ({ ...prev, stocks: { ...prev.stocks, [key]: val } }))}
              />
            </div>
          </div>
        )}

        {assetStep === 3 && (
          <div className={`${assetStyles.stepContent} ${assetStyles.stepContentFill}`}>
            <h1 className={assetStyles.stepTitle}>부동산</h1>
            <p className={assetStyles.stepSubtitle}>보유 수량을 선택해주세요</p>
            <div className={assetStyles.fillWrapper}>
              <AssetListEditor
                fill
                labels={REAL_ESTATE_LABELS}
                images={ESTATE_IMAGES}
                priceLabels={priceLabelsFor(prices, 'realEstate')}
                imageFolder="estate"
                values={draft.realEstate}
                onChange={(key, val) => setDraft(prev => ({ ...prev, realEstate: { ...prev.realEstate, [key]: val } }))}
              />
            </div>
          </div>
        )}

        {assetStep === 4 && (
          <div className={`${assetStyles.stepContent} ${assetStyles.stepContentFill}`}>
            <h1 className={assetStyles.stepTitle}>현금</h1>
            <p className={assetStyles.stepSubtitle}>보유 현금을 입력해주세요</p>
            <div className={assetStyles.fillWrapper}>
              <div className={assetStyles.cashCard}>
                <span className={assetStyles.cashLabel}>현금 (원)</span>
                <button type="button" className={assetStyles.cashInputBtn} onClick={() => setShowCashModal(true)}>
                  {cashDisplay === '0' ? (
                    <span className={assetStyles.cashPlaceholder}>예: 5000</span>
                  ) : (
                    <span className={assetStyles.cashValue}>{Number(cashDisplay).toLocaleString()}원</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={assetStyles.bottomBar}>
          <button className={assetStyles.nextBtn} onClick={handleNext} disabled={saving}>
            {step === LAST_STEP ? '완료' : '다음'}
          </button>
        </div>

        {showCashModal && (
          <NumberInputModal
            title="현금 입력"
            initialValue={Number(cashDisplay)}
            unit="원"
            maxValue={MAX_CASH}
            onConfirm={val => { setCashDisplay(String(val)); setShowCashModal(false) }}
            onClose={() => setShowCashModal(false)}
            portalTarget={frameRef.current}
          />
        )}
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setConfirmCancel(true) }}>
      <div ref={frameRef} className={styles.frame} role="dialog" aria-modal="true" aria-label="팀원 직접 등록">
        {step === STEP_NAME && (
          <div className={nameStyles.page}>
            <BackButton onClick={handleBack} />
            <div className={nameStyles.header}>
              <h1 className={nameStyles.title}>팀원 등록</h1>
              <p className={nameStyles.subtitle}>등록할 팀원의 이름을 입력해주세요</p>
            </div>
            <div className={nameStyles.card}>
              <div className={nameStyles.inputGroup}>
                <label className={nameStyles.label} htmlFor="admin-add-player-name">이름을 입력하세요</label>
                <input
                  id="admin-add-player-name"
                  className={nameStyles.input}
                  placeholder="예) 홍길동"
                  value={draft.name}
                  onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleNext()}
                  maxLength={20}
                />
              </div>
              <button className={nameStyles.gradBtn} onClick={handleNext} disabled={!draft.name.trim()}>
                다음 →
              </button>
            </div>
          </div>
        )}

        {step === STEP_CHARACTER && (
          <div className={characterStyles.page}>
            <BackButton onClick={handleBack} />
            <div className={characterStyles.header}>
              <h2 className={characterStyles.title}>캐릭터 선택</h2>
              <p className={characterStyles.subtitle}>이 팀원을 대표할 동물 캐릭터를 골라보세요</p>
            </div>
            <hr className={characterStyles.divider} />
            <div className={characterStyles.gridWrapper}>
              <div className={characterStyles.grid}>
                {CHARACTERS.map(id => (
                  <CharacterCard
                    key={id}
                    id={id}
                    state={draft.character === id ? 'selected' : 'idle'}
                    onSelect={character => setDraft(prev => ({ ...prev, character }))}
                  />
                ))}
              </div>
            </div>
            <div className={characterStyles.bottomBar}>
              <button className={characterStyles.ctaBtn} onClick={handleNext} disabled={!draft.character}>
                다음
              </button>
            </div>
          </div>
        )}

        {assetStep >= 0 && renderAssetStep()}
      </div>

      {confirmCancel && (
        <ConfirmDialog
          tone="danger"
          title="입력 취소"
          description="지금까지 입력한 내용이 사라집니다. 취소하시겠습니까?"
          confirmLabel="취소하기"
          cancelLabel="계속 입력"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={onClose}
        />
      )}
    </div>
  )
}
