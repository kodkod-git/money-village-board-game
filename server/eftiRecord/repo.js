// efti_record 스키마 접근은 이 파일에서만 한다.
import { supabaseEftiRecord as db } from './client.js'
import { headerToRow, rowToHeader, rowToStudent, studentToRpc } from '../../shared/eftiRecord/sheetFormat.js'

const PAGE = 1000

async function fetchAll(build) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

function whereHeader(query, header) {
  return Object.entries(headerToRow(header)).reduce((q, [k, v]) => q.eq(k, v), query)
}

const escapeLike = s => s.replace(/[\\%_*]/g, c => `\\${c}`)

export async function listQuestions() {
  const { data, error } = await db.from('questions').select('*').order('sort_order')
  if (error) throw error
  return data.map(q => ({
    code: q.code, columnName: q.column_name, stage: q.stage, axis: q.axis, question: q.question,
    option1: q.option1, option2: q.option2, letter1: q.letter1, letter2: q.letter2, sortOrder: q.sort_order,
  }))
}

export async function listSheets({ teacherName = null } = {}) {
  const rows = await fetchAll(() => {
    let q = db.from('record_results')
      .select('teacher_name, class_name, class_time, completed_on, passport_type')
    if (teacherName) q = q.eq('teacher_name', teacherName)
    return q.order('completed_on', { ascending: false }).order('class_name').order('class_time').order('record_id')
  })
  const sheets = new Map()
  for (const r of rows) {
    const key = [r.teacher_name, r.class_name, r.class_time, r.completed_on].join('\u0000')
    if (!sheets.has(key)) sheets.set(key, { header: rowToHeader(r), studentCount: 0, needsFollowUpCount: 0 })
    const sheet = sheets.get(key)
    sheet.studentCount += 1
    if (!r.passport_type) sheet.needsFollowUpCount += 1
  }
  return [...sheets.values()]
}

export async function getSheet(header, questions) {
  const { data, error } = await whereHeader(db.from('records').select('*'), header)
    .order('created_at').order('nickname')
  if (error) throw error
  return data.map(r => rowToStudent(r, questions))
}

export async function saveSheet({ original, header, students, deleteIds }, questions) {
  const { data, error } = await db.rpc('save_sheet', {
    p_original: original ? headerToRow(original) : null,
    p_header: headerToRow(header),
    p_students: students.map(s => studentToRpc(s, questions)),
    p_delete_ids: deleteIds?.length ? deleteIds : null,
  })
  if (error) throw error
  return data
}

export async function deleteSheet(header) {
  const { error } = await whereHeader(db.from('records').delete(), header)
  if (error) throw error
}

function toResult(r) {
  return {
    recordId: r.record_id,
    header: rowToHeader(r),
    nickname: r.nickname,
    memo: r.memo ?? null,
    citizenType: r.citizen_type,
    passportType: r.passport_type,
    passportCounts: {
      F: r.passport_f, P: r.passport_p, A: r.passport_a, T: r.passport_t,
      S: r.passport_s, E: r.passport_e, C: r.passport_c, N: r.passport_n,
    },
    missingCodes: r.missing_codes ?? [],
  }
}

export async function listResults({ teacherName, className, classTime, completedOn, q, needsFollowUp } = {}) {
  const rows = await fetchAll(() => {
    let query = db.from('record_results').select('*')
    if (teacherName) query = query.eq('teacher_name', teacherName)
    if (className) query = query.eq('class_name', className)
    if (classTime) query = query.eq('class_time', classTime)
    if (completedOn) query = query.eq('completed_on', completedOn)
    if (q) query = query.ilike('nickname', `%${escapeLike(q)}%`)
    if (needsFollowUp) query = query.is('passport_type', null)
    return query.order('completed_on', { ascending: false }).order('class_name').order('nickname').order('record_id')
  })
  return rows.map(toResult)
}
