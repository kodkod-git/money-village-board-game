// 업로드 파일(엑셀·CSV)을 읽은 2차원 표 → 기록지. grid[row-1][col-1] 은 엑셀 좌표와 같다.
import { makeError } from './validation.js'

export const LAYOUT = {
  headerCells: { teacherName: 'B1', className: 'B2', classTime: 'B3', completedOn: 'B4' },
  headerLabels: { teacherName: '선생님 ID', className: '반 이름', classTime: '수업시간', completedOn: '수업 날짜' },
  nameRow: 6,
  memoRow: 7,
  firstQuestionRow: 8,
  firstStudentCol: 6, // F
  templateStudentCount: 35, // F~AN
}

export function columnLetter(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const cellRef = (col, row) => `${columnLetter(col)}${row}`
const at = (grid, row, col) => grid[row - 1]?.[col - 1] ?? null

// 엑셀 시간 전용 셀은 1899-12-30(또는 31) 날짜의 Date 로 들어온다 → HH:MM. 잘못된 Date 는 빈 문자열.
function dateText(d) {
  if (Number.isNaN(d.getTime())) return ''
  const iso = d.toISOString()
  return /^1899-12-3[01]/.test(iso) ? iso.slice(11, 16) : iso.slice(0, 10)
}

function text(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return dateText(v)
  return String(v).trim()
}

// 엑셀 날짜 셀은 UTC 자정 Date 로 들어온다.
export function normalizeDateText(v) {
  if (v instanceof Date) return dateText(v)
  const t = text(v)
  const m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : t
}

const normalizeCode = v => { const t = text(v); return /^\d$/.test(t) ? t.padStart(2, '0') : t }

function toAnswer(v) {
  const t = text(v)
  if (t === '') return null
  if (t === '1' || t === '2') return Number(t)
  return t // 1·2가 아니면 그대로 두어 validateSheet 가 INVALID_ANSWER 로 잡는다
}

export function parseGrid(grid, questions) {
  const errors = []
  const header = {}
  for (const [field, ref] of Object.entries(LAYOUT.headerCells)) {
    const v = at(grid, Number(ref.slice(1)), 2)
    header[field] = field === 'completedOn' ? normalizeDateText(v) : text(v)
  }

  const questionRows = {}
  questions.forEach((q, i) => {
    const row = LAYOUT.firstQuestionRow + i
    questionRows[q.code] = row
    if (normalizeCode(at(grid, row, 1)) !== q.code) {
      errors.push(makeError('QUESTION_MISMATCH', {
        cell: cellRef(1, row), questionCode: q.code, message: `${cellRef(1, row)} 에는 문항 ${q.code} 가 있어야 해요`,
      }))
    }
  })
  const extraRow = LAYOUT.firstQuestionRow + questions.length
  if (normalizeCode(at(grid, extraRow, 1))) {
    errors.push(makeError('QUESTION_MISMATCH', {
      cell: cellRef(1, extraRow), message: `${cellRef(1, extraRow)} 부터는 문항이 없어야 해요`,
    }))
  }

  const width = grid.reduce((max, row) => Math.max(max, row?.length ?? 0), 0)
  const students = []
  const studentColumns = []
  for (let col = LAYOUT.firstStudentCol; col <= width; col++) {
    const nickname = text(at(grid, LAYOUT.nameRow, col))
    const memo = text(at(grid, LAYOUT.memoRow, col))
    const answers = Object.fromEntries(questions.map(q => [q.code, toAnswer(at(grid, questionRows[q.code], col))]))
    if (!nickname && !memo && Object.values(answers).every(v => v === null)) continue
    students.push({ nickname, memo: memo || null, answers })
    studentColumns.push(col)
  }
  return { header, students, errors, studentColumns, questionRows }
}

export function attachCellRefs(errors, parsed) {
  return errors.map(e => {
    if (e.cell) return e
    if (e.field) return { ...e, cell: LAYOUT.headerCells[e.field] }
    if (e.studentIndex !== undefined) {
      const col = parsed.studentColumns[e.studentIndex]
      const row = e.questionCode ? parsed.questionRows[e.questionCode] : LAYOUT.nameRow
      return { ...e, cell: cellRef(col, row) }
    }
    return e
  })
}

// RFC 4180 범위: 쉼표 구분, 큰따옴표 감싸기·이스케이프, CRLF/LF. 빈 칸은 null.
export function parseCsv(content) {
  const src = content.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.map(r => r.map(v => (v === '' ? null : v)))
}
