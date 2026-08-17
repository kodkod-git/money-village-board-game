-- 보드게임 웹앱(money-village-board-game) 데이터를 public -> boardgame 스키마로 이동
--
-- ** 실행 전 필수 체크리스트 **
-- 1. 진행 중인 게임 세션이 없는 시간대에 실행할 것 (라이브 이벤트 중 실행 금지)
-- 2. 이 마이그레이션 적용 직후, Supabase 대시보드 Settings > API > Exposed schemas 에
--    'boardgame' 을 추가할 것 (안 하면 PostgREST가 이 스키마를 못 찾음)
-- 3. server/supabase.js 의 클라이언트 생성 코드가
--    createClient(..., { db: { schema: 'boardgame' } }) 로 이미 반영되어 있는 상태에서
--    최대한 빨리 함께 배포(Railway 재배포)할 것
--    (이 마이그레이션 적용 ~ 코드 배포 사이는 기존 코드가 깨짐)
--
-- 데이터/인덱스/FK/RLS 정책은 ALTER TABLE ... SET SCHEMA 로 모두 그대로 유지된 채 이동됨.
-- 이 저장소는 Supabase CLI로 프로젝트에 링크되어 있지 않으므로,
-- Supabase 대시보드 SQL Editor에서 직접 실행하거나 `supabase link` 후 `supabase db push` 사용.

CREATE SCHEMA IF NOT EXISTS boardgame;

ALTER TABLE public.game_sessions SET SCHEMA boardgame;
ALTER TABLE public.game_results SET SCHEMA boardgame;
ALTER TABLE public.admins SET SCHEMA boardgame;
ALTER TABLE public.classes SET SCHEMA boardgame;
ALTER TABLE public.admin_class_access SET SCHEMA boardgame;
