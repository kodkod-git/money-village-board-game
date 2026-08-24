import { supabaseSurvey } from './supabaseSurvey.js'

export async function saveQuizResult({
  childName, childAge, answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup,
}) {
  const { data, error } = await supabaseSurvey
    .from('efti_test_responses')
    .insert({
      submitted_at: new Date().toISOString(),
      child_name: childName,
      child_age: childAge,
      q_pocket_money: answers.q_pocket_money,
      q_new_activity: answers.q_new_activity,
      q_want_something: answers.q_want_something,
      q_hard_task: answers.q_hard_task,
      q_choosing_item: answers.q_choosing_item,
      q_problem_solving: answers.q_problem_solving,
      axis_today_tomorrow: axisTodayTomorrow,
      axis_safety_adventure: axisSafetyAdventure,
      result_group: resultGroup,
      source: 'app',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function getQuizResult(id) {
  const { data, error } = await supabaseSurvey
    .from('efti_test_responses')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
