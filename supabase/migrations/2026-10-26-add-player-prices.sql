-- 경쟁 모드 참여자가 직접 정한 가격. 일반 모드 행은 NULL이고 세션(game_sessions)의 가격을 쓴다.
ALTER TABLE game_results ADD COLUMN stock_prices JSONB;
ALTER TABLE game_results ADD COLUMN real_estate_prices JSONB;
