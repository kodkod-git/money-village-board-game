-- 게임 진행 방식. 6판(기존: 현금·주식·부동산·성공열쇠)과 5판(부동산 없이 진행)이 있다.
-- 게임(수업/대회)을 만들 때 정하고 이후에는 바꾸지 않는다. 기존 게임은 모두 6판이다.
-- 배포 순서: 이 마이그레이션 실행 → 코드 배포. 기본값이 있으므로 기존 코드가 먼저 돌아도 문제없다.
ALTER TABLE boardgame.classes
  ADD COLUMN IF NOT EXISTS board_count smallint NOT NULL DEFAULT 6
  CHECK (board_count IN (5, 6));
