// 관리자 메뉴 "EFTI 성향기록": [입력] [결과] 두 탭.
import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import SheetEditor from './SheetEditor'
import ResultsTable from './ResultsTable'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import styles from './EftiRecord.module.css'

const TABS = [
  { key: 'input', label: '입력' },
  { key: 'results', label: '결과' },
]

export default function EftiRecordPage({ profile, onDirtyChange }) {
  const [tab, setTab] = useState('input')
  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState(null)
  const [target, setTarget] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState(null)

  useEffect(() => {
    api.fetchQuestions()
      .then(setQuestions)
      .catch(() => setError('문항을 불러오지 못했어요. Exposed schemas 설정을 확인해 주세요'))
  }, [])

  // 화면이 사라지면(예: 창이 좁아져 PC 전용 안내로 바뀜) 저장 안 한 변경 표시도 함께 지운다.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const handleDirty = useCallback(value => {
    setDirty(value)
    onDirtyChange?.(value)
  }, [onDirtyChange])

  function goTo(next) {
    if (next !== 'input') {
      handleDirty(false)
      // 입력 탭을 떠나면 열려던 기록지 지정도 지운다. 남겨 두면 다시 돌아왔을 때 옛 기록지가 또 열린다.
      setTarget(null)
    }
    setTab(next)
  }

  function switchTab(next) {
    if (next === tab) return
    if (dirty) setPendingTab(next)
    else goTo(next)
  }

  function openFromResults(t) {
    setTarget(t)
    setTab('input')
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>EFTI 성향기록</h1>
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className={`${styles.status} ${styles.statusError}`}>{error}</p>}
      {questions && tab === 'input' && (
        <SheetEditor questions={questions} profile={profile} target={target} onDirtyChange={handleDirty} />
      )}
      {questions && tab === 'results' && <ResultsTable profile={profile} onOpen={openFromResults} />}

      {pendingTab && (
        <ConfirmDialog
          title="저장하지 않은 내용이 있어요"
          description="계속하면 입력한 내용이 사라져요."
          cancelLabel="취소"
          confirmLabel="계속"
          onCancel={() => setPendingTab(null)}
          onConfirm={() => { const next = pendingTab; setPendingTab(null); goTo(next) }}
        />
      )}
    </div>
  )
}
