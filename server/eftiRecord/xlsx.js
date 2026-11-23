// 기록지 엑셀 템플릿 생성과 업로드 파일(.xlsx/.csv) → 표 읽기. 표 해석은 shared/eftiRecord/grid.js 가 한다.
import ExcelJS from 'exceljs'
import { LAYOUT, parseGrid, parseCsv } from '../../shared/eftiRecord/grid.js'

const GREY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
const ANSWER_VALIDATION = {
  type: 'whole',
  operator: 'between',
  allowBlank: true,
  formulae: [1, 2],
  showErrorMessage: true,
  errorTitle: '입력 오류',
  error: '1 또는 2만 입력할 수 있어요',
}

export class UploadFormatError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export async function buildTemplate(questions, { teacherName = '' } = {}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('기록지', {
    views: [{ state: 'frozen', xSplit: LAYOUT.firstStudentCol - 1, ySplit: LAYOUT.memoRow }],
  })
  const lastCol = LAYOUT.firstStudentCol + LAYOUT.templateStudentCount - 1

  for (const [field, ref] of Object.entries(LAYOUT.headerCells)) {
    const label = ws.getCell(Number(ref.slice(1)), 1)
    label.value = LAYOUT.headerLabels[field]
    label.font = { bold: true }
  }
  ws.getCell(LAYOUT.headerCells.teacherName).value = teacherName
  ws.getCell(LAYOUT.headerCells.completedOn).numFmt = 'yyyy-mm-dd'
  ws.getCell(LAYOUT.headerCells.className).numFmt = '@'
  ws.getCell(LAYOUT.headerCells.classTime).numFmt = '@'
  ws.getCell('C1').value = '비우면 로그인한 계정으로 저장돼요'
  ws.getCell('C3').value = '예: 토 10:00'
  ws.getCell('C4').value = '48회차 수업 날짜 (예: 2026-11-23)'
  ws.getCell(LAYOUT.nameRow - 1, LAYOUT.firstStudentCol).value = '6행에 학생 이름, 7행에 메모, 8행부터 1 또는 2를 적어 주세요'

  const head = ws.getRow(LAYOUT.nameRow)
  ;['코드', '단계', '질문', '①', '②'].forEach((t, i) => { head.getCell(i + 1).value = t })
  head.font = { bold: true }
  ws.getCell(LAYOUT.memoRow, 1).value = '메모'

  questions.forEach((q, i) => {
    const row = ws.getRow(LAYOUT.firstQuestionRow + i)
    row.getCell(1).numFmt = '@'
    row.getCell(1).value = q.code
    row.getCell(2).value = `${q.stage}단계`
    row.getCell(3).value = q.question
    row.getCell(4).value = q.option1
    row.getCell(5).value = q.option2
    for (let c = 1; c <= 5; c++) row.getCell(c).fill = GREY
    for (let c = LAYOUT.firstStudentCol; c <= lastCol; c++) {
      const cell = row.getCell(c)
      cell.dataValidation = ANSWER_VALIDATION
      cell.alignment = { horizontal: 'center' }
    }
    const next = questions[i + 1]
    if (next && next.stage !== q.stage) {
      for (let c = 1; c <= lastCol; c++) row.getCell(c).border = { bottom: { style: 'thick' } }
    }
  })

  ;[7, 7, 34, 26, 26].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  for (let c = LAYOUT.firstStudentCol; c <= lastCol; c++) ws.getColumn(c).width = 9
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function cellToPrimitive(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) return cellToPrimitive(v.result)
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('')
    if ('text' in v) return v.text
    return null
  }
  return v
}

function worksheetToGrid(ws) {
  const grid = []
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => { cells[colNumber - 1] = cellToPrimitive(cell.value) })
    grid[rowNumber - 1] = cells
  })
  return grid
}

// xlsx 는 zip 이라 'PK\x03\x04' 로 시작한다. 나머지는 CSV 로 본다.
export function detectFormat(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
    ? 'xlsx'
    : 'csv'
}

async function readUploadGrid(buffer) {
  if (detectFormat(buffer) === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(buffer)
    } catch {
      throw new UploadFormatError('UNREADABLE_FILE', '엑셀 파일을 읽을 수 없어요')
    }
    const ws = wb.worksheets[0]
    if (!ws) throw new UploadFormatError('NO_SHEET', '시트를 찾을 수 없어요')
    return worksheetToGrid(ws)
  }
  let content
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new UploadFormatError('ENCODING', 'CSV는 "CSV UTF-8" 형식으로 저장해 주세요')
  }
  return parseCsv(content)
}

export async function parseUpload(buffer, questions) {
  return parseGrid(await readUploadGrid(buffer), questions)
}
