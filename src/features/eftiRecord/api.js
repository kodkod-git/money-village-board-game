import { adminFetch } from '../../utils/adminAuth'

const BASE = '/api/admin/efti-record'
const TEMPLATE_FILENAME = 'EFTI_성향기록지_템플릿.xlsx'

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.errors?.[0]?.message ?? body?.error ?? `HTTP ${status}`)
    this.status = status
    this.errors = body?.errors ?? []
  }
}

async function request(path, options) {
  const res = await adminFetch(`${BASE}${path}`, options)
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body
}

const headerQuery = h => new URLSearchParams({
  teacher_name: h.teacherName ?? '', class_name: h.className ?? '', class_time: h.classTime ?? '', completed_on: h.completedOn ?? '',
}).toString()

export const fetchQuestions = () => request('/questions')
export const fetchSheets = () => request('/sheets')
export const fetchSheet = header => request(`/sheet?${headerQuery(header)}`)
export const deleteSheet = header => request(`/sheet?${headerQuery(header)}`, { method: 'DELETE' })

export const saveSheet = payload => request('/sheet', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

export const uploadFile = file => request('/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: file,
})

export function fetchResults(filters = {}) {
  const params = new URLSearchParams()
  if (filters.teacherName) params.set('teacher_name', filters.teacherName)
  if (filters.className) params.set('class_name', filters.className)
  if (filters.classTime) params.set('class_time', filters.classTime)
  if (filters.completedOn) params.set('completed_on', filters.completedOn)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.needsFollowUp) params.set('needs_follow_up', '1')
  const qs = params.toString()
  return request(`/results${qs ? `?${qs}` : ''}`)
}

export async function downloadTemplate() {
  const res = await adminFetch(`${BASE}/template.xlsx`)
  if (!res.ok) throw new ApiError(res.status, null)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = TEMPLATE_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
