// 설문 테스트 행동 로그를 서버(/api/survey/events)로 보낸다. 관리자 "테스트 분석" 상단 지표에 쓴다.
// 로그는 테스트 진행을 방해하면 안 되므로 실패해도 조용히 넘어간다.

const VISITOR_KEY = 'survey.visitorId'
const START_KEY_PREFIX = 'survey.startedAt.'

function randomUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  // 오래된 브라우저용 v4 형식 대체
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// 유니크 참여·클릭 수(중복 제거)를 세기 위한 브라우저별 익명 ID. 저장소를 못 쓰면 이번 페이지에서만 유지된다.
let memoryVisitorId = null
export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = randomUuid()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    memoryVisitorId ??= randomUuid()
    return memoryVisitorId
  }
}

// test: 'potential' | 'synergy', event: 'visit' | 'complete' | 'link_click' | 'share_click'
export function trackSurveyEvent(test, event, { target = null, durationMs = null, resultId = null } = {}) {
  try {
    fetch('/api/survey/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test, event, visitorId: getVisitorId(), target, durationMs, resultId }),
      // 외부 링크로 이동하거나 탭을 닫아도 요청이 끝까지 가도록
      keepalive: true,
    })?.catch?.(() => {})
  } catch { /* 로그 실패는 무시 */ }
}

// 세션 시간: 문항 화면에 들어온 시각을 기억해 두었다가 결과 저장이 끝나면 걸린 시간을 complete 이벤트에 싣는다.
export function markSurveyStart(test) {
  try {
    sessionStorage.setItem(START_KEY_PREFIX + test, String(Date.now()))
  } catch { /* 세션 시간만 빠진다 */ }
}

export function takeSurveyDuration(test) {
  try {
    const startedAt = Number(sessionStorage.getItem(START_KEY_PREFIX + test))
    sessionStorage.removeItem(START_KEY_PREFIX + test)
    return startedAt > 0 ? Math.max(0, Date.now() - startedAt) : null
  } catch {
    return null
  }
}
