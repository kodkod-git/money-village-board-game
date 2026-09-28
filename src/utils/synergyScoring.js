import { SYNERGY_QUESTIONS, SYNERGY_TYPES, TYPE_GROUP } from '../constants/synergyData'

export function calcSynergyType(letters) {
  return [...SYNERGY_QUESTIONS]
    .sort((a, b) => a.axis - b.axis)
    .map(q => letters[q.key])
    .join('')
}

// 스모어 원본 결과표에서 역산한 규칙: 다른 글자가 하나 늘 때마다
// 강점 강화 지수는 10 내려가고(100→60), 상호 보완 지수는 10 올라간다(60→100).
export function calcSynergyScores(myType, citizenType) {
  const diff = [...myType].filter((letter, i) => letter !== citizenType[i]).length
  return { strength: 100 - diff * 10, complement: 60 + diff * 10 }
}

export function normalizeSynergyType(value) {
  const upper = typeof value === 'string' ? value.toUpperCase() : ''
  return SYNERGY_TYPES[upper] ? upper : null
}

export function getTypeGroup(type) {
  return TYPE_GROUP[type.slice(0, 2)]
}

// public/synergy/{왼편}_{오른편}.png — 왼편은 나, 오른편은 시민권자의 그룹 색이다.
// 256가지 유형 조합이 그룹 4×4 = 16장 중 하나로 모인다.
export function getSynergyBackground(myType, citizenType) {
  const colorOf = type => getTypeGroup(type).split(' ')[0].toLowerCase()
  return `/synergy/${colorOf(myType)}_${colorOf(citizenType)}.png`
}
