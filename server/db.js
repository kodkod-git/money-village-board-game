import { supabase } from './supabase.js'

export function calculateAssetBreakdown(gameState, prices) {
  const { cash, stocks, realEstate, badges } = gameState
  const badgeCount = badges.filter(Boolean).length

  const stockValue = Object.keys(stocks).reduce(
    (sum, key) => sum + stocks[key] * (prices.stocks[key] ?? 0), 0
  )
  const realEstateValue = Object.keys(realEstate).reduce(
    (sum, key) => sum + realEstate[key] * (prices.realEstate[key] ?? 0), 0
  )
  const baseAssets = (cash ?? 0) + stockValue + realEstateValue
  const totalAssets = baseAssets * (badgeCount * 0.5)

  return { cash: cash ?? 0, stockValue, realEstateValue, totalAssets }
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

  const rows = players.map(player => {
    const breakdown = calculateAssetBreakdown(player.gameState, prices)
    return {
      session_id: session.id,
      player_uuid: player.playerUuid,
      name: player.name,
      affiliation: player.affiliation ?? '',
      character: player.character,
      job: player.gameState.job,
      cash: player.gameState.cash ?? 0,
      stock_holdings: player.gameState.stocks,
      real_estate_holdings: player.gameState.realEstate,
      badges: player.gameState.badges,
      total_assets: breakdown.totalAssets,
      stock_value: breakdown.stockValue,
      real_estate_value: breakdown.realEstateValue,
    }
  })

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

export async function getAllRankings(affiliation = null) {
  let query = supabase
    .from('game_results')
    .select('player_uuid, name, affiliation, character, total_assets, session_id')
    .order('total_assets', { ascending: false })

  if (affiliation) {
    query = query.eq('affiliation', affiliation)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    affiliation: r.affiliation,
    character: r.character,
    totalAssets: Number(r.total_assets),
    sessionId: r.session_id,
    playerUuid: r.player_uuid,
  }))
}
