-- 관리자 권한 관리: 소속(orgs) 등록, 관리자 계정, 관리자-소속 접근 매핑.
-- 이 세 테이블은 서비스 롤 키(server/supabase.js)로만 접근하므로 RLS/공개 정책을 두지 않는다.

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_super BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admin_org_access (
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  PRIMARY KEY (admin_id, org_id)
);

-- 완료된 팀(세션)이 어느 소속인지 저장. 기존 행은 미소속/기타로 취급되도록 빈 문자열 기본값.
ALTER TABLE game_sessions ADD COLUMN affiliation TEXT NOT NULL DEFAULT '';
