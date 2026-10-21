-- 수업 모드. 'normal'(일반: 학생이 팀을 만들고 참가)과 'competition'(경쟁: 관리자가 팀을 배정)이 있다.
-- 수업을 만들 때 정하고 이후에는 바꾸지 않는다. 기존 수업은 모두 일반 모드가 된다.
ALTER TABLE classes ADD COLUMN mode TEXT NOT NULL DEFAULT 'normal'
  CHECK (mode IN ('normal', 'competition'));
