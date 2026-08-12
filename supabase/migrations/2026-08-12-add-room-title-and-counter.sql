-- 관리자가 방을 만들 때 기본 이름(TEAM N)에 쓸 수업별 카운터.
-- 방을 삭제해도 번호를 재사용하지 않기 위해 rooms.js(메모리)가 아닌 여기(영속 DB)에 둔다.
ALTER TABLE classes ADD COLUMN room_counter INTEGER NOT NULL DEFAULT 0;

-- 관리자가 만든 방의 표시 이름. 학생이 만든 방은 NULL로 두어 기존 "~님의 방" 표시를 유지한다.
ALTER TABLE game_sessions ADD COLUMN title TEXT;
