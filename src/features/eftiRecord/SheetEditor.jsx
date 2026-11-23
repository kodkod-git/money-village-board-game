import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as api from './api'
import SheetGrid from './SheetGrid'
import UploadPreview from './UploadPreview'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { sheetReducer, initialSheetState, loadedSheetState, toSavePayload } from './sheetState'
import { computeResult } from '../../../shared/eftiRecord/scoring.js'
import { validateSheet } from '../../../shared/eftiRecord/validation.js'
import { isBlankStudent } from '../../../shared/eftiRecord/sheetFormat.js'
import styles from './EftiRecord.module.css'

const FIELD_LABELS = { teacherName: '선생님', className: '반 이름', classTime: '수업시간', completedOn: '수업 날짜' }
const unique = values => [...new Set(values.filter(Boolean))]

export function sheetLabel(sheet, showTeacher) {
  const h = sheet.header
  const parts = [h.completedOn, h.className, h.classTime, `${sheet.studentCount}명`]
  if (showTeacher) parts.push(h.teacherName)
  if (sheet.needsFollowUpCount) parts.push(`보충 ${sheet.needsFollowUpCount}`)
  return parts.join(' · ')
}

function describeError(e, students) {
  const where = e.field
    ? FIELD_LABELS[e.field]
    : e.studentIndex !== undefined
      ? `${String(students[e.studentIndex]?.nickname ?? '').trim() || `학생 ${e.studentIndex + 1}`}${e.questionCode ? ` ${e.questionCode}` : ''}`
      : ''
  return where ? `${where}: ${e.message}` : e.message
}

export default function SheetEditor({ questions, profile, target = null, onDirtyChange }) {
  const [state, dispatch] = useReducer(sheetReducer, undefined, () => initialSheetState(questions, profile.username))
  const [sheets, setSheets] = useState([])
  const [serverErrors, setServerErrors] = useState([])
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [preview, setPreview] = useState(null)
  const [focusKey, setFocusKey] = useState(null)
  const fileRef = useRef(null)

  const refreshSheets = useCallback(() => {
    api.fetchSheets().then(setSheets).catch(() => setSheets([]))
  }, [])

  useEffect(() => { refreshSheets() }, [refreshSheets])
  useEffect(() => { onDirtyChange?.(state.dirty) }, [state.dirty, onDirtyChange])
  useEffect(() => {
    if (!state.dirty) return undefined
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.dirty])

  const results = useMemo(() => state.students.map(s => computeResult(s.answers, questions)), [state.students, questions])
  const errors = useMemo(() => validateSheet(state, questions), [state, questions])
  const shownErrors = serverErrors.length ? serverErrors : (state.dirty ? errors : [])
  const headerError = field => shownErrors.find(e => e.field === field)

  const edit = action => { setServerErrors([]); setStatus(null); dispatch(action) }

  function resetTo(next, focusNickname = null) {
    dispatch({ type: 'reset', state: next })
    setServerErrors([])
    setFocusKey(next.students.find(s => s.nickname === focusNickname)?.key ?? null)
  }

  function guard(action) {
    if (!state.dirty) return action()
    setConfirm({
      title: '저장하지 않은 내용이 있어요',
      description: '계속하면 입력한 내용이 사라져요.',
      confirmLabel: '계속',
      onConfirm: action,
    })
  }

  const openSheet = useCallback(async (header, nickname = null) => {
    try {
      const sheet = await api.fetchSheet(header)
      resetTo(loadedSheetState(sheet.header, sheet.students), nickname)
      setStatus(null)
    } catch (err) {
      setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '기록지를 열지 못했어요' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (target) openSheet(target.header, target.nickname ?? null)
  }, [target, openSheet])

  async function save() {
    setSaving(true)
    setServerErrors([])
    try {
      const saved = await api.saveSheet(toSavePayload(state))
      resetTo(loadedSheetState(saved.header, saved.students))
      setStatus({ tone: 'ok', text: `학생 ${saved.students.length}명을 저장했어요` })
      refreshSheets()
    } catch (err) {
      setServerErrors(err?.errors ?? [])
      setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '저장하지 못했어요' })
    } finally {
      setSaving(false)
    }
  }

  function removeStudent(key) {
    const index = state.students.findIndex(s => s.key === key)
    const student = state.students[index]
    const run = () => edit({ type: 'removeStudent', key })
    if (!student.id && isBlankStudent(student)) return run()
    setConfirm({
      title: `${String(student.nickname).trim() || `학생 ${index + 1}`} 열을 지울까요?`,
      description: student.id ? '저장하면 이 학생 기록이 삭제돼요.' : '입력한 내용이 사라져요.',
      confirmLabel: '삭제',
      onConfirm: run,
    })
  }

  function deleteCurrentSheet() {
    setConfirm({
      title: '기록지를 삭제할까요?',
      description: `${sheetLabel({ header: state.original, studentCount: state.students.length }, false)} 기록지의 모든 학생 기록이 삭제돼요.`,
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.deleteSheet(state.original)
          resetTo(initialSheetState(questions, profile.username))
          setStatus({ tone: 'ok', text: '기록지를 삭제했어요' })
          refreshSheets()
        } catch (err) {
          setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '삭제하지 못했어요' })
        }
      },
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPreview(await api.uploadFile(file))
    } catch (err) {
      setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '파일을 읽지 못했어요' })
    }
  }

  function handleUploaded(saved) {
    setPreview(null)
    resetTo(loadedSheetState(saved.header, saved.students))
    setStatus({ tone: 'ok', text: `업로드한 기록지를 저장했어요 (학생 ${saved.students.length}명)` })
    refreshSheets()
  }

  const headerInput = (field, props = {}) => (
    <label className={styles.field}>
      {FIELD_LABELS[field]}
      <input
        value={state.header[field]}
        onChange={e => edit({ type: 'setHeader', field, value: e.target.value })}
        className={headerError(field) ? styles.invalid : ''}
        title={headerError(field)?.message}
        {...props}
      />
    </label>
  )

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={styles.button} onClick={() => guard(() => resetTo(initialSheetState(questions, profile.username)))}>
          새 기록지
        </button>
        <label className={styles.field}>
          기존 기록지
          <select
            aria-label="기존 기록지 열기"
            value=""
            onChange={e => {
              const sheet = sheets[Number(e.target.value)]
              if (sheet) guard(() => openSheet(sheet.header))
            }}
          >
            <option value="">기존 기록지 열기</option>
            {sheets.map((s, i) => <option key={i} value={i}>{sheetLabel(s, profile.isSuper)}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          선생님
          <input value={state.header.teacherName} readOnly />
        </label>
        {headerInput('className', { list: 'efti-class-names' })}
        {headerInput('classTime', { list: 'efti-class-times', placeholder: '토 10:00' })}
        {headerInput('completedOn', { type: 'date' })}
        <datalist id="efti-class-names">
          {unique(sheets.map(s => s.header.className)).map(v => <option key={v} value={v} />)}
        </datalist>
        <datalist id="efti-class-times">
          {unique(sheets.map(s => s.header.classTime)).map(v => <option key={v} value={v} />)}
        </datalist>
        <div className={styles.spacer} />
        <button type="button" className={styles.button} onClick={() => api.downloadTemplate().catch(() => setStatus({ tone: 'error', text: '템플릿을 받지 못했어요' }))}>
          엑셀 템플릿 받기
        </button>
        <button type="button" className={styles.button} onClick={() => guard(() => fileRef.current?.click())}>
          파일 업로드
        </button>
        <input
          ref={fileRef}
          type="file"
          aria-label="업로드 파일"
          accept=".xlsx,.csv"
          className={styles.hiddenInput}
          onChange={handleFile}
        />
        {state.original && (
          <button type="button" className={`${styles.button} ${styles.danger}`} onClick={deleteCurrentSheet}>
            기록지 삭제
          </button>
        )}
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={!state.dirty || errors.length > 0 || saving}
          onClick={save}
        >
          저장
        </button>
      </div>

      {status && (
        <p role="status" className={`${styles.status} ${status.tone === 'ok' ? styles.statusOk : styles.statusError}`}>{status.text}</p>
      )}
      {!status && shownErrors.length > 0 && (
        <p className={`${styles.status} ${styles.statusError}`}>
          오류 {shownErrors.length}개 · {describeError(shownErrors[0], state.students)}
        </p>
      )}

      <SheetGrid
        questions={questions}
        students={state.students}
        results={results}
        errors={shownErrors}
        focusKey={focusKey}
        onCycle={(key, code) => edit({ type: 'cycleAnswer', key, code })}
        onSetAnswer={(key, code, value) => edit({ type: 'setAnswer', key, code, value })}
        onSetName={(key, value) => edit({ type: 'setStudentField', key, field: 'nickname', value })}
        onSetMemo={(key, value) => edit({ type: 'setStudentField', key, field: 'memo', value })}
        onRemove={removeStudent}
        onAdd={() => edit({ type: 'addStudent', questions })}
      />

      {preview && (
        <UploadPreview questions={questions} preview={preview} onCancel={() => setPreview(null)} onSaved={handleUploaded} />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          description={confirm.description}
          cancelLabel="취소"
          confirmLabel={confirm.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const run = confirm.onConfirm; setConfirm(null); run() }}
        />
      )}
    </>
  )
}
