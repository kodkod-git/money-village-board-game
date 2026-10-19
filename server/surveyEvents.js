import { supabaseSurvey } from './supabaseSurvey.js'

// 설문 테스트 행동 로그. 테이블 정의는 supabase/migrations/2026-10-19-add-survey-events.sql
const TABLE = 'survey_events'
const TESTS = ['potential', 'synergy']
const EVENTS = ['visit', 'complete', 'link_click', 'share_click']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TARGET_PATTERN = /^[a-z_]{1,32}$/
const RESULT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
// 탭을 열어 둔 채 자리를 비운 경우까지 평균에 넣으면 값이 크게 튀므로 1시간이 넘는 세션은 평균에서 뺀다.
export const MAX_SESSION_MS = 60 * 60 * 1000

// 공개 API로 들어오므로 형식이 맞는 값만 받는다. 맞지 않으면 null.
export function parseSurveyEvent(body) {
  const { test, event, visitorId, target = null, durationMs = null, resultId = null } = body ?? {}
  if (!TESTS.includes(test) || !EVENTS.includes(event)) return null
  if (!UUID_PATTERN.test(visitorId ?? '')) return null
  if (target !== null && !TARGET_PATTERN.test(target)) return null
  if (resultId !== null && !RESULT_ID_PATTERN.test(String(resultId))) return null
  if (durationMs !== null && !(Number.isInteger(durationMs) && durationMs >= 0 && durationMs < 2 ** 31)) return null
  return {
    test,
    event,
    visitor_id: visitorId,
    target,
    duration_ms: durationMs,
    result_id: resultId === null ? null : String(resultId),
  }
}

export async function saveSurveyEvent(row) {
  const { error } = await supabaseSurvey.from(TABLE).insert(row)
  if (error) throw error
}

const PAGE_SIZE = 1000

export async function listSurveyEvents(test) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseSurvey
      .from(TABLE)
      .select('event, visitor_id, duration_ms, created_at')
      .eq('test', test)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

// 이벤트별 전체 횟수와 유니크 수(visitor_id 중복 제거)를 함께 낸다.
export function summarizeSurveyEvents(events) {
  const byEvent = Object.fromEntries(EVENTS.map(e => [e, { total: 0, visitors: new Set() }]))
  const durations = []
  for (const row of events) {
    const bucket = byEvent[row.event]
    if (!bucket) continue
    bucket.total += 1
    bucket.visitors.add(row.visitor_id)
    if (row.event === 'complete' && row.duration_ms != null && row.duration_ms <= MAX_SESSION_MS) {
      durations.push(row.duration_ms)
    }
  }
  const count = event => ({ total: byEvent[event].total, unique: byEvent[event].visitors.size })
  // 공유받은 결과 화면에서 누른 클릭은 참여 기록이 없다. CTR(참여자 대비 링크 클릭)은 참여한 사람의 클릭만 센다.
  const visitors = byEvent.visit.visitors
  const participantClickers = [...byEvent.link_click.visitors].filter(id => visitors.has(id)).length
  return {
    since: events[0]?.created_at ?? null,
    visit: count('visit'),
    complete: count('complete'),
    linkClick: { ...count('link_click'), participants: participantClickers },
    shareClick: count('share_click'),
    avgDurationMs: durations.length
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : null,
  }
}
