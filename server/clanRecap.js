// 트로피 탭 "팀 대결 결과" 스토리: 클랜별 합계와 게임별 결과. 결과 행이 없는(삭제된) 멤버는 세지 않고,
// 멤버가 한 명도 없는 클랜은 비교에서 뺀다. 구 데이터의 null 값은 0으로 더한다.
const SUM_KEYS = ['cash', 'stockValue', 'realEstateValue', 'totalAssets']

function toPlayer(row) {
  return {
    id: row.resultId,
    name: row.name,
    character: row.character,
    totalAssets: Math.round(Math.max(0, Number(row.totalAssets) || 0)),
  }
}

// 게임은 결과 등록 세션 단위. 클랜에 배정된 참여자만 세고, 이름 숫자 순서로 "게임 N" 번호를 매긴다.
function buildGames(members) {
  const sessions = new Map()
  for (const row of members) {
    if (!sessions.has(row.sessionId)) sessions.set(row.sessionId, [])
    sessions.get(row.sessionId).push(row)
  }
  return [...sessions.values()]
    .sort((a, b) => (a[0].teamName ?? '').localeCompare(b[0].teamName ?? '', 'ko', { numeric: true }))
    .map((rows, i) => ({
      id: rows[0].sessionId,
      name: `게임 ${i + 1}`,
      stockPrices: rows[0].stockPrices ?? null,
      realEstatePrices: rows[0].realEstatePrices ?? null,
      players: rows.map(toPlayer).sort((a, b) => b.totalAssets - a.totalAssets),
    }))
}

export function buildClanRecap(rows, clans) {
  const byId = new Map(rows.map(row => [row.resultId, row]))
  const assigned = []
  const teams = clans
    .map(clan => {
      const members = clan.memberIds.map(id => byId.get(id)).filter(Boolean)
      assigned.push(...members)
      const team = { id: clan.id, name: clan.name, memberCount: members.length, members: members.map(toPlayer) }
      for (const key of SUM_KEYS) {
        team[key] = Math.round(members.reduce((sum, m) => sum + Math.max(0, Number(m[key]) || 0), 0))
      }
      return team
    })
    .filter(team => team.memberCount > 0)
  return {
    teamCount: teams.length,
    memberCount: teams.reduce((sum, team) => sum + team.memberCount, 0),
    teams,
    games: buildGames(assigned),
  }
}
