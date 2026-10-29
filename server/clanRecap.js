// 트로피 탭 "팀 대결 결과" 스토리: 클랜별 합계. 결과 행이 없는(삭제된) 멤버는 세지 않고,
// 멤버가 한 명도 없는 클랜은 비교에서 뺀다. 구 데이터의 null 값은 0으로 더한다.
const SUM_KEYS = ['cash', 'stockValue', 'realEstateValue', 'totalAssets']

export function buildClanRecap(rows, clans) {
  const byId = new Map(rows.map(row => [row.resultId, row]))
  const teams = clans
    .map(clan => {
      const members = clan.memberIds.map(id => byId.get(id)).filter(Boolean)
      const team = { id: clan.id, name: clan.name, memberCount: members.length }
      for (const key of SUM_KEYS) {
        team[key] = Math.round(members.reduce((sum, m) => sum + (Number(m[key]) || 0), 0))
      }
      return team
    })
    .filter(team => team.memberCount > 0)
  return {
    teamCount: teams.length,
    memberCount: teams.reduce((sum, team) => sum + team.memberCount, 0),
    teams,
  }
}
