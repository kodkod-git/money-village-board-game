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
