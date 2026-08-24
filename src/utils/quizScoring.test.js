import { describe, it, expect } from 'vitest'
import { calcQuizResult } from './quizScoring'

describe('calcQuizResult', () => {
  it('축 A 3개 모두 today면 today, 축 B 3개 모두 safety면 safety → Green Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'today', q_want_something: 'today', q_choosing_item: 'today',
      q_new_activity: 'safety', q_hard_task: 'safety', q_problem_solving: 'safety',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'today', axisSafetyAdventure: 'safety', resultGroup: 'Green Group' })
  })

  it('축 A 2/3이 today, 축 B 2/3이 adventure → Red Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'today', q_want_something: 'today', q_choosing_item: 'tomorrow',
      q_new_activity: 'adventure', q_hard_task: 'adventure', q_problem_solving: 'safety',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'today', axisSafetyAdventure: 'adventure', resultGroup: 'Red Group' })
  })

  it('축 A 1/3만 today(=2/3 tomorrow), 축 B 1/3만 adventure(=2/3 safety) → Orange Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'today', q_want_something: 'tomorrow', q_choosing_item: 'tomorrow',
      q_new_activity: 'adventure', q_hard_task: 'safety', q_problem_solving: 'safety',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'tomorrow', axisSafetyAdventure: 'safety', resultGroup: 'Orange Group' })
  })

  it('축 A 0/3이 today, 축 B 3/3이 adventure → Blue Group', () => {
    const result = calcQuizResult({
      q_pocket_money: 'tomorrow', q_want_something: 'tomorrow', q_choosing_item: 'tomorrow',
      q_new_activity: 'adventure', q_hard_task: 'adventure', q_problem_solving: 'adventure',
    })
    expect(result).toEqual({ axisTodayTomorrow: 'tomorrow', axisSafetyAdventure: 'adventure', resultGroup: 'Blue Group' })
  })
})
