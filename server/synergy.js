import { supabaseSurvey } from './supabaseSurvey.js'

export async function saveSynergyResult({ myName, citizenName, citizenType, myType, answers }) {
  const { data, error } = await supabaseSurvey
    .from('efti_synergy_responses')
    .insert({
      submitted_at: new Date().toISOString(),
      my_name: myName,
      citizen_name: citizenName,
      citizen_type: citizenType,
      q_pocket_money: answers.q_pocket_money,
      q_investment: answers.q_investment,
      q_group_buying: answers.q_group_buying,
      q_price_compare: answers.q_price_compare,
      my_type: myType,
      source: 'app',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function getSynergyResult(id) {
  const { data, error } = await supabaseSurvey
    .from('efti_synergy_responses')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
