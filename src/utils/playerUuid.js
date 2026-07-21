export function getPlayerUuid() {
  let uuid = sessionStorage.getItem('player_uuid')
  if (!uuid) {
    uuid = crypto.randomUUID()
    sessionStorage.setItem('player_uuid', uuid)
  }
  return uuid
}
