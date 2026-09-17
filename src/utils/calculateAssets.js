import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../constants/gameData'

// server/db.js의 calculateAssetBreakdown과 동일한 공식을 의도적으로 중복 구현한다.
// server/db.js는 Supabase 서버 클라이언트를 로드하므로 브라우저 번들에 직접 import할 수
// 없다 — 진행 중인(미저장) 게임의 총자산을 보여주는 관리자 화면(AdminPlayerCard,
// PlayerAssetReceipt, AdminEditModal, AdminTableView)은 이 클라이언트 전용 사본을 쓴다.
// 공식을 바꿀 때는 반드시 server/db.js의 calculateAssetBreakdown도 함께 수정할 것.
function badgeMultiplier(badgeCount) {
  if (badgeCount >= 6) return 2
  if (badgeCount === 5) return 1.5
  if (badgeCount === 4) return 1.2
  if (badgeCount === 3) return 1.1
  return 1
}

export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(STOCK_LABELS).reduce(
    (sum, key) => sum + (stocks[key] ?? 0) * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(REAL_ESTATE_LABELS).reduce(
    (sum, key) => sum + (realEstate[key] ?? 0) * (prices.realEstate[key] ?? 0), 0
  )
  const totalAssets = Math.round(((cash ?? 0) + stockValue + realEstateValue) * badgeMultiplier(badgeCount))

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
}
