// 수업 모드('normal' | 'competition')를 조회한다. 알 수 없으면 기존 흐름(일반)을 유지한다.
export function fetchClassMode(classId) {
  if (!classId) return Promise.resolve('normal')
  return fetch(`/api/classes/${encodeURIComponent(classId)}/mode`)
    .then(r => (r.ok ? r.json() : {}))
    .then(data => (data?.mode === 'competition' ? 'competition' : 'normal'))
    .catch(() => 'normal')
}
