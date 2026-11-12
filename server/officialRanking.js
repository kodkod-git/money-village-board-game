// 공식전(대회) 랭킹 계산. DB에 포인트를 저장하지 않고 조회할 때마다 계산한다.
// 그래서 관리자가 결과를 수정하거나 팀을 지워도 다음 조회부터 바로 반영된다.

// 테이블 순위별 포인트. 인원이 n명이면 앞에서 n개를 쓴다(3명: 10/6/3, 2명: 10/6).
export const POINTS = [10, 6, 3, 1]

// 한 테이블(세션)의 결과 → Map<officialPlayerId, { points, isFirst }>.
// 총자산이 같으면 공동 순위로 보고, 그 순위들이 차지하는 포인트를 평균 내서 나눠 준다.
// 1명 테이블은 경쟁 상대가 없어 집계하지 않는다. officialPlayerId가 없는 행은 인원과
// 순위 계산에만 쓰고 포인트는 주지 않는다.
export function tablePoints(results) {
  const awards = new Map()
  if (results.length < 2) return awards

  const sorted = [...results].sort((a, b) => b.totalAssets - a.totalAssets)
  let start = 0
  while (start < sorted.length) {
    let end = start
    while (end + 1 < sorted.length && sorted[end + 1].totalAssets === sorted[start].totalAssets) end++

    let sum = 0
    for (let k = start; k <= end; k++) sum += POINTS[k] ?? 0
    const points = sum / (end - start + 1)

    for (let k = start; k <= end; k++) {
      const id = sorted[k].officialPlayerId
      if (id) awards.set(id, { points, isFirst: start === 0 })
    }
    start = end + 1
  }
  return awards
}

// 앞 사람과 key가 같으면 같은 등수를 준다(1, 1, 3 방식).
function withRanks(sorted, keyOf) {
  let prevKey = null
  let prevRank = 0
  return sorted.map((p, i) => {
    const key = keyOf(p)
    const rank = i > 0 && key === prevKey ? prevRank : i + 1
    prevKey = key
    prevRank = rank
    return { ...p, rank }
  })
}

// rows: { sessionId, contestId, contestName, officialPlayerId, realName, character, totalAssets, createdAt }
// → { points: Row[], bestAssets: Row[] }
export function buildOfficialRankings(rows) {
  const bySession = new Map()
  for (const r of rows) {
    if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, [])
    bySession.get(r.sessionId).push(r)
  }

  const players = new Map()
  for (const tableRows of bySession.values()) {
    const awards = tablePoints(tableRows)
    for (const r of tableRows) {
      const award = awards.get(r.officialPlayerId)
      if (!award) continue

      let p = players.get(r.officialPlayerId)
      if (!p) {
        p = {
          officialPlayerId: r.officialPlayerId,
          realName: r.realName,
          contestId: r.contestId,
          contestName: r.contestName,
          character: r.character,
          points: 0,
          games: 0,
          wins: 0,
          bestAssets: r.totalAssets,
          lastPlayedAt: r.createdAt,
        }
        players.set(r.officialPlayerId, p)
      }
      p.points += award.points
      p.games += 1
      if (award.isFirst) p.wins += 1
      if (r.totalAssets > p.bestAssets) p.bestAssets = r.totalAssets
      if (Date.parse(r.createdAt) > Date.parse(p.lastPlayedAt)) {
        p.character = r.character
        p.lastPlayedAt = r.createdAt
      }
    }
  }

  // 평균 포인트(예: 10/3)를 더하면 부동소수점 오차로 같은 합계가 다르게 비교될 수 있어
  // 소수 둘째 자리에서 반올림한 값으로 정렬하고 보여 준다.
  const list = [...players.values()].map(({ lastPlayedAt, ...p }) => ({
    ...p,
    points: Math.round(p.points * 100) / 100,
  }))

  const byPoints = [...list].sort((a, b) => (b.points - a.points) || (b.bestAssets - a.bestAssets))
  const byBest = [...list].sort((a, b) => b.bestAssets - a.bestAssets)

  return {
    points: withRanks(byPoints, p => `${p.points}|${p.bestAssets}`),
    bestAssets: withRanks(byBest, p => p.bestAssets),
  }
}
