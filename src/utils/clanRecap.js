// 팀 대결 결과 스토리(ClanRecapStory)의 장 정의와 순위 계산.
export const RECAP_CATEGORIES = [
  { valueKey: 'cash', title: '현금을 가장 많이 모은 팀은?', theme: 'cash' },
  { valueKey: 'stockValue', title: '주식으로 가장 많이 번 팀은?', theme: 'stock' },
  { valueKey: 'realEstateValue', title: '부동산으로 가장 많이 번 팀은?', theme: 'estate' },
  { valueKey: 'totalAssets', title: '총 자산이 가장 많은 팀은?', theme: 'total' },
]

// 값이 큰 순서. Array.prototype.sort는 안정 정렬이라 동점이면 원래(클랜) 순서를 지킨다.
export function rankTeams(teams, valueKey) {
  return [...teams].sort((a, b) => b[valueKey] - a[valueKey])
}

export function topTeams(teams, valueKey) {
  if (teams.length === 0) return []
  const top = Math.max(...teams.map(team => team[valueKey]))
  return teams.filter(team => team[valueKey] === top)
}

export function formatWon(value) {
  return `${value.toLocaleString('ko-KR')}원`
}
