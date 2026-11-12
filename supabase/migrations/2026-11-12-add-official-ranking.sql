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
