import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import AlertModal from '../components/AlertModal'
import useBodyClass from '../hooks/useBodyClass'
import useOfficialNameResolve from '../hooks/useOfficialNameResolve'
import { fetchEntryKind } from '../utils/officialPlayer'
import styles from './NameInput.module.css'

export default function NameInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  useBodyClass('onboarding-mode')

  const code = searchParams.get('code') ?? ''
  const classId = searchParams.get('classId') ?? ''

  // 대회(공식전)인지 판별이 끝나기 전에는 입력을 막아 일반 → 대회 화면 전환이 깜빡이지 않게 한다.
  const [entry, setEntry] = useState(null)
  const checking = entry === null && Boolean(code || classId)
  useEffect(() => {
    if (!code && !classId) return
    let cancelled = false
    fetchEntryKind({ classId, code }).then(info => { if (!cancelled) setEntry(info) })
    return () => { cancelled = true }
  }, [code, classId])

  const isOfficial = entry?.kind === 'official'
  const resolver = useOfficialNameResolve(entry?.classId ?? classId)

  function goNext(officialPlayerId) {
    const params = new URLSearchParams({ name: name.trim() })
    if (code) params.set('code', code)
    if (classId) params.set('classId', classId)
    if (officialPlayerId) params.set('officialPlayerId', officialPlayerId)
    navigate(`/select?${params}`)
  }

  async function handleNext() {
    if (!name.trim() || checking || resolver.busy || resolver.confirmLabel) return
    if (!isOfficial) { goNext(); return }
    const officialPlayerId = await resolver.submit(name.trim())
    if (officialPlayerId) goNext(officialPlayerId)
  }

  async function handleConfirmYes() {
    const officialPlayerId = await resolver.confirm()
    if (officialPlayerId) goNext(officialPlayerId)
  }

  function handleConfirmNo() {
    resolver.reject()
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.subtitle}>팀에 참가하신 것을 환영합니다!</p>
      </div>
      <div className={styles.card}>
        {isOfficial && entry.name && (
          <div className={styles.contestBadge}>
            <span aria-hidden="true">🏆</span>
            <span>{entry.name}</span>
          </div>
        )}
        <div className={styles.inputGroup}>
          <label className={styles.label}>{isOfficial ? '실명을 입력하세요' : '이름을 입력하세요'}</label>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder={isOfficial ? '예) 홍길동 (실명)' : '예) 홍길동'}
            value={name}
            onChange={e => { setName(e.target.value); resolver.clearMessages() }}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={20}
            disabled={checking}
          />
          {resolver.duplicateNotice && (
            <p className={styles.notice} role="alert">같은 이름의 참가자가 있어요. 구분할 수 있게 이름을 바꿔 주세요 (예: {name.trim()}B)</p>
          )}
          {resolver.error && <p className={styles.notice} role="alert">{resolver.error}</p>}
        </div>
        <button className={styles.gradBtn} onClick={handleNext} disabled={!name.trim() || checking || resolver.busy}>
          다음 →
        </button>
      </div>

      {resolver.confirmLabel && (
        <AlertModal
          message={`${resolver.confirmLabel} 님이 맞나요?`}
          confirmLabel="네, 맞아요"
          cancelLabel="아니요"
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      )}
    </div>
  )
}
