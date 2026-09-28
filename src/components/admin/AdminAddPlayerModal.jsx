import { useState } from 'react'
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
import styles from './AdminAddPlayerModal.module.css'

// StepBar는 7개 단계 라벨을 항상 한 화면에 함께 렌더링하므로, 각 단계 본문의
// <h2> 제목과 문자열이 겹치면 테스트의 getByText가 모호해진다. 그래서 진행률
// 바에 쓰는 라벨은 본문 제목과 다른 짧은 표현으로 둔다.
const STEPS = ['이름', '캐릭터', '직업', '열쇠', '주식현황', '부동산현황', '현금현황']

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
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)
  const [draft, setDraft] = useState(defaultDraft)
  const [cashDisplay, setCashDisplay] = useState('0')
  const [showCashModal, setShowCashModal] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saving, setSaving] = useState(false)

  const isLastStep = step === STEPS.length - 1
  const canAdvance = step === 0 ? draft.name.trim().length > 0
    : step === 1 ? draft.character != null
    : true

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
    if (!canAdvance) return
    if (isLastStep) { handleFinish(); return }
    setCompletedUpTo(prev => Math.max(prev, step))
    setStep(step + 1)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="팀원 직접 등록">
        <div className={styles.header}>
          <StepBar
            steps={STEPS}
            currentStep={step}
            completedUpTo={completedUpTo}
            onStepClick={completedUpTo >= 0 ? setStep : undefined}
          />
          <button type="button" className={styles.closeBtn} onClick={() => setConfirmCancel(true)} aria-label="닫기">✕</button>
        </div>

        <div className={styles.body}>
          {step === 0 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>이름 입력</h2>
              <p className={styles.stepSubtitle}>등록할 팀원의 이름을 입력해주세요</p>
              <input
                className={styles.nameInput}
                placeholder="예) 홍길동"
                value={draft.name}
                onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                maxLength={20}
              />
            </div>
          )}

          {step === 1 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>캐릭터 선택</h2>
              <p className={styles.stepSubtitle}>이 팀원을 대표할 캐릭터를 골라주세요</p>
              <div className={styles.characterGrid}>
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
          )}

          {step === 2 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>직업 선택</h2>
              <p className={styles.stepSubtitle}>이 팀원의 직업을 선택해주세요</p>
              <JobPicker value={draft.job} onChange={job => setDraft(prev => ({ ...prev, job }))} />
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>성공열쇠</h2>
              <p className={styles.stepSubtitle}>획득한 성공열쇠를 모두 선택해주세요</p>
              <BadgePicker
                badges={draft.badges}
                onToggle={i => setDraft(prev => {
                  const badges = [...prev.badges]
                  badges[i] = !badges[i]
                  return { ...prev, badges }
                })}
              />
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>주식</h2>
              <p className={styles.stepSubtitle}>보유 수량을 입력해주세요</p>
              <AssetListEditor
                labels={STOCK_LABELS}
                images={STOCK_IMAGES}
                priceLabels={priceLabelsFor(prices, 'stocks')}
                imageFolder="stock"
                values={draft.stocks}
                onChange={(key, val) => setDraft(prev => ({ ...prev, stocks: { ...prev.stocks, [key]: val } }))}
              />
            </div>
          )}

          {step === 5 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>부동산</h2>
              <p className={styles.stepSubtitle}>보유 수량을 입력해주세요</p>
              <AssetListEditor
                labels={REAL_ESTATE_LABELS}
                images={ESTATE_IMAGES}
                priceLabels={priceLabelsFor(prices, 'realEstate')}
                imageFolder="estate"
                values={draft.realEstate}
                onChange={(key, val) => setDraft(prev => ({ ...prev, realEstate: { ...prev.realEstate, [key]: val } }))}
              />
            </div>
          )}

          {step === 6 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>현금</h2>
              <p className={styles.stepSubtitle}>보유 현금을 입력해주세요</p>
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
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.nextBtn} onClick={handleNext} disabled={!canAdvance || saving}>
            {isLastStep ? '완료' : '다음'}
          </button>
        </div>
      </div>

      {showCashModal && (
        <NumberInputModal
          title="현금 입력"
          initialValue={Number(cashDisplay)}
          unit="원"
          maxValue={MAX_CASH}
          onConfirm={val => { setCashDisplay(String(val)); setShowCashModal(false) }}
          onClose={() => setShowCashModal(false)}
        />
      )}

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
