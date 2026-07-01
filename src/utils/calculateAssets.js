export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(stocks).reduce(
    (sum, key) => sum + stocks[key] * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(realEstate).reduce(
    (sum, key) => sum + realEstate[key] * (prices.realEstate[key] ?? 0), 0
  )
  const totalAssets = ((cash ?? 0) + stockValue + realEstateValue) * (badgeCount * 0.5)

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
