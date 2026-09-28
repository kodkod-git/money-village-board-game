import { describe, it, expect } from 'vitest'
import { calcSynergyType, calcSynergyScores, normalizeSynergyType, getTypeGroup } from './synergyScoring'
import { SYNERGY_TYPES } from '../constants/synergyData'

describe('calcSynergyType', () => {
  it('질문별 선택 글자를 axis 순서대로 이어 유형 코드를 만든다', () => {
    const letters = { q_pocket_money: 'F', q_investment: 'A', q_group_buying: 'E', q_price_compare: 'C' }
    expect(calcSynergyType(letters)).toBe('FAEC')
  })
})

describe('calcSynergyScores', () => {
  // 스모어 FASN 시민권 링크의 16개 결과와 동일해야 한다.
  const FASN_EXPECTED = {
    FAEC: [80, 80], FAEN: [90, 70], FASC: [90, 70], FASN: [100, 60],
    FTEC: [70, 90], FTEN: [80, 80], FTSC: [80, 80], FTSN: [90, 70],
    PAEC: [70, 90], PAEN: [80, 80], PASC: [80, 80], PASN: [90, 70],
    PTEC: [60, 100], PTEN: [70, 90], PTSC: [70, 90], PTSN: [80, 80],
  }

  it.each(Object.entries(FASN_EXPECTED))('%s × FASN', (me, [strength, complement]) => {
    expect(calcSynergyScores(me, 'FASN')).toEqual({ strength, complement })
  })

  it('두 유형 순서를 바꿔도 같은 점수다', () => {
    expect(calcSynergyScores('PTEC', 'FASC')).toEqual(calcSynergyScores('FASC', 'PTEC'))
  })
})

describe('normalizeSynergyType', () => {
  it('대소문자와 무관하게 16개 유형만 허용한다', () => {
    expect(normalizeSynergyType('fasn')).toBe('FASN')
    expect(normalizeSynergyType('XXXX')).toBeNull()
    expect(normalizeSynergyType(undefined)).toBeNull()
  })
})

describe('getTypeGroup', () => {
  it('앞 두 글자로 경제 잠재력 테스트 그룹을 정한다', () => {
    expect(getTypeGroup('PASC')).toBe('Green Group')
    expect(getTypeGroup('PTEN')).toBe('Red Group')
    expect(getTypeGroup('FAEC')).toBe('Orange Group')
    expect(getTypeGroup('FTSN')).toBe('Blue Group')
  })

  it('모든 유형의 대표 동물이 해당 그룹 동물 목록과 일치한다', async () => {
    const { RESULT_GROUPS } = await import('../constants/quizData')
    for (const [code, info] of Object.entries(SYNERGY_TYPES)) {
      expect(RESULT_GROUPS[getTypeGroup(code)].animals).toContain(info.animal)
    }
  })
})
