import { useRef, useState } from 'react'
import { resolveOfficialPlayer } from '../utils/officialPlayer'

const ERROR_MESSAGE = '참가자 확인 중 오류가 발생했어요. 다시 시도해 주세요.'

// 대회 실명 확인 흐름. 참가자 이름 입력(NameInput)과 관리자 수동 추가 모달이 함께 쓴다.
// submit/confirm은 공식 참가자 id가 정해지면 그 id를, 아니면(확인 대기·오류) null을 돌려준다.
export default function useOfficialNameResolve(classId) {
  const [pendingName, setPendingName] = useState(null)
  const [confirmLabel, setConfirmLabel] = useState(null)
  const [duplicateNotice, setDuplicateNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  async function run(name, confirm) {
    if (inFlight.current) return null
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const data = await resolveOfficialPlayer(classId, name, confirm)
      if (data.exists) {
        setPendingName(name)
        setConfirmLabel(data.label)
        return null
      }
      setPendingName(null)
      setConfirmLabel(null)
      setDuplicateNotice(false)
      return data.officialPlayerId
    } catch {
      setError(ERROR_MESSAGE)
      return null
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return {
    busy,
    error,
    confirmLabel,
    duplicateNotice,
    submit: name => {
      setDuplicateNotice(false)
      return run(name, false)
    },
    confirm: () => (pendingName ? run(pendingName, true) : Promise.resolve(null)),
    clearMessages: () => {
      setDuplicateNotice(false)
      setError('')
    },
    reject: () => {
      setPendingName(null)
      setConfirmLabel(null)
      setDuplicateNotice(true)
    },
  }
}
