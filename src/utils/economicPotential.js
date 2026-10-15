import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../constants/gameData'

// 보드게임 결과(현금·주식·부동산)로 경제적 잠재력 유형을 유추한다.
// 다른 참가자 통계 없이 그 플레이어 한 명의 자산만 보고 판단한다 — 결과가 쌓여도 유형이 바뀌지 않는다.
// 가격은 팀(세션)마다 다르므로 그 게임의 가격으로 금액을 계산한다.
// 축 A: 순자산 중 주식·부동산에 투자한 금액 비율이 70%를 넘으면 미래형, 아니면 현재형.
// 축 B: 투자 금액 중 한 종목이 50% 이상을 차지하면(한 종목에 몰아서 투자) 위험형, 아니면 안전형.
//       분모를 순자산이 아닌 투자 금액으로 둬야 "얼마나 투자했나"(축 A)와 겹치지 않는다.
// 그룹 이름은 경제 잠재력 테스트(RESULT_GROUPS)와 같은 4개 그룹을 그대로 쓴다.
export const FUTURE_INVEST_RATIO = 0.7
export const RISKY_CONCENTRATION_RATIO = 0.5

const GROUP_BY_AXES = {
  'future-risky': 'Blue Group',
  'future-safe': 'Orange Group',
  'present-risky': 'Red Group',
  'present-safe': 'Green Group',
}

function assetValues(holdings, prices, keys) {
  return keys.map(key => (Number(holdings?.[key]) || 0) * (Number(prices?.[key]) || 0))
}

// player는 cash, stockHoldings/realEstateHoldings와 그 게임의 stockPrices/realEstatePrices를 가진다.
export function calcInvestment(player) {
  const values = [
    ...assetValues(player.stockHoldings, player.stockPrices, Object.keys(STOCK_LABELS)),
    ...assetValues(player.realEstateHoldings, player.realEstatePrices, Object.keys(REAL_ESTATE_LABELS)),
  ]
  const invested = values.reduce((sum, v) => sum + v, 0)
  const netWorth = (Number(player.cash) || 0) + invested
  return {
    invested,
    netWorth,
    investRatio: netWorth > 0 ? invested / netWorth : 0,
    topAssetRatio: invested > 0 ? Math.max(...values) / invested : 0,
  }
}

// thresholds: 관리자 "전체 결과" 화면에서 기준값을 바꿔 가며 분포를 볼 때만 넘긴다.
export function calcEconomicPotential(player, {
  futureInvestRatio = FUTURE_INVEST_RATIO,
  riskyConcentrationRatio = RISKY_CONCENTRATION_RATIO,
} = {}) {
  const investment = calcInvestment(player)

  const horizon = investment.investRatio > futureInvestRatio ? 'future' : 'present'
  const risk = investment.invested > 0 && investment.topAssetRatio >= riskyConcentrationRatio ? 'risky' : 'safe'

  return {
    horizon,
    risk,
    group: GROUP_BY_AXES[`${horizon}-${risk}`],
    investment,
  }
}
