import { supabaseSurvey } from './supabaseSurvey.js'

// 관리자 "응답 및 분석" 화면의 탭 키 → 설문 테이블
export const SURVEY_TABLES = {
  potential: 'efti_test_responses',
  synergy: 'efti_synergy_responses',
}

// PostgREST는 한 번에 최대 1000행까지만 돌려주므로 페이지를 나눠 전부 읽는다.
const PAGE_SIZE = 1000

export async function listSurveyResponses(testKey) {
  const table = SURVEY_TABLES[testKey]
  if (!table) throw new Error(`Unknown survey: ${testKey}`)

  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseSurvey
      .from(table)
      .select('*')
      .order('submitted_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}
