import { BADGE_NAMES, BADGE_LABELS, STOCK_LABELS, REAL_ESTATE_LABELS } from '../constants/gameData'
import { GUIDE_KEY_ORDER } from '../constants/parentGuide'
import { badgeMultiplier } from './calculateAssets'
import { calcEconomicPotential } from './economicPotential'

// 학부모 안내서에 들어갈 한 학생의 값을 계산한다(이름·수업일 제외).
// 금액은 결과 화면과 같은 공식(현금 + 주식 + 부동산) × 성공열쇠 배수를 쓴다.

export function formatManwon(won) {
  const value = Math.round(Number(won) || 0)
  if (Math.abs(value) < 10000) return `${value.toLocaleString('ko-KR')}원`
  return `${(value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}만원`
}

function heldValues(holdings, prices, labels) {
  return Object.keys(labels).map(key => ({
    key,
    count: Number(holdings?.[key]) || 0,
    value: (Number(holdings?.[key]) || 0) * (Number(prices?.[key]) || 0),
  }))
}

// 반올림해도 합이 100이 되도록 나머지가 큰 순서로 1%씩 더한다(최대 나머지 방식).
function percentages(values) {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map(v => (v / total) * 100)
  const pcts = raw.map(Math.floor)
  let left = 100 - pcts.reduce((sum, p) => sum + p, 0)
  raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .sort((a, b) => b.rest - a.rest)
    .forEach(({ i }) => { if (left > 0) { pcts[i] += 1; left -= 1 } })
  return pcts
}

// "주식 3종목과 부동산" / "주식 2종목" / "부동산 2곳" — 나눠 담은 곳을 예시 문장 그대로의 말투로 부른다.
function holdingsPhrase(stockKinds, estateKinds) {
  const stock = stockKinds > 0 ? `주식 ${stockKinds}종목` : null
  if (stock && estateKinds > 0) return `${stock}과 부동산`
  if (stock) return stock
  return estateKinds > 1 ? `부동산 ${estateKinds}곳` : '부동산'
}

// 예시 안내문(example/*.pdf)의 그룹별 문장을 쓰되, 학생마다 달라지는 부분(몰아 넣은 자산 종류,
// 나눠 담은 종목 수, 모은 성공열쇠 수)만 그 학생의 결과로 바꿔 넣는다.
function buildBullets(group, { topIsEstate, stockKinds, estateKinds, keyCount }) {
  const invested = stockKinds + estateKinds > 0
  switch (group) {
    case 'Blue Group':
      return [
        '현금은 조금만 남기고 대부분을 미래를 위해 투자했어요.',
        topIsEstate ? '마음에 든 부동산 한 곳에 크게 투자했어요.' : '마음에 든 주식 한 종목에 크게 투자했어요.',
        '가격이 오를 때까지 기다리며 길게 내다봤어요.',
      ]
    case 'Red Group':
      return [
        '현금과 예금을 넉넉히 남겨, 지금 쓸 돈을 먼저 챙겼어요.',
        topIsEstate ? '부동산은 마음에 드는 한 곳에 크게 투자했어요.' : '주식은 마음에 드는 한 종목에 크게 투자했어요.',
        '기회가 보이면 망설이지 않고 바로 움직였어요.',
      ]
    case 'Orange Group': {
      const kinds = [stockKinds > 0 && '주식', estateKinds > 0 && '부동산'].filter(Boolean).join('·')
      return [
        `현금은 조금만 남기고 ${kinds}에 투자했어요.`,
        `${holdingsPhrase(stockKinds, estateKinds)}에 나눠 담아, 한 곳에 몰지 않았어요.`,
        '예금도 함께 맡겨 기다림의 가치를 챙겼어요.',
      ]
    }
    default: // Green Group
      return [
        '현금과 예금을 넉넉히 남겨, 지금 필요한 돈을 먼저 챙겼어요.',
        invested
          ? `${holdingsPhrase(stockKinds, estateKinds)}에 조금씩 나눠 담았어요.`
          : '투자보다 현금을 안전하게 지키는 쪽을 골랐어요.',
        keyCount >= 6
          ? '6개 부스를 모두 경험해 성공열쇠 6개를 모았어요.'
          : keyCount > 0
            ? `${keyCount}개 부스를 경험해 성공열쇠 ${keyCount}개를 모았어요.`
            : '다음 수업에서는 더 많은 부스를 경험해 볼 수 있어요.',
      ]
  }
}

// player: cash, stockHoldings, realEstateHoldings, badges / prices: 그 게임(세션)의 stockPrices, realEstatePrices
export function buildParentGuide(player, { stockPrices, realEstatePrices }) {
  const stocks = heldValues(player.stockHoldings, stockPrices, STOCK_LABELS)
  const estates = heldValues(player.realEstateHoldings, realEstatePrices, REAL_ESTATE_LABELS)
  const cash = Number(player.cash) || 0
  const stockValue = stocks.reduce((sum, s) => sum + s.value, 0)
  const realEstateValue = estates.reduce((sum, e) => sum + e.value, 0)
  const baseAssets = cash + stockValue + realEstateValue

  const badges = player.badges ?? []
  const owned = new Set(BADGE_NAMES.filter((_, i) => badges[i]))
  const keyCount = owned.size
  const multiplier = badgeMultiplier(keyCount)
  const finalAssets = Math.round(baseAssets * multiplier)

  const [cashPct, stockPct, estatePct] = percentages([cash, stockValue, realEstateValue])
  const stockKinds = stocks.filter(s => s.count > 0).length
  const estateKinds = estates.filter(e => e.count > 0).length
  const top = [...stocks, ...estates].reduce((best, a) => (a.value > best.value ? a : best), { value: -1 })

  const { group } = calcEconomicPotential({ ...player, stockPrices, realEstatePrices })

  return {
    cash,
    stockValue,
    stockKinds,
    realEstateValue,
    baseAssets,
    keyCount,
    multiplier,
    bonus: finalAssets - baseAssets,
    finalAssets,
    split: [
      { key: 'cash', label: '현금', pct: cashPct },
      { key: 'stock', label: '주식', pct: stockPct },
      { key: 'estate', label: '부동산', pct: estatePct },
    ],
    keys: GUIDE_KEY_ORDER.map(name => ({ key: name, label: BADGE_LABELS[name], on: owned.has(name) })),
    group,
    bullets: buildBullets(group, {
      topIsEstate: top.key in REAL_ESTATE_LABELS,
      stockKinds,
      estateKinds,
      keyCount,
    }),
  }
}
