import 'dotenv/config'
import { supabase } from '../server/supabase.js'
import { calculateAssetBreakdown } from '../server/db.js'

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
    .select('id, session_id, cash, stock_holdings, real_estate_holdings, badges, stock_value')

  if (resultsError) throw resultsError

  const toBackfill = results.filter(r => r.stock_value === null)
  console.log(`${toBackfill.length}개 결과를 백필합니다 (전체 ${results.length}개)`)

  for (const row of toBackfill) {
    const prices = pricesBySessionId.get(row.session_id)
    if (!prices) {
      console.warn(`session ${row.session_id}의 가격 정보를 찾을 수 없어 건너뜁니다 (result id: ${row.id})`)
      continue
    }

    const breakdown = calculateAssetBreakdown(
      { cash: row.cash, stocks: row.stock_holdings, realEstate: row.real_estate_holdings, badges: row.badges },
      prices
    )

    const { error: updateError } = await supabase
      .from('game_results')
      .update({ stock_value: breakdown.stockValue, real_estate_value: breakdown.realEstateValue })
      .eq('id', row.id)

    if (updateError) {
      console.error(`result id ${row.id} 업데이트 실패:`, updateError.message)
      continue
    }

    console.log(`result id ${row.id} 백필 완료 (stock_value=${breakdown.stockValue}, real_estate_value=${breakdown.realEstateValue})`)
  }

  console.log('백필 완료')
}

main().catch(err => {
  console.error('백필 스크립트 실패:', err)
  process.exit(1)
})
