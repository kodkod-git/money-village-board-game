import { STOCK_LABELS, REAL_ESTATE_LABELS, MAX_ASSET_PRICE } from '../src/constants/gameData.js'

// 경쟁 모드 참여자가 처음 받는 가격. src/components/PriceSettingModal.jsx의 DEFAULT_PRICES와 같다.
export const DEFAULT_PLAYER_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, bio: 2000 },
  realEstate: { gaon: 10000, dami: 10000, chorong: 10000 },
}

function isValidPrice(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ASSET_PRICE
}

function sanitizeCategory(values, labels, defaults) {
  const source = values && typeof values === 'object' ? values : {}
  return Object.fromEntries(Object.keys(labels).map(key => [
    key, isValidPrice(source[key]) ? source[key] : defaults[key],
  ]))
}

// 참여자가 보낸 가격은 정해진 종목 키만, 0 이상 MAX_ASSET_PRICE 이하의 정수만 받는다.
export function sanitizePrices(prices) {
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) return undefined
  return {
    stocks: sanitizeCategory(prices.stocks, STOCK_LABELS, DEFAULT_PLAYER_PRICES.stocks),
    realEstate: sanitizeCategory(prices.realEstate, REAL_ESTATE_LABELS, DEFAULT_PLAYER_PRICES.realEstate),
  }
}

export function withSanitizedPrices(gameState) {
  if (!gameState || !('prices' in gameState)) return gameState
  const { prices, ...rest } = gameState
  const sanitized = sanitizePrices(prices)
  return sanitized ? { ...rest, prices: sanitized } : rest
}
