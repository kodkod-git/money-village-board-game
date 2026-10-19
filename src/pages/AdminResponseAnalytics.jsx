import { useState, useEffect, useMemo } from 'react'
import { adminFetch } from '../utils/adminAuth'
import { StatCardRow } from '../components/admin/AdminStatCards'
import { GroupDonutChart, TypeHistogram, DailyBarChart, AnswerPieChart } from '../components/admin/SurveyCharts'
import { RESULT_GROUPS } from '../constants/quizData'
import { SYNERGY_TYPES } from '../constants/synergyData'
import { getTypeGroup } from '../utils/synergyScoring'
import {
  SURVEY_TESTS, PERIOD_RANGES, buildColumns, formatCell, formatDateParts, countByGroup, countByType, countByDay,
  choiceQuestions, countByAnswer, funnelSteps,
} from '../utils/surveyAnalytics'
import styles from './AdminResponseAnalytics.module.css'

const VIEW_TABS = [
  { key: 'responses', label: '응답별 데이터' },
  { key: 'questions', label: '질문 인사이트' },
  { key: 'insights', label: '결과 인사이트' },
  { key: 'period', label: '기간 인사이트' },
  { key: 'dropout', label: '질문 이탈률' },
]

const STEP_ICONS = { text: '✎', number: '#', choice: '☑' }

// 완료 수 외의 지표는 아직 수집하지 않는다. 필요한 작업은 proposal/20261014_response_analyze.md "구현 검토 결과" 참고.
function buildStatCards(rows) {
  return [
    { label: '참여', value: '—', tone: 'neutral', pending: true },
    { label: '완료', value: rows.length, tone: 'blue' },
    { label: '평균 세션시간', value: '—', tone: 'neutral', pending: true },
    { label: '링크 클릭 수', value: '—', tone: 'neutral', pending: true },
    { label: '전환율(CTR)', value: '—', tone: 'neutral', pending: true },
    { label: '공유버튼 클릭 수', value: '—', tone: 'neutral', pending: true },
  ]
}

function ResponseCell({ column, value }) {
  if (column.type === 'date') {
    const { date, time } = formatDateParts(value)
    return (
      <>
        <span className={styles.date}>{date}</span>
        <span className={styles.time}>{time}</span>
      </>
    )
  }
  if (column.type === 'answer' && value) {
    return <span className={styles.answerChip}>{value}</span>
  }
  if (column.type === 'group' && RESULT_GROUPS[value]) {
    return (
      <span className={styles.tag}>
        <span className={styles.dot} style={{ background: RESULT_GROUPS[value].color }} aria-hidden="true" />
        {value}
      </span>
    )
  }
  if (column.type === 'efti' && SYNERGY_TYPES[value]) {
    return (
      <span className={styles.tag} title={SYNERGY_TYPES[value].title}>
        <span className={styles.dot} style={{ background: RESULT_GROUPS[getTypeGroup(value)].color }} aria-hidden="true" />
        {value} · {SYNERGY_TYPES[value].animal}
      </span>
    )
  }
  return formatCell(column, value)
}

export default function AdminResponseAnalytics() {
  const [testKey, setTestKey] = useState(SURVEY_TESTS[0].key)
  const [view, setView] = useState('responses')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [periodKey, setPeriodKey] = useState('all')
  const [questionKey, setQuestionKey] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setRows([])
    adminFetch(`/api/admin/survey/${testKey}/responses`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (!cancelled) { setRows(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('응답을 불러오는 중 오류가 발생했습니다.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [testKey, reloadKey])

  const columns = useMemo(() => buildColumns(testKey, rows), [testKey, rows])
  const questions = choiceQuestions(testKey)
  // 테스트를 바꾸면 이전 테스트의 질문 키가 없으므로 첫 질문으로 돌아간다.
  const activeQuestion = questions.find(q => q.key === questionKey) ?? questions[0]
  const answerCounts = useMemo(() => countByAnswer(rows, activeQuestion), [rows, activeQuestion])
  const activeTest = SURVEY_TESTS.find(t => t.key === testKey)
  const dailyCounts = useMemo(
    () => countByDay(rows, PERIOD_RANGES.find(r => r.key === periodKey).days),
    [rows, periodKey]
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>테스트 분석</h1>
          <p className={styles.subtitle}>{activeTest.label}의 응답과 결과 분포를 확인할 수 있습니다</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.tabs} role="tablist" aria-label="테스트 선택">
            {SURVEY_TESTS.map(test => (
              <button
                key={test.key}
                type="button"
                role="tab"
                aria-selected={testKey === test.key}
                className={`${styles.tab} ${testKey === test.key ? styles.tabActive : ''}`}
                onClick={() => setTestKey(test.key)}
              >
                {test.label}
              </button>
            ))}
          </div>
          <span className={styles.adminBadge}>★ 관리자 모드</span>
        </div>
      </div>

      <div className={styles.content}>
        <StatCardRow cards={buildStatCards(rows)} />

        <div className={styles.viewTabs} role="tablist" aria-label="보기 선택">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              className={`${styles.viewTab} ${view === tab.key ? styles.viewTabActive : ''}`}
              onClick={() => setView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <p className={styles.message}>불러오는 중...</p>}
        {error && <p className={styles.message}>{error}</p>}
        {!loading && !error && rows.length === 0 && view !== 'dropout' && <p className={styles.message}>아직 응답이 없습니다.</p>}

        {!loading && !error && rows.length > 0 && view === 'responses' && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>응답별 데이터</h2>
              <span className={styles.countPill}>전체 {rows.length}건</span>
              <button type="button" className={styles.refreshBtn} onClick={() => setReloadKey(k => k + 1)}>
                새로고침
              </button>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col.key} className={styles.th} title={col.label}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id ?? i} className={styles.tr}>
                      {columns.map(col => (
                        <td key={col.key} className={col.type === 'date' ? styles.tdDate : styles.td}>
                          <ResponseCell column={col} value={row[col.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && !error && rows.length > 0 && view === 'questions' && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>질문 인사이트</h2>
              <span className={styles.panelHint}>
                선택지별 응답 비율 · 응답 {answerCounts.answered}건
                {answerCounts.unanswered > 0 && ` (미응답 ${answerCounts.unanswered}건 제외)`}
              </span>
            </div>
            <div className={styles.chartCard}>
              <label className={styles.questionSelect}>
                <span className={styles.questionSelectLabel}>질문</span>
                <select value={activeQuestion.key} onChange={e => setQuestionKey(e.target.value)}>
                  {questions.map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
                </select>
              </label>
              <AnswerPieChart slices={answerCounts.slices} />
            </div>
          </section>
        )}

        {!loading && !error && rows.length > 0 && view === 'insights' && (
          <section className={styles.panel}>
            {testKey === 'potential' ? (
              <>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>결과 그룹 분포</h2>
                  <span className={styles.panelHint}>그룹별 응답 수</span>
                </div>
                <div className={styles.chartCard}>
                  <GroupDonutChart groups={countByGroup(rows)} />
                </div>
              </>
            ) : (
              <>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>EFTI 유형 빈도</h2>
                  <span className={styles.panelHint}>응답자(나) 유형 기준 · 막대 색은 그룹</span>
                </div>
                <div className={styles.chartCard}>
                  <TypeHistogram types={countByType(rows)} />
                </div>
              </>
            )}
          </section>
        )}

        {/* 참여·공유·링크 클릭(막대)과 CTR·세션시간(꺾은선)은 수집이 시작되면 같은 일자 축으로 차트를 추가한다.
            단위가 다른 지표를 한 차트에 이중 y축으로 겹치지 않고 지표별로 나눠 그린다. */}
        {!loading && !error && rows.length > 0 && view === 'period' && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>일자별 완료 수</h2>
              <span className={styles.panelHint}>참여·공유·링크 클릭·CTR·세션시간은 수집 후 추가 예정</span>
              <div className={styles.periodTabs} role="tablist" aria-label="기간 선택">
                {PERIOD_RANGES.map(range => (
                  <button
                    key={range.key}
                    type="button"
                    role="tab"
                    aria-selected={periodKey === range.key}
                    className={`${styles.periodTab} ${periodKey === range.key ? styles.periodTabActive : ''}`}
                    onClick={() => setPeriodKey(range.key)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.chartCard}>
              <DailyBarChart days={dailyCounts} valueKey="completed" label="완료" />
            </div>
          </section>
        )}

        {/* 노출·이탈은 질문 화면 진입/종료 이벤트를 수집해야 계산할 수 있다. 지금은 질문 목록만 보여준다. */}
        {!loading && !error && view === 'dropout' && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>질문 이탈률</h2>
              <span className={styles.pendingPill}>준비 중</span>
              <span className={styles.panelHint}>질문별 노출·이탈 수는 수집 기능을 추가한 뒤 표시됩니다</span>
            </div>
            <div className={styles.tableWrapper}>
              <table className={`${styles.table} ${styles.funnelTable}`}>
                <thead>
                  <tr>
                    <th className={styles.th}>질문</th>
                    <th className={styles.thNum}>노출</th>
                    <th className={styles.thNum}>이탈</th>
                    <th className={styles.thNum}>이탈률</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelSteps(testKey).map((step, i) => (
                    <tr key={step.label} className={styles.tr}>
                      <td className={styles.td}>
                        <span className={styles.stepIcon} aria-hidden="true">{STEP_ICONS[step.kind]}</span>
                        <strong>{i + 1}.</strong> {step.label}
                      </td>
                      <td className={styles.tdNum}>—</td>
                      <td className={styles.tdNum}>—</td>
                      <td className={styles.tdNum}><span className={styles.pendingPill}>준비 중</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
