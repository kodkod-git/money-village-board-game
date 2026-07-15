-- 부스 랭킹(주식·부동산)을 위한 컬럼 추가.
-- NOT NULL 제약 없음: 과거 결과는 scripts/backfill-booth-values.js로 별도 백필한다.
ALTER TABLE game_results
  ADD COLUMN stock_value NUMERIC,
  ADD COLUMN real_estate_value NUMERIC;
