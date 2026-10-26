// 경쟁 모드 참여자는 자기가 정한 가격을 갖고, 일반 모드는 그 게임(세션)의 가격을 쓴다.
// result: GET /api/results/:sessionId 응답(최상위 stockPrices/realEstatePrices가 세션 가격).
export function pricesForPlayer(player, result) {
  return {
    stockPrices: player.stockPrices ?? result.stockPrices,
    realEstatePrices: player.realEstatePrices ?? result.realEstatePrices,
  }
}
