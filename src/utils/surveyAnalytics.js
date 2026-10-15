import { QUESTIONS, AXIS_LABELS, GENDER_OPTIONS, RESULT_GROUPS } from '../constants/quizData'
import { SYNERGY_QUESTIONS, SYNERGY_TYPES } from '../constants/synergyData'
import { getTypeGroup } from './synergyScoring'

// 관리자 "응답 및 분석" 화면의 테스트 탭. key는 /api/admin/survey/:test/responses 경로와 같다.
export const SURVEY_TESTS = [
  { key: 'potential', label: '경제적 잠재력 유형 테스트' },
  { key: 'synergy', label: 'EFTI 시너지 테스트' },
]

const SOURCE_LABELS = { app: '앱', smore_import: '스모어 이관' }
const GENDER_LABELS = Object.fromEntries(GENDER_OPTIONS.map(o => [o.value, o.label]))
const AXIS_VALUE_LABELS = Object.fromEntries(
  Object.values(AXIS_LABELS).flatMap(a => [[a.leftValue, a.left], [a.rightValue, a.right]])
)

function questionHeader(prompt) {
  return prompt.replace('{name}', '우리 아이').replace(/\n/g, ' ')
}

// type: 'date' | 'group' | 'efti' | 'text'. format은 화면 표시용 문자열 변환.
const KNOWN_COLUMNS = {
  potential: [
    { key: 'submitted_at', label: '날짜', type: 'date' },
    { key: 'child_name', label: '이름' },
    { key: 'child_gender', label: '성별', format: v => GENDER_LABELS[v] ?? v },
    { key: 'child_age', label: '나이' },
    ...QUESTIONS.map(q => ({ key: q.key, label: questionHeader(q.prompt), type: 'answer' })),
    { key: 'axis_today_tomorrow', label: '오늘/내일 축', format: v => AXIS_VALUE_LABELS[v] ?? v },
    { key: 'axis_safety_adventure', label: '안전/모험 축', format: v => AXIS_VALUE_LABELS[v] ?? v },
    { key: 'result_group', label: '결과', type: 'group' },
    { key: 'source', label: '출처', format: v => SOURCE_LABELS[v] ?? v },
  ],
  synergy: [
    { key: 'submitted_at', label: '날짜', type: 'date' },
    { key: 'my_name', label: '내 닉네임' },
    { key: 'citizen_name', label: '시민권자 닉네임' },
    { key: 'citizen_type', label: '시민권자 유형', type: 'efti' },
    ...SYNERGY_QUESTIONS.map(q => ({ key: q.key, label: questionHeader(q.prompt), type: 'answer' })),
    { key: 'my_type', label: '결과 (내 유형)', type: 'efti' },
    { key: 'source', label: '출처', format: v => SOURCE_LABELS[v] ?? v },
  ],
}

// 화면에 보여줄 필요가 없는 내부 키
const HIDDEN_KEYS = new Set(['id'])

// 알려진 컬럼을 먼저 두고, 스모어 이관 등으로 DB에만 있는 나머지 컬럼도 원래 이름 그대로 뒤에 붙인다.
export function buildColumns(testKey, rows) {
  const known = KNOWN_COLUMNS[testKey]
  const knownKeys = new Set(known.map(c => c.key))
  const extraKeys = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!knownKeys.has(key) && !HIDDEN_KEYS.has(key) && !extraKeys.includes(key)) extraKeys.push(key)
    }
  }
  return [...known, ...extraKeys.map(key => ({ key, label: key }))]
}

export function formatDateParts(iso) {
  if (!iso) return { date: '-', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: String(iso), time: '' }
  const pad = n => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export function formatCell(column, value) {
  if (value == null || value === '') return '-'
  if (column.format) return String(column.format(value))
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// 도넛 차트: RESULT_GROUPS 순서를 고정해 색이 순위가 아닌 그룹을 따라가게 한다.
export function countByGroup(rows) {
  const total = rows.filter(r => RESULT_GROUPS[r.result_group]).length
  return Object.entries(RESULT_GROUPS).map(([group, meta]) => {
    const count = rows.filter(r => r.result_group === group).length
    return { group, color: meta.color, tagline: meta.tagline, count, ratio: total ? count / total : 0 }
  })
}

// 히스토그램: 16개 유형을 SYNERGY_TYPES 순서로 모두 보여준다(0명인 유형 포함).
export function countByType(rows) {
  return Object.entries(SYNERGY_TYPES).map(([type, meta]) => {
    const group = getTypeGroup(type)
    return {
      type,
      title: meta.title,
      animal: meta.animal,
      group,
      color: RESULT_GROUPS[group].color,
      count: rows.filter(r => r.my_type === type).length,
    }
  })
}

// 기간별 인사이트 기간 필터. days가 null이면 첫 응답일부터.
export const PERIOD_RANGES = [
  { key: '7d', label: '최근 7일', days: 7 },
  { key: '30d', label: '최근 30일', days: 30 },
  { key: 'all', label: '전체', days: null },
]

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return formatDateParts(new Date(y, m - 1, d + n)).date
}

// 일자별 완료 수. 응답이 없는 날도 0으로 채워 x축이 끊기지 않게 하고, 끝은 오늘(today)이다.
export function countByDay(rows, days, today = new Date()) {
  const end = formatDateParts(today).date
  const counts = new Map()
  for (const row of rows) {
    const { date } = formatDateParts(row.submitted_at)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  const earliest = [...counts.keys()].sort()[0] ?? end
  const start = days ? addDays(end, -(days - 1)) : earliest

  const result = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    result.push({ date, completed: counts.get(date) ?? 0 })
  }
  return result
}
