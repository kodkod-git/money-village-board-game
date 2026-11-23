import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import SheetGrid from './SheetGrid'
import { computeResult } from '../../../shared/eftiRecord/scoring.js'
import styles from './EftiRecord.module.css'

export default function UploadPreview({ questions, preview, onCancel, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const cancelRef = useRef(null)
  const students = useMemo(() => preview.students.map((s, i) => ({ ...s, key: `u${i}` })), [preview])
  const results = useMemo(() => students.map(s => computeResult(s.answers, questions)), [students, questions])
  const badges = Object.fromEntries(students.map(s => [
    s.key, s.status === 'overwrite' ? `덮어쓰기 (바뀐 문항 ${s.changedCount}개)` : '새로 추가',
  ]))
  const h = preview.header
  const hasErrors = preview.errors.length > 0

  useEffect(() => { cancelRef.current?.focus() }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.saveSheet({
        original: null,
        header: h,
        students: preview.students.map(s => ({
          ...(s.existingId ? { id: s.existingId } : {}), nickname: s.nickname, memo: s.memo, answers: s.answers,
        })),
        deleteIds: [],
      })
      onSaved(saved)
    } catch (err) {
      setError(err?.errors?.[0]?.message ?? '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="업로드 미리보기"
        onKeyDown={e => { if (e.key === 'Escape' && !saving) onCancel() }}>
        <h2>업로드 미리보기</h2>
        <p className={styles.status}>
          {[h.className || '(반 이름 없음)', h.classTime || '(수업시간 없음)', h.completedOn || '(날짜 없음)', `선생님 ${h.teacherName}`, `학생 ${students.length}명`].join(' · ')}
        </p>
        {hasErrors && (
          <ul className={styles.errorList} aria-label="업로드 오류">
            {preview.errors.map((e, i) => <li key={i}>{e.cell ? `${e.cell}: ` : ''}{e.message}</li>)}
          </ul>
        )}
        {students.length > 0 && (
          <SheetGrid readOnly questions={questions} students={students} results={results} errors={preview.errors} badges={badges} />
        )}
        {error && <p role="alert" className={`${styles.status} ${styles.statusError}`}>{error}</p>}
        <div className={styles.modalActions}>
          <button type="button" ref={cancelRef} className={styles.button} disabled={saving} onClick={onCancel}>취소</button>
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={hasErrors || saving} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
