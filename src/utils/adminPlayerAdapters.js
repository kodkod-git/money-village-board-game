export function toAdminPlayer(row) {
  return {
    playerUuid: row.playerUuid,
    name: row.name,
    character: row.character,
    affiliation: row.affiliation,
    gameState: {
      job: row.job ?? null,
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
