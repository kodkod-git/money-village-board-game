-- 경제적 성향 시너지 테스트(/synergy/:citizenType) 결과 테이블.
-- 퀴즈(efti_test_responses)와 문항·결과 체계가 달라(4문항, 16유형) 별도 테이블로 둔다.
--
-- ** 적용 후 필수 **
-- survey 스키마는 이미 Exposed schemas에 들어가 있으므로(2026-08-24 마이그레이션 참고)
-- 아래 GRANT만 빠뜨리지 않으면 된다. 빠뜨리면 PostgREST가
-- "permission denied for table efti_synergy_responses"(42501)로 거부한다.
CREATE TABLE survey.efti_synergy_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  my_name          text NOT NULL,
  citizen_name     text NOT NULL,
  -- 시민권 QR 링크의 유형 코드 (예: FASN)
  citizen_type     text NOT NULL CHECK (citizen_type ~ '^[FP][TA][SE][NC]$'),
  q_pocket_money   text NOT NULL,
  q_investment     text NOT NULL,
  q_group_buying   text NOT NULL,
  q_price_compare  text NOT NULL,
  my_type          text NOT NULL CHECK (my_type ~ '^[FP][TA][SE][NC]$'),
  -- 강점 강화·상호 보완 지수는 두 유형 코드로 계산되므로 저장하지 않는다 (src/utils/synergyScoring.js)
  source           text NOT NULL DEFAULT 'app',
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON survey.efti_synergy_responses TO service_role;

ALTER TABLE survey.efti_synergy_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read efti_synergy_responses"
  ON survey.efti_synergy_responses FOR SELECT USING (true);

CREATE POLICY "Service insert efti_synergy_responses"
  ON survey.efti_synergy_responses FOR INSERT WITH CHECK (true);
