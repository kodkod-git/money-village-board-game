// 앱 전역 토스트 스토어. 컴포넌트 트리 어디서든 toast('메시지')로 호출하고,
// 한 번 마운트된 <Toaster />가 이 스토어를 구독해 화면 구석에 잠깐 띄운다.
// Context를 쓰지 않으므로 개별 페이지 테스트에서 Provider 래핑이 필요 없다.

let toasts = []
let listeners = []
let nextId = 0

function emit() {
  for (const listener of listeners) listener(toasts)
}

export function toast(message, { duration = 3000 } = {}) {
  const id = ++nextId
  toasts = [...toasts, { id, message }]
  emit()
  if (duration > 0) setTimeout(() => dismissToast(id), duration)
  return id
}

export function dismissToast(id) {
  const next = toasts.filter(t => t.id !== id)
  if (next.length === toasts.length) return
  toasts = next
  emit()
}

export function subscribeToasts(listener) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

export function getToasts() {
  return toasts
}

// 테스트 격리용 — 모듈 레벨 상태를 초기화한다.
export function _resetToasts() {
  toasts = []
  listeners = []
  nextId = 0
}
