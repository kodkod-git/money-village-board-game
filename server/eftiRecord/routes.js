// /api/admin/efti-record 라우터. 의존성(repo, xlsx, requireAdmin)을 주입받아 다른 서버로 옮기기 쉽게 한다.
import express from 'express'
import { validateSheet, makeError, isValidDate } from '../../shared/eftiRecord/validation.js'
import { normalizeSheet, normalizeHeader, countChangedAnswers } from '../../shared/eftiRecord/sheetFormat.js'
import { attachCellRefs } from '../../shared/eftiRecord/grid.js'
import { UploadFormatError } from './xlsx.js'

const TEMPLATE_FILENAME = 'EFTI_성향기록지_템플릿.xlsx'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function headerFromQuery(q) {
  return normalizeHeader({
    teacherName: q.teacher_name, className: q.class_name, classTime: q.class_time, completedOn: q.completed_on,
  })
}

function sendError(res, err) {
  if (err?.code === 'EF409') return res.status(409).json({ errors: [makeError('SHEET_EXISTS')] })
  if (err?.code === '23505') return res.status(409).json({ errors: [makeError('NICKNAME_EXISTS')] })
  if (err?.code === 'P0002') return res.status(409).json({ errors: [makeError('STALE_SHEET')] })
  if (['22P02', '22007', '22008'].includes(err?.code)) return res.status(400).json({ errors: [makeError('INVALID_INPUT')] })
  if (err?.type === 'entity.too.large') return res.status(413).json({ errors: [makeError('FILE_TOO_LARGE')] })
  console.error('efti-record error:', err)
  return res.status(500).json({ error: '요청을 처리하지 못했어요' })
}

export function createEftiRecordRouter({ repo, xlsx, requireAdmin }) {
  const router = express.Router()
  router.use(requireAdmin)

  const canAccess = (req, teacherName) => Boolean(req.admin.isSuper) || teacherName === req.admin.username
  const handle = fn => async (req, res) => {
    try {
      await fn(req, res)
    } catch (err) {
      sendError(res, err)
    }
  }

  router.get('/questions', handle(async (_req, res) => {
    res.json(await repo.listQuestions())
  }))

  router.get('/sheets', handle(async (req, res) => {
    res.json(await repo.listSheets({ teacherName: req.admin.isSuper ? null : req.admin.username }))
  }))

  router.get('/sheet', handle(async (req, res) => {
    const header = headerFromQuery(req.query)
    if (!canAccess(req, header.teacherName)) return res.status(403).json({ error: 'Forbidden' })
    const questions = await repo.listQuestions()
    const students = await repo.getSheet(header, questions)
    if (students.length === 0) return res.status(404).json({ error: 'Sheet not found' })
    res.json({ header, students })
  }))

  router.put('/sheet', handle(async (req, res) => {
    const { original = null, header = {}, students = [], deleteIds = [] } = req.body ?? {}
    let teacherName
    if (original) {
      teacherName = normalizeHeader(original).teacherName
      if (!canAccess(req, teacherName)) return res.status(403).json({ error: 'Forbidden' })
    } else {
      const requested = String(header.teacherName ?? '').trim()
      teacherName = req.admin.isSuper && requested ? requested : req.admin.username
    }
    const sheet = { header: { ...header, teacherName }, students }
    const questions = await repo.listQuestions()
    const errors = validateSheet(sheet, questions)
    if (errors.length) return res.status(400).json({ errors })
    const normalized = normalizeSheet(sheet, questions)
    await repo.saveSheet({
      original: original ? normalizeHeader(original) : null,
      header: normalized.header,
      students: normalized.students,
      deleteIds: Array.isArray(deleteIds) ? deleteIds : [],
    }, questions)
    res.json({ header: normalized.header, students: await repo.getSheet(normalized.header, questions) })
  }))

  router.delete('/sheet', handle(async (req, res) => {
    const header = headerFromQuery(req.query)
    if (!canAccess(req, header.teacherName)) return res.status(403).json({ error: 'Forbidden' })
    await repo.deleteSheet(header)
    res.status(204).end()
  }))

  router.post('/upload', express.raw({ type: () => true, limit: '25mb' }), handle(async (req, res) => {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    if (buffer.length === 0) return res.status(400).json({ errors: [makeError('EMPTY_FILE')] })
    const questions = await repo.listQuestions()
    let parsed
    try {
      parsed = await xlsx.parseUpload(buffer, questions)
    } catch (err) {
      if (err instanceof UploadFormatError) return res.status(400).json({ errors: [{ code: err.code, message: err.message }] })
      throw err
    }

    const errors = [...parsed.errors]
    const fileTeacher = String(parsed.header.teacherName ?? '').trim()
    let teacherName = req.admin.username
    if (req.admin.isSuper) teacherName = fileTeacher || req.admin.username
    else if (fileTeacher && fileTeacher !== req.admin.username) errors.push(makeError('TEACHER_MISMATCH', { field: 'teacherName' }))

    const sheet = { header: { ...parsed.header, teacherName }, students: parsed.students }
    errors.push(...validateSheet(sheet, questions))
    const header = normalizeHeader(sheet.header)

    let existing = []
    if (header.className && header.classTime && isValidDate(header.completedOn)) {
      existing = await repo.getSheet(header, questions)
    }
    const byName = new Map(existing.map(s => [s.nickname.trim(), s]))
    const students = parsed.students.map(s => {
      const match = byName.get(s.nickname.trim())
      return match
        ? { ...s, status: 'overwrite', existingId: match.id, changedCount: countChangedAnswers(match.answers, s.answers, questions) }
        : { ...s, status: 'new', existingId: null, changedCount: 0 }
    })
    res.json({ header, students, errors: attachCellRefs(errors, parsed), existingSheet: existing.length > 0 })
  }))

  router.get('/template.xlsx', handle(async (req, res) => {
    const buffer = await xlsx.buildTemplate(await repo.listQuestions(), { teacherName: req.admin.username })
    res.set({
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="efti-record-template.xlsx"; filename*=UTF-8''${encodeURIComponent(TEMPLATE_FILENAME)}`,
    })
    res.send(buffer)
  }))

  router.get('/results', handle(async (req, res) => {
    const q = req.query
    res.json(await repo.listResults({
      teacherName: req.admin.isSuper ? (q.teacher_name || null) : req.admin.username,
      className: q.class_name || null,
      classTime: q.class_time || null,
      completedOn: q.completed_on || null,
      q: String(q.q ?? '').trim() || null,
      needsFollowUp: q.needs_follow_up === '1',
    }))
  }))

  // express.raw 의 크기 초과 등 미들웨어 오류
  router.use((err, _req, res, _next) => sendError(res, err))

  return router
}
