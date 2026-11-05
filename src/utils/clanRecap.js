// 팀 대결 결과 스토리(ClanRecapStory)의 순위 계산과 문구.
import { STOCK_LABELS, STOCK_IMAGES, REAL_ESTATE_LABELS, ESTATE_IMAGES } from '../constants/gameData'
import { DEFAULT_PRICES } from '../components/PriceSettingModal'

export function topTeams(teams, valueKey) {
  if (teams.length === 0) return []
  const top = Math.max(...teams.map(team => team[valueKey]))
  return teams.filter(team => team[valueKey] === top)
}

export function formatWon(value) {
  return `${value.toLocaleString('ko-KR')}원`
}

// 받침이 있으면 "이", 없으면 "가". 숫자는 읽는 소리로 판단하고, 그 밖의 글자는 "가"로 둔다.
export function withSubjectParticle(word) {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  const isHangul = code >= 0xac00 && code <= 0xd7a3
  const hasBatchim = isHangul ? (code - 0xac00) % 28 !== 0 : '013678'.includes(last)
  return `${word}${hasBatchim ? '이' : '가'}`
}

// 주식·부동산 비교 장의 종목 정의. order는 차트를 그리는 순서다.
const PRICE_KINDS = {
  stock: {
    label: '주식',
    pricesKey: 'stockPrices',
    order: ['bio', 'semiconductor', 'finance'],
    labels: STOCK_LABELS,
    imageOf: key => `/badges/stock/${STOCK_IMAGES[key]}.png`,
    basePrices: DEFAULT_PRICES.stocks,
  },
  estate: {
    label: '부동산',
    pricesKey: 'realEstatePrices',
    order: ['gaon', 'chorong', 'dami'],
    labels: REAL_ESTATE_LABELS,
    imageOf: key => `/badges/estate/${ESTATE_IMAGES[key]}.png`,
    basePrices: DEFAULT_PRICES.realEstate,
  },
}

const MANY_GAMES = 5

function priceTitle(kindLabel, tops) {
  const toText = labels => labels.join('·')
  const [first] = tops
  const allSame = tops.every(top => toText(top.labels) === toText(first.labels))
  // 게임이 많으면 나열한 문장이 차트 자리를 밀어내므로 요약한다(게임별 1위는 차트의 왕관으로 본다).
  if (tops.length >= MANY_GAMES) {
    return allSame
      ? `${kindLabel}의 경우 모든 게임에서 ${withSubjectParticle(toText(first.labels))} 가장 비쌌네요!`
      : `${kindLabel}의 경우 게임마다 가장 비싼 종목이 달랐네요!`
  }
  if (allSame) {
    const games = tops.map(top => top.gameName).join(', ')
    return `${kindLabel}의 경우 ${games} 모두 ${withSubjectParticle(toText(first.labels))} 가장 비쌌네요!`
  }
  if (tops.length === 2) {
    const [a, b] = tops
    return `${kindLabel}의 경우 ${a.gameName}에서는 ${withSubjectParticle(toText(a.labels))} 가장 비쌌는데, ${b.gameName}에서는 ${withSubjectParticle(toText(b.labels))} 가장 비쌌네요!`
  }
  const head = tops.slice(0, -1).map(top => `${top.gameName}에서는 ${toText(top.labels)}`).join(', ')
  const tail = tops[tops.length - 1]
  return `${kindLabel}의 경우 ${head}, ${tail.gameName}에서는 ${withSubjectParticle(toText(tail.labels))} 가장 비쌌네요!`
}

// 게임끼리 같은 종목의 가격을 비교할 자료. 가격 기록이 있는 게임이 둘 미만이거나
// 모든 게임의 가격이 같으면 비교할 거리가 없어 null을 돌려준다.
export function buildPriceComparison(allGames, kind) {
  const { label, pricesKey, order, labels, imageOf, basePrices } = PRICE_KINDS[kind]
  // 가격 기록이 없는 옛 결과는 0원으로 오해되지 않게 빼고 그린다.
  const games = allGames
    .map((game, colorIndex) => ({ game, colorIndex }))
    .filter(({ game }) => order.some(key => game[pricesKey]?.[key] != null))
  if (games.length < 2) return null

  // 가격을 한 번도 바꾸지 않은 종목은 저장값이 없을 수 있어 시작 가격으로 본다.
  const priceOf = (game, key) => Number(game[pricesKey][key] ?? basePrices[key])
  const differs = order.some(key => new Set(games.map(({ game }) => priceOf(game, key))).size > 1)
  if (!differs) return null

  const topKeysOf = game => {
    const top = Math.max(...order.map(key => priceOf(game, key)))
    return order.filter(key => priceOf(game, key) === top)
  }
  const tops = games.map(({ game }) => ({
    gameName: game.name,
    labels: topKeysOf(game).map(key => labels[key]),
  }))

  return {
    title: priceTitle(label, tops),
    // 세 차트가 같은 축을 써야 종목끼리도 길이로 비교할 수 있다.
    maxPrice: Math.max(...games.flatMap(({ game }) => order.map(key => priceOf(game, key)))),
    charts: order.map(key => ({
      key,
      label: labels[key],
      image: imageOf(key),
      bars: games.map(({ game, colorIndex }) => ({
        gameId: game.id,
        gameName: game.name,
        colorIndex,
        price: priceOf(game, key),
        isTop: topKeysOf(game).includes(key),
      })),
    })),
  }
}
