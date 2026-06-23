import { supabase } from './supabase.js'

export function calculateTotalAssets(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(stocks).reduce(
    (sum, key) => sum + stocks[key] * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(realEstate).reduce(
    (sum, key) => sum + realEstate[key] * (prices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  return baseAssets * (1 + badgeCount * 0.5)
}

export async function saveGameResult(room) {
  const { code, prices, players } = room

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      team_code: code,
      stock_prices: prices.stocks,
      real_estate_prices: prices.realEstate,
    })
    .select('id')
    .single()

  if (sessionError) throw sessionError

  const rows = players.map(player => ({
    session_id: session.id,
    player_uuid: player.playerUuid,
    name: player.name,
    character: player.character,
    job: player.gameState.job,
    cash: player.gameState.cash ?? 0,
    stock_holdings: player.gameState.stocks,
    real_estate_holdings: player.gameState.realEstate,
    badges: player.gameState.badges,
    total_assets: calculateTotalAssets(player.gameState, prices),
  }))

  const { error: resultsError } = await supabase.from('game_results').insert(rows)
  if (resultsError) throw resultsError

  return session.id
}

export async function getGameResult(sessionId) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('*')
    .eq('session_id', sessionId)
    .order('total_assets', { ascending: false })

  if (resultsError) throw resultsError

  return { session, results }
}
