# 관리자 권한 관리 (소속별 접근 제어) 설계

- Source proposal: `proposal/20260727_admin_mode_authority.md`
- Date: 2026-07-27

## 배경

현재 `/admin`은 인증 없이 열려 있고, 모든 관리자가 진행중/완료된 팀 전체를 본다
(`2026-07-01-admin-mode-design.md`, `2026-07-20-admin-mode-db-design.md`에서 인증은
명시적으로 범위 밖이었음). "소속"이라는 개념도 지금은 플레이어가 `NameInput`에서 입력하는
자유 텍스트 필드(`player.affiliation`, 랭킹 표시용)일 뿐, 방/팀 단위의 독립된 개체가 아니다.

이번 작업은 다음을 새로 도입한다.
1. 관리자 아이디/비밀번호 인증 (회원가입 + 로그인), master 계정(`admin`/`0000`)은 전체 접근
2. "소속(org)"을 등록 가능한 1급 개체로 승격 — 관리자마다 접근 가능한 소속이 제한됨
3. 로그인한 관리자가 새 소속을 생성할 수 있음 (생성자에게 자동으로 접근권 부여)
4. 소속별 QR 코드 — 스캔하면 소속 입력 없이 이름/캐릭터 선택만으로 팀 생성/참여 가능

## 핵심 결정 사항

- **방(room)/세션은 소속에 고정된다.** 기존 플레이어별 자유텍스트 `affiliation` 필드는
  그대로 두고(랭킹 표시용, 변경 없음), 별도로 **방 단위 `affiliation` 필드**를 신설해 관리자
  스코핑에 사용한다. 두 필드는 독립적이며, QR로 생성된 방은 둘 다 같은 값을 갖게 된다.
- 기존 수동 소속 자유텍스트 입력 경로는 유지한다. 등록된 소속 이름과 매칭되지 않는 방은
  관리자 화면에서 **"미소속/기타"** 가상 소속으로 묶이며, `is_super` 관리자만 볼 수 있다.
- 관리자 계정/비밀번호/소속 데이터는 Supabase에 신설 테이블로 저장한다(비밀번호는 해시).
- 로그인 상태는 서버 세션 없이 **JWT 토큰**을 `sessionStorage`에 저장하는 방식으로 유지한다.
- master 계정은 `is_super` 플래그로 구현한다 — 새 소속이 생겨도 자동으로 전체 접근.
- 로그인한 어떤 관리자도 새 소속을 만들 수 있고, 만들면 자동으로 본인에게 접근권이 생긴다.
- 일반 관리자 계정은 **누구나 로그인 화면에서 셀프 회원가입**으로 만든다. 회원가입 구현은
  최소한으로만 한다 (빈 값 체크 정도, 비밀번호 규칙/중복 아이디 안내 UX 폴리싱 없음).
- 권한 검증은 **서버에서 강제**한다 (클라이언트 필터링만으로는 부족 — API를 직접 호출해도
  범위 밖 소속 데이터를 보거나 수정할 수 없어야 함).

## 1. 데이터 모델

**신규 Supabase 테이블**

```sql
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
```

**마이그레이션**: `game_sessions`에 `affiliation TEXT` 컬럼 추가 (완료된 팀의 소속 저장).

**인메모리 room 객체** (`server/rooms.js`): `createRoom()`이 받는 옵션에 `affiliation`
필드 추가, room 객체에 그대로 저장 (스키마 변경 아님, JS 객체 필드 추가).

**Seed**: 서버 최초 기동 시 스크립트/부트스트랩 코드로 `admin`/`0000` 계정을
`is_super: true`로 upsert (이미 있으면 skip).

## 2. 인증

- `POST /api/admin/signup { username, password }` — 빈 값만 검사, bcrypt 해시 후
  `admins`에 insert (`is_super: false` 고정), 토큰 발급.
- `POST /api/admin/login { username, password }` — bcrypt 비교, 성공 시 토큰 발급.
- 토큰은 JWT (`jsonwebtoken`, secret은 env `ADMIN_JWT_SECRET`), payload
  `{ adminId, username, isSuper }`, 만료 12시간.
- `requireAdmin` 미들웨어: `Authorization: Bearer <token>` 검증, 실패 시 401, 성공 시
  `req.admin` 부착. 모든 `/api/admin/*` 라우트에 적용.
- 프론트: 관리자 버튼 클릭 시 로그인/회원가입 폼 등장(탭으로 전환). 성공 시 토큰+username을
  `sessionStorage`에 저장. 이후 관리자 API 호출은 공통 `adminFetch` 헬퍼로 헤더 자동 첨부.
- 로그아웃 시 `sessionStorage`에서 토큰 제거(서버측 무효화 없음, 만료로만 처리).

## 3. 소속 목록 / 생성

- `GET /api/admin/orgs` (`requireAdmin`) — `is_super`면 전체 org + 가상 항목
  "미소속/기타" 포함, 아니면 `admin_org_access`로 연결된 org만.
- `POST /api/admin/orgs { name }` (`requireAdmin`) — 이름 중복(대소문자 무시 트림 비교)
  체크 후 생성, 생성한 관리자에게 `admin_org_access` 자동 부여.
- 라우팅: `/admin` 진입 시 로그인 안 됐으면 로그인/회원가입 폼. 로그인되면 **소속
  리스트업 화면**(신규 `AdminOrgList`)으로 이동, 각 항목에 QR 버튼 포함. 소속 하나를
  클릭하면 기존 `AdminDashboard`(그리드/테이블 뷰)로 이동하되 해당 org로 스코프됨
  (`/admin/:org` 라우트), 뒤로가기로 리스트업 복귀.

## 4. 서버 권한 필터링

- `GET /api/admin/rooms`는 `?org=` 쿼리 필수 + `requireAdmin`. 서버가 해당 admin이 그
  org에 접근 가능한지 먼저 확인(`is_super` 또는 `admin_org_access` 매칭) 후 403/진행.
  통과 시 `listAllRooms()` + `getAllCompletedTeams()`를 `room.affiliation === org`
  (미소속/기타면 매칭 안 되는 방 전체)로 필터링해서 응답.
- `PATCH /api/admin/rooms/:code/players/:playerUuid`, `DELETE /api/admin/rooms/:code`도
  먼저 대상 방의 `affiliation`을 조회해 요청한 admin이 접근 권한 있는지 확인 후 처리.

## 5. 소속별 QR 코드 + 축소된 참여 플로우

- `AdminOrgList`의 각 소속 항목에 QR 버튼 → 기존 `QRModal` 스타일 재사용. 인코딩 URL:
  `${origin}/join?affiliation=<encodeURIComponent(org.name)>` (기존 `code=` 파라미터
  패턴과 동일, `qrcode` 패키지 그대로 사용).
- `NameInput.jsx`: URL에 `affiliation`이 이미 있으면 소속 입력란을 숨기고 "소속: OO"
  읽기 전용 라벨로 표시, 이름만 입력받음. 값은 그대로 기존 파이프라인(`/select` → `/team`)
  으로 params 통해 전달(변경 최소화).
- `Home.jsx`의 `handleCreate`: `POST /api/rooms` 바디에 `{ affiliation }` 추가 →
  `createRoom({ affiliation })`이 room 객체에 저장. 코드로 참여하는 경우는 이미 만들어진
  방의 affiliation을 그대로 따라감(수정 없음).
- 제출 시(`saveGameResult`) `room.affiliation`을 `game_sessions.affiliation`에 저장.

## 6. 기존 자유텍스트 입력 경로

- QR 없이 `/join`으로 직접 들어온 사용자는 소속 자유텍스트 입력을 그대로 유지.
- 값이 등록된 org 이름과 매칭되지 않으면 관리자 화면에서 "미소속/기타" 버킷으로만 조회됨
  (master만 접근 가능).

## 테스트 계획

- **서버**: `admins`/`orgs`/`admin_org_access` CRUD, `requireAdmin` 미들웨어(토큰 없음/
  만료/위조 → 401), `GET/POST /api/admin/orgs` 권한별 응답, `GET /api/admin/rooms` org
  필터링(권한 있음/없음/미소속 버킷), `PATCH`/`DELETE`의 org 기반 403 케이스,
  `createRoom`에 `affiliation` 필드 반영, `saveGameResult`가 `affiliation` 저장하는지.
- **프론트**: 로그인/회원가입 폼, `AdminOrgList`, `NameInput`의 조건부 렌더링(소속 잠김
  상태), `Home.jsx`가 `affiliation`을 포함해 방을 생성하는지, QR 버튼이 올바른 URL을
  생성하는지.

## 범위 밖

- 관리자 계정 관리 UI (비밀번호 변경, 계정 삭제, 다른 admin 목록 조회)
- org 이름 변경/삭제, 이미 생성된 방의 소속 재배정
- 토큰 자동 갱신(refresh token), 로그아웃 후 서버측 토큰 무효화(블랙리스트) — JWT 만료
  (12h)로만 처리
- 회원가입 시 이메일 인증, 비밀번호 규칙 등 추가 검증
