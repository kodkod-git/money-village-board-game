-- survey.efti_test_responses는 스모어에서 이관된 기존 결과 테이블이다.
-- 새 테이블을 만들지 않고 이어서 사용하되, 문항 문구가 앞으로 바뀔 수 있으므로
-- 원문 텍스트가 아닌 정규화된 축 값으로 분석할 수 있도록 컬럼을 보강한다.
--
-- ** 이 마이그레이션 적용과 별개로 필수 (두 단계 모두 필요) **
-- server/supabaseSurvey.js가 supabase-js(PostgREST 경유)로 이 스키마에 접근하려면:
--   1. Supabase 대시보드 Settings > API > Exposed schemas 에 'survey'를 추가한다.
--   2. 아래 GRANT 문을 SQL Editor에서 실행한다. survey 스키마는 스모어 이관 과정에서
--      외부적으로 생성되어 service_role에 기본 권한이 없다(boardgame 스키마는 이 앱이
--      public에서 옮기며 만들었기 때문에 이 단계가 필요 없었다).
-- 1번만 하고 2번을 건너뛰면 PostgREST가 "permission denied for schema survey"(42501)로
-- 계속 거부한다.
GRANT USAGE ON SCHEMA survey TO service_role;
GRANT SELECT, INSERT ON survey.efti_test_responses TO service_role;
ALTER TABLE survey.efti_test_responses
  ADD COLUMN axis_today_tomorrow   text CHECK (axis_today_tomorrow IN ('today', 'tomorrow')),
  ADD COLUMN axis_safety_adventure text CHECK (axis_safety_adventure IN ('safety', 'adventure')),
  ADD COLUMN source text NOT NULL DEFAULT 'app';

UPDATE survey.efti_test_responses
SET source = 'smore_import'
WHERE smore_token IS NOT NULL;

-- 이관 데이터 일부는 문항 텍스트가 미세하게 달라(공백·어미 차이) 문자열 매칭이
-- 어긋나므로, 스모어가 직접 산출해 이관한 result_group을 신뢰할 수 있는 정답으로
-- 보고 축 값을 역산한다.
UPDATE survey.efti_test_responses
SET
  axis_today_tomorrow = CASE
    WHEN result_group IN ('Green Group', 'Red Group')   THEN 'today'
    WHEN result_group IN ('Orange Group', 'Blue Group') THEN 'tomorrow'
  END,
  axis_safety_adventure = CASE
    WHEN result_group IN ('Green Group', 'Orange Group') THEN 'safety'
    WHEN result_group IN ('Red Group', 'Blue Group')     THEN 'adventure'
  END
WHERE result_group IS NOT NULL;

-- RLS: 이미 정책이 있는지 아래 쿼리로 먼저 확인한 뒤 실행한다.
--   SELECT policyname FROM pg_policies WHERE schemaname = 'survey' AND tablename = 'efti_test_responses';
-- 정책이 하나도 없을 때만 아래 두 문장을 실행한다.
ALTER TABLE survey.efti_test_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read efti_test_responses"
  ON survey.efti_test_responses FOR SELECT USING (true);

CREATE POLICY "Service insert efti_test_responses"
  ON survey.efti_test_responses FOR INSERT WITH CHECK (true);
