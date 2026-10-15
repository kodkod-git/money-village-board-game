import { QUESTIONS, AXIS_LABELS, GENDER_OPTIONS, RESULT_GROUPS, NAME_TITLE, GENDER_TITLE } from '../constants/quizData'
import { SYNERGY_QUESTIONS, SYNERGY_TYPES, MY_NAME_TITLE, CITIZEN_NAME_TITLE } from '../constants/synergyData'
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

// 질문 인사이트: 테스트별 선택형 질문 목록(드롭다운 순서 = 화면에 나오는 순서).
export function choiceQuestions(testKey) {
  const questions = testKey === 'synergy' ? SYNERGY_QUESTIONS : QUESTIONS
  return questions.map(q => ({ key: q.key, label: questionHeader(q.prompt), options: q.options.map(o => o.text) }))
}

// 질문 인사이트 파이 차트에 쓰는 선택지 색. 그룹 색과 헷갈리지 않게 따로 둔다.
const OPTION_COLORS = ['#5B8DEF', '#4CC9A0', '#F2A65A', '#9B8AFB']
const OTHER_COLOR = '#C4C9D4'

// 선택지별 응답 수. 질문 문구와 다른 값(스모어 이관 중 깨진 글자 등)은 "기타"로 묶고,
// 답하지 않은 응답(null)은 비율 계산에서 빼고 따로 센다.
export function countByAnswer(rows, question) {
  const answered = rows.filter(r => r[question.key] != null && r[question.key] !== '')
  const slices = question.options.map((text, i) => ({
    label: text,
    color: OPTION_COLORS[i % OPTION_COLORS.length],
    count: answered.filter(r => r[question.key] === text).length,
  }))
  const other = answered.length - slices.reduce((sum, s) => sum + s.count, 0)
  if (other > 0) slices.push({ label: '기타', color: OTHER_COLOR, count: other })
  return {
    slices: slices.map(s => ({ ...s, ratio: answered.length ? s.count / answered.length : 0 })),
    answered: answered.length,
    unanswered: rows.length - answered.length,
  }
}

// 질문 이탈률 표의 행: 테스트 화면에 나오는 순서 그대로(정보 입력 단계 포함).
// 노출·이탈 수는 아직 수집하지 않는다.
export function funnelSteps(testKey) {
  const info = testKey === 'synergy'
    ? [{ label: questionHeader(MY_NAME_TITLE), kind: 'text' }, { label: questionHeader(CITIZEN_NAME_TITLE), kind: 'text' }]
    : [
        { label: questionHeader(NAME_TITLE), kind: 'text' },
        { label: questionHeader(GENDER_TITLE), kind: 'choice' },
        { label: '아이의 나이를 입력해주세요', kind: 'number' },
      ]
  return [...info, ...choiceQuestions(testKey).map(q => ({ label: q.label, kind: 'choice' }))]
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
