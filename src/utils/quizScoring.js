const AXIS_A_KEYS = ['q_pocket_money', 'q_want_something', 'q_choosing_item']
const AXIS_B_KEYS = ['q_new_activity', 'q_hard_task', 'q_problem_solving']

const RESULT_GROUP = {
  today_safety: 'Green Group',
  today_adventure: 'Red Group',
  tomorrow_safety: 'Orange Group',
  tomorrow_adventure: 'Blue Group',
}

export function calcQuizResult(poles) {
  const todayCount = AXIS_A_KEYS.filter(k => poles[k] === 'today').length
  const adventureCount = AXIS_B_KEYS.filter(k => poles[k] === 'adventure').length

  const axisTodayTomorrow = todayCount >= 2 ? 'today' : 'tomorrow'
  const axisSafetyAdventure = adventureCount >= 2 ? 'adventure' : 'safety'
  const resultGroup = RESULT_GROUP[`${axisTodayTomorrow}_${axisSafetyAdventure}`]

  return { axisTodayTomorrow, axisSafetyAdventure, resultGroup }
}
