// @vitest-environment node
import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTemplate, parseUpload, detectFormat, UploadFormatError } from './xlsx.js'
import { LAYOUT } from '../../shared/eftiRecord/grid.js'
import { loadSeedQuestions } from '../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

async function loadSheet(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return { wb, ws: wb.worksheets[0] }
}

describe('buildTemplate', () => {
  it('기록지와 같은 배치의 템플릿을 만들고, 다시 읽으면 학생 없는 기록지가 된다', async () => {
    const buffer = await buildTemplate(QUESTIONS, { teacherName: 'kim' })
    expect(detectFormat(buffer)).toBe('xlsx')
    const { ws } = await loadSheet(buffer)
    expect(ws.name).toBe('기록지')
    expect(ws.getCell('B3').numFmt).toBe('@')
    expect(ws.getCell('A8').value).toBe('01')
    expect(ws.getCell('C8').value).toBe(QUESTIONS[0].question)
    expect(ws.getCell('A59').value).toBe('46')
    expect(ws.getCell('F8').dataValidation?.type).toBe('whole')
    expect(ws.getCell('AN59').dataValidation?.type).toBe('whole')

    const parsed = await parseUpload(buffer, QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toEqual({ teacherName: 'kim', className: '', classTime: '', completedOn: '' })
    expect(parsed.students).toEqual([])
  })

  it('템플릿에 값을 채워 올리면 헤더·학생·답·메모를 읽는다 (날짜 셀 포함)', async () => {
    const { wb, ws } = await loadSheet(await buildTemplate(QUESTIONS, { teacherName: '' }))
    ws.getCell('B2').value = '햇살반'
    ws.getCell('B3').value = '토 10:00'
    ws.getCell('B4').value = new Date(Date.UTC(2026, 10, 23))
    ws.getCell(LAYOUT.nameRow, 6).value = '민준'
    ws.getCell(LAYOUT.memoRow, 6).value = '결석'
    ws.getCell('F8').value = 1
    ws.getCell('F9').value = '2'
    ws.getCell(LAYOUT.nameRow, 7).value = '서연'
    ws.getCell('G59').value = 2
    const parsed = await parseUpload(Buffer.from(await wb.xlsx.writeBuffer()), QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toMatchObject({ className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' })
    expect(parsed.students.map(s => s.nickname)).toEqual(['민준', '서연'])
    expect(parsed.students[0]).toMatchObject({ memo: '결석' })
    expect(parsed.students[0].answers).toMatchObject({ '01': 1, '02': 2, '03': null })
    expect(parsed.students[1].answers['46']).toBe(2)
  })
})

describe('parseUpload (CSV)', () => {
  function csvFor({ date = '2026/11/23', firstAnswer = '1' } = {}) {
    const lines = [
      '선생님 ID,kim', '반 이름,햇살반', '수업시간,토 10:00', `수업 날짜,${date}`, '',
      '코드,단계,질문,①,②,민준', '메모,,,,,',
      ...QUESTIONS.map((q, i) => `${q.code},${q.stage}단계,"${q.question}",x,y,${i === 0 ? firstAnswer : ''}`),
    ]
    return '﻿' +lines.join('\r\n')
  }

  it('같은 배치의 UTF-8 CSV 를 읽는다', async () => {
    const parsed = await parseUpload(Buffer.from(csvFor(), 'utf8'), QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toEqual({ teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' })
    expect(parsed.students).toHaveLength(1)
    expect(parsed.students[0].answers['01']).toBe(1)
  })

  it('UTF-8 이 아닌 CSV 는 ENCODING 오류', async () => {
    await expect(parseUpload(Buffer.from([0xff, 0xfe, 0x41, 0x2c]), QUESTIONS))
      .rejects.toMatchObject({ code: 'ENCODING' })
  })

  it('xlsx 시그니처인데 깨진 파일은 UNREADABLE_FILE', async () => {
    const err = await parseUpload(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), QUESTIONS).catch(e => e)
    expect(err).toBeInstanceOf(UploadFormatError)
    expect(err.code).toBe('UNREADABLE_FILE')
  })
})
