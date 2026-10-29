// 트로피 탭 응답: 수업의 결과 행(getRankings)과 메모리의 클랜(listClans)을 합친다.
function toParticipant(row) {
  return { resultId: row.resultId, name: row.name, character: row.character, teamName: row.teamName }
}

export function buildClanView(rows, clans) {
  const byId = new Map(rows.map(row => [row.resultId, toParticipant(row)]))
  const assigned = new Set()
  const clanViews = clans.map(clan => ({
    id: clan.id,
    name: clan.name,
    members: clan.memberIds
      .filter(id => byId.has(id))
      .map(id => {
        assigned.add(id)
        return byId.get(id)
      }),
  }))
  const participants = [...byId.values()]
    .filter(p => !assigned.has(p.resultId))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko') || a.name.localeCompare(b.name, 'ko'))
  return { participants, clans: clanViews }
}
