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

export async function getAllCompletedTeams() {
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select('*')
  if (sessionsError) throw sessionsError

  const { data: results, error: resultsError } = await supabase
    .from('game_results')
    .select('*')
  if (resultsError) throw resultsError

  return sessions.map(session => ({
    code: session.team_code,
    status: 'completed',
    registered: true,
    createdAt: session.created_at,
    prices: { stocks: session.stock_prices, realEstate: session.real_estate_prices },
    players: results
      .filter(r => r.session_id === session.id)
      .map(r => ({
        playerUuid: r.player_uuid,
        name: r.name,
        character: r.character,
        affiliation: r.affiliation,
        gameState: {
          cash: r.cash,
          job: r.job,
          stocks: r.stock_holdings,
          realEstate: r.real_estate_holdings,
          badges: r.badges,
          isCompleted: true,
        },
      })),
  }))
}

export async function deleteCompletedTeam(teamCode) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('team_code', teamCode)
    .single()
  if (sessionError) throw sessionError

  const { error: resultsError } = await supabase
    .from('game_results')
    .delete()
    .eq('session_id', session.id)
  if (resultsError) throw resultsError

  const { error: sessionDeleteError } = await supabase
    .from('game_sessions')
    .delete()
    .eq('id', session.id)
  if (sessionDeleteError) throw sessionDeleteError
}

const GAME_STATE_TO_COLUMN = {
  job: 'job', cash: 'cash', stocks: 'stock_holdings',
  realEstate: 'real_estate_holdings', badges: 'badges',
}

export async function updateGameResult(teamCode, playerUuid, partialGameState) {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, stock_prices, real_estate_prices')
    .eq('team_code', teamCode)
    .single()
  if (sessionError) throw sessionError

  const { data: current, error: currentError } = await supabase
    .from('game_results')
    .select('*')
    .eq('session_id', session.id)
    .eq('player_uuid', playerUuid)
    .single()
  if (currentError) throw currentError

  const mergedGameState = {
    cash: current.cash,
    job: current.job,
    stocks: current.stock_holdings,
    realEstate: current.real_estate_holdings,
    badges: current.badges,
    ...partialGameState,
  }

  const prices = { stocks: session.stock_prices, realEstate: session.real_estate_prices }
  const breakdown = calculateAssetBreakdown(mergedGameState, prices)

  const updateRow = {}
  for (const [key, column] of Object.entries(GAME_STATE_TO_COLUMN)) {
    if (key in partialGameState) updateRow[column] = partialGameState[key]
  }
  updateRow.total_assets = breakdown.totalAssets
  updateRow.stock_value = breakdown.stockValue
  updateRow.real_estate_value = breakdown.realEstateValue

  const { data: updated, error: updateError } = await supabase
    .from('game_results')
    .update(updateRow)
    .eq('session_id', session.id)
    .eq('player_uuid', playerUuid)
    .select('*')
    .single()
  if (updateError) throw updateError

  return {
    playerUuid: updated.player_uuid,
    name: updated.name,
    character: updated.character,
    affiliation: updated.affiliation,
    gameState: {
      cash: updated.cash,
      job: updated.job,
      stocks: updated.stock_holdings,
      realEstate: updated.real_estate_holdings,
      badges: updated.badges,
      isCompleted: true,
    },
  }
}

const RANKING_SELECT = 'player_uuid, name, affiliation, character, job, cash, stock_holdings, real_estate_holdings, badges, total_assets, stock_value, real_estate_value, session_id, game_sessions(team_code, stock_prices, real_estate_prices)'

function mapRankingRow(r, i) {
  return {
    rank: i + 1,
    name: r.name,
    affiliation: r.affiliation,
    character: r.character,
    job: r.job,
    cash: r.cash,
    stockHoldings: r.stock_holdings,
    realEstateHoldings: r.real_estate_holdings,
    badges: r.badges,
    totalAssets: Number(r.total_assets),
    stockValue: r.stock_value != null ? Number(r.stock_value) : null,
    realEstateValue: r.real_estate_value != null ? Number(r.real_estate_value) : null,
    sessionId: r.session_id,
    playerUuid: r.player_uuid,
    teamCode: r.game_sessions?.team_code ?? '',
    stockPrices: r.game_sessions?.stock_prices ?? null,
    realEstatePrices: r.game_sessions?.real_estate_prices ?? null,
  }
}

export async function getAllRankings(affiliation = null) {
  let query = supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order('total_assets', { ascending: false })

  if (affiliation) {
    query = query.eq('affiliation', affiliation)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map(mapRankingRow)
}

const BOOTH_ORDER_COLUMN = { stock: 'stock_value', realEstate: 'real_estate_value' }

export async function getBoothRankings(category) {
  const column = BOOTH_ORDER_COLUMN[category]
  if (!column) throw new Error(`Unknown booth category: ${category}`)

  const { data, error } = await supabase
    .from('game_results')
    .select(RANKING_SELECT)
    .order(column, { ascending: false })

  if (error) throw error

  return data.map(mapRankingRow)
}
