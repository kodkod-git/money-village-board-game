export function getPlayerUuid() {
  let uuid = sessionStorage.getItem('player_uuid')
  if (!uuid) {
    uuid = crypto.randomUUID()
    sessionStorage.setItem('player_uuid', uuid)
  }
  return uuid
}

export function resetPlayerUuid() {
  const uuid = crypto.randomUUID()
  sessionStorage.setItem('player_uuid', uuid)
  return uuid
}
