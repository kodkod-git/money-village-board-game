// 기록지 검증. 화면(실시간)과 서버(저장·업로드)가 같은 함수를 쓴다. DB 제약은 최종 방어선으로 그대로 둔다.
import { isBlankStudent } from './sheetFormat.js'

export const ERROR_MESSAGES = {
  REQUIRED_HEADER: '꼭 입력해야 해요',
  INVALID_DATE: '날짜는 YYYY-MM-DD 형식의 실제 날짜여야 해요',
  REQUIRED_NICKNAME: '학생 이름을 입력해 주세요',
  DUPLICATE_NICKNAME: '같은 기록지에 같은 이름이 있어요',
  INVALID_ANSWER: '1 또는 2만 입력할 수 있어요',
  NO_STUDENTS: '저장할 학생이 없어요',
  QUESTION_MISMATCH: '문항 행이 템플릿과 달라요',
  TEACHER_MISMATCH: '선생님 ID가 로그인한 계정과 달라요',
  EMPTY_FILE: '파일이 비어 있어요',
  FILE_TOO_LARGE: '파일이 너무 커요 (25MB 이하)',
  SHEET_EXISTS: '같은 반·수업시간·날짜의 기록지나 같은 이름의 학생이 이미 있어요',
  STALE_SHEET: '기록지가 그사이 바뀌었어요. 기록지를 다시 열어 주세요',
}

export function makeError(code, extra = {}) {
  return { code, message: ERROR_MESSAGES[code], ...extra }
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const HEADER_FIELDS = ['className', 'classTime', 'completedOn']
const isAllowedAnswer = v => v === null || v === undefined || v === '' || v === 1 || v === 2

export function validateSheet(sheet, questions) {
  const errors = []
  const header = sheet.header ?? {}
  for (const field of HEADER_FIELDS) {
    if (!String(header[field] ?? '').trim()) errors.push(makeError('REQUIRED_HEADER', { field }))
  }
  const date = String(header.completedOn ?? '').trim()
  if (date && !isValidDate(date)) errors.push(makeError('INVALID_DATE', { field: 'completedOn' }))

  const seen = new Set()
  let count = 0
  ;(sheet.students ?? []).forEach((student, studentIndex) => {
    if (isBlankStudent(student)) return
    count += 1
    const name = String(student.nickname ?? '').trim()
    if (!name) errors.push(makeError('REQUIRED_NICKNAME', { studentIndex }))
    else if (seen.has(name)) errors.push(makeError('DUPLICATE_NICKNAME', { studentIndex }))
    else seen.add(name)
    for (const q of questions) {
      if (!isAllowedAnswer(student.answers?.[q.code])) {
        errors.push(makeError('INVALID_ANSWER', { studentIndex, questionCode: q.code }))
      }
    }
  })
  if (count === 0) errors.push(makeError('NO_STUDENTS'))
  return errors
}
