import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../constants/gameData'

// 보드게임 결과(주식·부동산 보유 현황)로 경제적 잠재력 유형을 유추한다.
// 축 A: 역대 모든 플레이어의 평균 보유 수보다 많으면 미래형, 아니면 현재형.
// 축 B: 내 보유 자산 중 빌라·바이오 비중이 절반을 넘으면 위험형, 아니면 안전형.
// 그룹 이름은 경제 잠재력 테스트(RESULT_GROUPS)와 같은 4개 그룹을 그대로 쓴다.
const RISKY_STOCKS = ['bio']
const RISKY_ESTATES = ['dami']

const GROUP_BY_AXES = {
  'future-risky': 'Blue Group',
  'future-safe': 'Orange Group',
  'present-risky': 'Red Group',
  'present-safe': 'Green Group',
}

function sumHoldings(holdings, keys) {
  return keys.reduce((sum, key) => sum + (Number(holdings?.[key]) || 0), 0)
}

export function countHoldings(player) {
  const stocks = sumHoldings(player.stockHoldings, Object.keys(STOCK_LABELS))
  const realEstate = sumHoldings(player.realEstateHoldings, Object.keys(REAL_ESTATE_LABELS))
  const risky = sumHoldings(player.stockHoldings, RISKY_STOCKS) + sumHoldings(player.realEstateHoldings, RISKY_ESTATES)
  return { stocks, realEstate, total: stocks + realEstate, risky }
}

export function calcEconomicPotential(me, players) {
  const mine = countHoldings(me)
  const all = players.length > 0 ? players : [me]
  const average = all.reduce((sum, p) => sum + countHoldings(p).total, 0) / all.length
  const riskyRatio = mine.total > 0 ? mine.risky / mine.total : 0

  const horizon = mine.total > average ? 'future' : 'present'
  const risk = riskyRatio > 0.5 ? 'risky' : 'safe'

  return {
    horizon,
    risk,
    group: GROUP_BY_AXES[`${horizon}-${risk}`],
    holdings: mine,
    average,
    riskyRatio,
  }
}
