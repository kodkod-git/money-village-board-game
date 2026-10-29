-- 경쟁 모드를 없앤다(2026-10-21-add-class-mode.sql, 2026-10-26-add-player-prices.sql 되돌리기).
-- 운영 DB 적용 여부와 관계없이 실행할 수 있도록 IF EXISTS를 쓴다.
-- 배포 순서: 이 컬럼을 읽지 않는 코드를 먼저 배포한 뒤 실행한다.
ALTER TABLE boardgame.classes DROP COLUMN IF EXISTS mode;
ALTER TABLE boardgame.game_results DROP COLUMN IF EXISTS stock_prices;
ALTER TABLE boardgame.game_results DROP COLUMN IF EXISTS real_estate_prices;
