export function toAdminPlayer(row) {
  return {
    playerUuid: row.playerUuid,
    name: row.name,
    character: row.character,
    affiliation: row.affiliation,
    gameState: {
      job: row.job ?? null,
      // 랭킹/결과 데이터는 게임이 끝난 뒤의 확정 상태이므로, job이 비어 있으면
      // "아직 입력 안 함"이 아니라 무직이다.
      jobVisited: true,
      cash: row.cash ?? 0,
      stocks: row.stockHoldings ?? {},
      realEstate: row.realEstateHoldings ?? {},
      badges: row.badges ?? [false, false, false, false, false, false],
      isCompleted: true,
    },
  }
}

export function toAdminPrices(row) {
  return {
    stocks: row.stockPrices ?? {},
    realEstate: row.realEstatePrices ?? {},
  }
}
