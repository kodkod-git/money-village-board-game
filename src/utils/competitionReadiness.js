// 경쟁 모드 "결과 등록" 버튼의 활성 여부와 비활성 이유. 서버(server/competition.js의 competitionStatus)와 같은 조건이다.
export function competitionReadiness(pool, rooms) {
  const pendingTeams = rooms.filter(room => !room.registered && room.players.length > 0)
  const unassigned = pool.length
  const inputting = pendingTeams.reduce(
    (count, room) => count + room.players.filter(p => !p?.gameState?.isCompleted).length, 0
  )
  const reasons = []
  if (unassigned > 0) reasons.push(`미배정 ${unassigned}명`)
  if (inputting > 0) reasons.push(`입력 중 ${inputting}명`)
  if (reasons.length === 0 && pendingTeams.length === 0) reasons.push('등록할 팀이 없어요')
  return { ready: reasons.length === 0, reason: reasons.join(' · ') }
}
