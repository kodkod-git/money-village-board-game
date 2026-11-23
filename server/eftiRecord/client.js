import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
}

// boardgame과 같은 Supabase 프로젝트의 efti_record 스키마 (server/supabaseSurvey.js 와 같은 방식).
// 대시보드 Settings > API > Exposed schemas 에 efti_record 가 있어야 한다.
export const supabaseEftiRecord = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'efti_record' },
})
