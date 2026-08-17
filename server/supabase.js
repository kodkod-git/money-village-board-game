import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
}

// public -> boardgame 스키마 분리 (보드게임 웹앱 데이터 전용)
// survey(설문), management(통합관리시스템)와 DB 프로젝트는 공유하되 스키마로 분리 관리
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'boardgame' },
})
