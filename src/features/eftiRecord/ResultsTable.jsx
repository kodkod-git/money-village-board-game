import { useEffect, useState } from 'react'
import * as api from './api'
import { AXIS_PAIRS } from '../../../shared/eftiRecord/scoring.js'
import styles from './EftiRecord.module.css'

const EMPTY_FILTERS = { teacherName: '', className: '', classTime: '', completedOn: '', q: '', needsFollowUp: false }
const unique = values => [...new Set(values.filter(Boolean))].sort()

export default function ResultsTable({ profile, onOpen }) {
  const [sheets, setSheets] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { api.fetchSheets().then(setSheets).catch(() => setSheets([])) }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.fetchResults(filters)
      .then(data => { if (!cancelled) { setRows(data); setError(null) } })
      .catch(() => { if (!cancelled) setError('결과를 불러오지 못했어요') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters])

  const set = (field, value) => setFilters(f => ({ ...f, [field]: value }))
  const select = (field, label, values) => (
    <label className={styles.field}>
      {label}
      <select value={filters[field]} onChange={e => set(field, e.target.value)}>
        <option value="">전체</option>
        {values.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  )

  return (
    <>
      <div className={styles.filters}>
        {profile.isSuper && select('teacherName', '선생님', unique(sheets.map(s => s.header.teacherName)))}
        {select('className', '반 이름', unique(sheets.map(s => s.header.className)))}
        {select('classTime', '수업시간', unique(sheets.map(s => s.header.classTime)))}
        {select('completedOn', '수업 날짜', unique(sheets.map(s => s.header.completedOn)).reverse())}
        <label className={styles.field}>
          학생 이름
          <input type="search" value={filters.q} onChange={e => set('q', e.target.value)} placeholder="이름 검색" />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={filters.needsFollowUp} onChange={e => set('needsFollowUp', e.target.checked)} />
          보충 필요만
        </label>
      </div>

      {error && <p className={`${styles.status} ${styles.statusError}`}>{error}</p>}
      <div className={styles.gridWrap}>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>학생</th><th>반</th><th>수업시간</th><th>수업 날짜</th><th>선생님</th>
              <th>시민권</th><th>여권</th>
              {AXIS_PAIRS.map(([a, b]) => <th key={a}>{a}/{b}</th>)}
              <th>미응답</th><th>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.recordId}
                className={r.passportType ? '' : styles.rowFollowUp}
                tabIndex={0}
                onClick={() => onOpen({ header: r.header, nickname: r.nickname })}
                onKeyDown={e => { if (e.key === 'Enter') onOpen({ header: r.header, nickname: r.nickname }) }}
              >
                <td>{r.nickname}</td>
                <td>{r.header.className}</td>
                <td>{r.header.classTime}</td>
                <td>{r.header.completedOn}</td>
                <td>{r.header.teacherName}</td>
                <td>{r.citizenType ?? '–'}</td>
                <td>{r.passportType ?? <span className={styles.followUp}>보충 필요</span>}</td>
                {AXIS_PAIRS.map(([a, b]) => <td key={a}>{r.passportCounts[a]}:{r.passportCounts[b]}</td>)}
                <td>{r.missingCodes.join(', ')}</td>
                <td>{r.memo ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <p className={styles.empty}>조건에 맞는 기록이 없어요</p>}
      </div>
    </>
  )
}
