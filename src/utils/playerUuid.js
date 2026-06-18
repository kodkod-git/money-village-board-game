export function getPlayerUuid() {
  let uuid = localStorage.getItem('player_uuid')
  if (!uuid) {
    uuid = crypto.randomUUID()
    localStorage.setItem('player_uuid', uuid)
  }
  return uuid
}
