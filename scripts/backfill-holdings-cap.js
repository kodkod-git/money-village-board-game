import 'dotenv/config'
import { supabase } from '../server/supabase.js'
import { calculateAssetBreakdown } from '../server/db.js'

const MAX_QUANTITY = 100

function clampHoldings(holdings) {
  const clamped = {}
  let changed = false
  for (const [key, value] of Object.entries(holdings)) {
    if (value > MAX_QUANTITY) {
      clamped[key] = MAX_QUANTITY
      changed = true
    } else {
      clamped[key] = value
    }
  }
  return { clamped, changed }
}

async function main() {
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('id, stock_prices, real_estate_prices')

  if (sessionsError) throw sessionsError

  const pricesBySessionId = new Map(
    sessions.map(s => [s.id, { stocks: s.stock_prices, realEstate: s.real_estate_prices }])
  )

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('id, session_id, cash, stock_holdings, real_estate_holdings, badges')

  if (resultsError) throw resultsError

  let updatedCount = 0

  for (const row of results) {
    const { clamped: stockHoldings, changed: stockChanged } = clampHoldings(row.stock_holdings)
    const { clamped: realEstateHoldings, changed: realEstateChanged } = clampHoldings(row.real_estate_holdings)

    if (!stockChanged && !realEstateChanged) continue

    const prices = pricesBySessionId.get(row.session_id)
    if (!prices) {
      console.warn(`session ${row.session_id}의 가격 정보를 찾을 수 없어 건너뜁니다 (result id: ${row.id})`)
      continue
    }

    const breakdown = calculateAssetBreakdown(
      { cash: row.cash, stocks: stockHoldings, realEstate: realEstateHoldings, badges: row.badges },
      prices
    )

    const { error: updateError } = await supabase
      .from('game_results')
      .update({
        stock_holdings: stockHoldings,
        real_estate_holdings: realEstateHoldings,
        stock_value: breakdown.stockValue,
        real_estate_value: breakdown.realEstateValue,
        total_assets: breakdown.totalAssets,
      })
      .eq('id', row.id)

    if (updateError) {
      console.error(`result id ${row.id} 업데이트 실패:`, updateError.message)
      continue
    }

    updatedCount += 1
    console.log(`result id ${row.id} 백필 완료 (stock_holdings=${JSON.stringify(stockHoldings)}, real_estate_holdings=${JSON.stringify(realEstateHoldings)})`)
  }

  console.log(`백필 완료: ${updatedCount}개 결과 수정 (전체 ${results.length}개 중)`)
}

main().catch(err => {
  console.error('백필 스크립트 실패:', err)
  process.exit(1)
})
