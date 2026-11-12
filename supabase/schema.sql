-- game_sessions: 게임 세션 (팀코드 = 1세션)
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_code TEXT UNIQUE NOT NULL,
  stock_prices JSONB NOT NULL,
  real_estate_prices JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- game_results: 플레이어별 결과
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_uuid UUID NOT NULL,
  name TEXT NOT NULL,
  character TEXT NOT NULL,
  job TEXT NOT NULL,
  cash INTEGER NOT NULL,
  stock_holdings JSONB NOT NULL,
  real_estate_holdings JSONB NOT NULL,
  badges JSONB NOT NULL,
  total_assets NUMERIC NOT NULL,
  stock_value NUMERIC,
  real_estate_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- 읽기는 공개 (URL 공유로 결과 조회 가능)
CREATE POLICY "Public read game_sessions"
  ON game_sessions FOR SELECT USING (true);

CREATE POLICY "Public read game_results"
  ON game_results FOR SELECT USING (true);

-- 서버에서 결과 저장 허용
CREATE POLICY "Service insert game_sessions"
  ON game_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Service insert game_results"
  ON game_results FOR INSERT WITH CHECK (true);

-- 2026-11-12 공식전 랭킹
-- 공식전(대회) 랭킹. 대회는 classes 행 중 kind = 'official'인 것이다.
-- 예전에 삭제한 classes.mode(경쟁 모드)와 헷갈리지 않도록 컬럼 이름을 kind로 한다.
-- 배포 순서: 이 마이그레이션 실행 → 코드 배포. 새 컬럼은 기본값이 있거나 null을 허용하므로
-- 기존 코드가 먼저 돌아도 문제없다.
ALTER TABLE boardgame.classes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'class'
  CHECK (kind IN ('class', 'official'));

-- 공식 참가자. 식별 기준은 "실명 + 대회"다. 기기 단위인 player_uuid로는 다른 기기에서 한
-- 게임을 묶을 수 없어서 따로 둔다. real_name은 서버가 앞뒤 공백을 제거해서 저장한다.
CREATE TABLE IF NOT EXISTS boardgame.official_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES boardgame.classes(id) ON DELETE CASCADE,
  real_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, real_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON boardgame.official_players TO service_role;
ALTER TABLE boardgame.official_players ENABLE ROW LEVEL SECURITY;

-- 공식전 결과와 공식 참가자를 연결한다. 일반 게임은 null.
ALTER TABLE boardgame.game_results
  ADD COLUMN IF NOT EXISTS official_player_id uuid
  REFERENCES boardgame.official_players(id) ON DELETE SET NULL;
