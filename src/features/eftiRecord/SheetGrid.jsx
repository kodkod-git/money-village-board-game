// 기록지형 표: 문항 = 행, 학생 = 열. 입력 화면과 업로드 미리보기(readOnly)가 함께 쓴다.
import { Fragment, useEffect, useRef, useState } from 'react'
import styles from './EftiRecord.module.css'

const MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

const studentLabel = (s, i) => String(s.nickname ?? '').trim() || `학생 ${i + 1}`
// 학생 답(1/2)은 멀리서도 구분되도록 색이 다른 큰 원형 배지로 그린다. 그 밖의 값(업로드 오류 등)은 글자 그대로.
function display(v) {
  if (v === 1 || v === 2) return <span className={styles[`mark${v}`]} data-mark={v}>{v}</span>
  return v === null || v === undefined ? '' : String(v)
}

export default function SheetGrid({
  questions, students, results, errors = [], readOnly = false, badges = {}, focusKey = null,
  onCycle, onSetAnswer, onSetName, onSetMemo, onRemove, onAdd,
}) {
  const refs = useRef(new Map())
  const [memoOpen, setMemoOpen] = useState(null)
  const setRef = key => el => { if (el) refs.current.set(key, el); else refs.current.delete(key) }
  const extraCol = readOnly ? 0 : 1
  const firstStage2 = questions.findIndex(q => q.stage === 2)

  const answerError = (i, code) => errors.find(e => e.studentIndex === i && e.questionCode === code)
  const nameError = i => errors.find(e => e.studentIndex === i && !e.questionCode)

  useEffect(() => {
    if (focusKey) refs.current.get(`name:${focusKey}`)?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [focusKey])

  const focusCell = (row, col) => refs.current.get(`${row}:${col}`)?.focus()

  function handleCellKey(e, row, col, student, q) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (MOVES[e.key]) {
      e.preventDefault()
      const [dr, dc] = MOVES[e.key]
      focusCell(
        Math.min(Math.max(row + dr, 0), questions.length - 1),
        Math.min(Math.max(col + dc, 0), students.length - 1),
      )
    } else if (e.key === '1' || e.key === '2') {
      e.preventDefault()
      onSetAnswer(student.key, q.code, Number(e.key))
      if (row < questions.length - 1) focusCell(row + 1, col)
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault()
      onSetAnswer(student.key, q.code, null)
    }
  }

  const stageRow = label => (
    <tr className={styles.stageRow}>
      <td colSpan={4 + students.length + extraCol}>{label}</td>
    </tr>
  )

  return (
    <div className={styles.gridWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={`${styles.colCode} ${styles.sticky}`}>코드</th>
            <th className={`${styles.colQuestion} ${styles.sticky}`}>질문</th>
            <th className={`${styles.colOption1} ${styles.sticky}`}>①</th>
            <th className={`${styles.colOption2} ${styles.sticky}`}>②</th>
            {students.map((s, i) => {
              const label = studentLabel(s, i)
              const err = nameError(i)
              return (
                <th key={s.key} className={styles.studentHead}>
                  {badges[s.key] && <span className={styles.badge}>{badges[s.key]}</span>}
                  {readOnly ? (
                    <span ref={setRef(`name:${s.key}`)} className={styles.studentName} title={err?.message}>
                      {s.nickname || '(이름 없음)'}
                    </span>
                  ) : (
                    <input
                      ref={setRef(`name:${s.key}`)}
                      aria-label={`학생 ${i + 1} 이름`}
                      className={`${styles.nameInput} ${err ? styles.invalid : ''}`}
                      title={err?.message}
                      value={s.nickname}
                      placeholder={`학생 ${i + 1}`}
                      onChange={e => onSetName(s.key, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusCell(0, i) } }}
                    />
                  )}
                  {readOnly && s.memo && <span className={styles.memoText} title={s.memo}>메모</span>}
                  {!readOnly && (
                    <div className={styles.studentTools}>
                      <button
                        type="button"
                        aria-label={`${label} 메모`}
                        className={s.memo ? styles.memoOn : ''}
                        onClick={() => setMemoOpen(memoOpen === s.key ? null : s.key)}
                      >✎</button>
                      <button type="button" aria-label={`${label} 삭제`} onClick={() => onRemove(s.key)}>×</button>
                    </div>
                  )}
                  {!readOnly && memoOpen === s.key && (
                    <textarea
                      aria-label={`${label} 메모 입력`}
                      className={styles.memoBox}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Escape') setMemoOpen(null) }}
                      value={s.memo}
                      onChange={e => onSetMemo(s.key, e.target.value)}
                    />
                  )}
                </th>
              )
            })}
            {!readOnly && (
              <th className={styles.addCol}>
                <button type="button" onClick={onAdd}>+ 학생</button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {questions.map((q, row) => (
            <Fragment key={q.code}>
              {row === 0 && stageRow('1단계')}
              {row === firstStage2 && stageRow('2단계')}
              <tr>
                <th scope="row" className={`${styles.colCode} ${styles.sticky}`}>{q.code}</th>
                <td className={`${styles.colQuestion} ${styles.sticky}`}>{q.question}</td>
                <td className={`${styles.colOption1} ${styles.sticky}`}>{q.option1}</td>
                <td className={`${styles.colOption2} ${styles.sticky}`}>{q.option2}</td>
                {students.map((s, col) => {
                  const value = s.answers[q.code]
                  const err = answerError(col, q.code)
                  const empty = value === null || value === undefined
                  const className = [styles.answer, empty && styles.missing, err && styles.invalid].filter(Boolean).join(' ')
                  const title = err?.message ?? (value === 1 ? q.option1 : value === 2 ? q.option2 : '미응답')
                  return (
                    <td key={s.key} className={styles.answerCell}>
                      {readOnly ? (
                        <span className={className} title={title}>{display(value)}</span>
                      ) : (
                        <button
                          type="button"
                          ref={setRef(`${row}:${col}`)}
                          aria-label={`${studentLabel(s, col)} ${q.code}`}
                          className={className}
                          title={title}
                          tabIndex={row === 0 ? 0 : -1}
                          onClick={() => onCycle(s.key, q.code)}
                          onKeyDown={e => handleCellKey(e, row, col, s, q)}
                        >{display(value)}</button>
                      )}
                    </td>
                  )
                })}
                {!readOnly && <td />}
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4} className={styles.sticky}>시민권</th>
            {students.map((s, i) => <td key={s.key} className={styles.summary}>{results[i]?.citizenType ?? '–'}</td>)}
            {!readOnly && <td />}
          </tr>
          <tr>
            <th colSpan={4} className={styles.sticky}>여권</th>
            {students.map((s, i) => {
              const r = results[i]
              return (
                <td key={s.key} className={styles.summary}>
                  {!r ? '–' : r.passportType ?? <span className={styles.followUp}>보충 필요</span>}
                </td>
              )
            })}
            {!readOnly && <td />}
          </tr>
          <tr>
            <th colSpan={4} className={styles.sticky}>미응답</th>
            {students.map((s, i) => {
              const r = results[i]
              return (
                <td key={s.key} className={styles.summary} title={r?.missingCodes.join(', ')}>
                  {r ? r.missingCodes.length : ''}
                </td>
              )
            })}
            {!readOnly && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
