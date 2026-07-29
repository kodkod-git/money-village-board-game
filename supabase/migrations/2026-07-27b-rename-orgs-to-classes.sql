-- 용어를 소속(org) -> 수업(class)으로 리네이밍하고, 이름 문자열이 아닌 ID로
-- 방/세션이 수업에 연결되도록 바꾼다 (수업명을 나중에 자유롭게 수정할 수 있어야 하므로).

ALTER TABLE orgs RENAME TO classes;

ALTER TABLE admin_org_access RENAME TO admin_class_access;
ALTER TABLE admin_class_access RENAME COLUMN org_id TO class_id;

ALTER TABLE game_sessions ADD COLUMN class_id UUID REFERENCES classes(id);
ALTER TABLE game_sessions DROP COLUMN affiliation;
