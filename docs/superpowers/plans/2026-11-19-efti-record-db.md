# EFTI 반별 성향기록지 DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase에 `efti_record` 스키마를 만들어 성향기록지 응답(CSV)을 저장하고, 뷰로 시민권·여권 유형을 자동 계산한다.

**Architecture:** 문항 마스터 `questions`(정답표 52행 시드) + 넓은 응답 테이블 `records`(학생 1행, 문항 52컬럼) + 계산 뷰 `record_results`. 뷰는 `to_jsonb(record) ->> column_name` 으로 응답을 문항 단위로 펼쳐 `questions` 와 조인해 센다. 검증은 Docker의 로컬 Postgres 15에서 먼저 하고, 마지막에 Supabase SQL Editor에서 적용·재검증한다.

**Tech Stack:** PostgreSQL 15 (Supabase), Docker (`postgres:15` 이미지, 로컬 검증용), psql

**Spec:** `docs/superpowers/specs/2026-11-19-efti-record-db-design.md`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/tests/efti_record_verify.sql` | 검증 스크립트. BEGIN … ROLLBACK 안에서 샘플을 넣고 기대값과 다르면 `RAISE EXCEPTION`. 로컬·Supabase 양쪽에서 같은 파일 사용 |
| `supabase/migrations/2026-11-19-add-efti-record-schema.sql` | 스키마, `questions` + 시드, `records`, `record_results` 뷰, 권한·RLS |
| `supabase/templates/efti_record_import_template.csv` | CSV 헤더 1줄 (선생님이 채워서 Import) |

로컬 검증 공통 명령 (Git Bash, 저장소 루트에서):

```bash
# 컨테이너 시작 (처음 한 번)
docker run -d --name efti-pg -e POSTGRES_PASSWORD=pg postgres:15
# 준비될 때까지 대기
until docker exec efti-pg pg_isready -U postgres >/dev/null 2>&1; do :; done
# Supabase에 원래 있는 역할 흉내
docker exec -i efti-pg psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE service_role;"
```

DB 초기화가 필요하면: `docker rm -f efti-pg` 후 위 명령 재실행.

---

### Task 1: 검증 스크립트 작성 (실패 확인)

**Files:**
- Create: `supabase/tests/efti_record_verify.sql`

- [ ] **Step 1: 검증 스크립트 작성**

```sql
-- EFTI 성향기록지 DB 검증 스크립트
-- 2026-11-19-add-efti-record-schema.sql 적용 후 SQL Editor(또는 psql)에서 실행한다.
-- 트랜잭션 안에서 샘플을 넣고 확인한 뒤 ROLLBACK 하므로 실제 데이터는 남지 않는다.
-- 기대값과 다르면 RAISE EXCEPTION 으로 멈춘다. 끝까지 가면 'ALL PASSED' 를 알린다.

BEGIN;

DO $$
DECLARE
  cols text;
  ones text;
  v record;
  n int;
BEGIN
  -- 1. 문항 마스터 개수
  SELECT count(*) INTO n FROM efti_record.questions;
  IF n <> 52 THEN RAISE EXCEPTION 'questions: 52행이어야 하는데 %행', n; END IF;

  SELECT count(*) INTO n FROM efti_record.questions WHERE stage = 1;
  IF n <> 28 THEN RAISE EXCEPTION 'questions: 1단계 28문항이어야 하는데 %', n; END IF;

  SELECT count(*) INTO n FROM efti_record.questions WHERE stage = 2;
  IF n <> 24 THEN RAISE EXCEPTION 'questions: 2단계 24문항이어야 하는데 %', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT axis FROM efti_record.questions WHERE stage = 1 GROUP BY axis HAVING count(*) <> 7
  ) s;
  IF n <> 0 THEN RAISE EXCEPTION 'questions: 1단계 축별 7문항이 아님'; END IF;

  SELECT count(*) INTO n FROM (
    SELECT axis FROM efti_record.questions GROUP BY axis HAVING count(*) <> 13
  ) s;
  IF n <> 0 THEN RAISE EXCEPTION 'questions: 전체 축별 13문항이 아님'; END IF;

  -- 2. questions.column_name 과 records 의 q* 컬럼이 정확히 일치
  SELECT count(*) INTO n FROM (
    (SELECT column_name::text FROM information_schema.columns
      WHERE table_schema = 'efti_record' AND table_name = 'records' AND column_name::text ~ '^q[0-9]'
     EXCEPT SELECT column_name FROM efti_record.questions)
    UNION ALL
    (SELECT column_name FROM efti_record.questions
     EXCEPT SELECT column_name::text FROM information_schema.columns
      WHERE table_schema = 'efti_record' AND table_name = 'records')
  ) d;
  IF n <> 0 THEN RAISE EXCEPTION 'records 컬럼과 questions.column_name 불일치 (%개)', n; END IF;

  -- 샘플 학생: all1(전부 1), all2(전부 2), miss2(2단계 33-2 빈칸), miss12(15-1, 46 빈칸)
  SELECT string_agg(quote_ident(column_name), ',' ORDER BY sort_order),
         string_agg('1', ',')
    INTO cols, ones
    FROM efti_record.questions;

  EXECUTE format(
    'INSERT INTO efti_record.records (class_name, class_time, teacher_name, nickname, completed_on, %s)
     VALUES (%L,%L,%L,%L,%L,%s), (%L,%L,%L,%L,%L,%s), (%L,%L,%L,%L,%L,%s), (%L,%L,%L,%L,%L,%s)',
    cols,
    '검증반', '토 10:00', '검증선생', 'all1',   '2026-11-19', ones,
    '검증반', '토 10:00', '검증선생', 'all2',   '2026-11-19', ones,
    '검증반', '토 10:00', '검증선생', 'miss2',  '2026-11-19', ones,
    '검증반', '토 10:00', '검증선생', 'miss12', '2026-11-19', ones);

  EXECUTE format(
    'UPDATE efti_record.records SET (%s) = ROW(%s) WHERE nickname = %L AND class_name = %L',
    cols, replace(ones, '1', '2'), 'all2', '검증반');
  UPDATE efti_record.records SET q33_2 = NULL WHERE nickname = 'miss2' AND class_name = '검증반';
  UPDATE efti_record.records SET q15_1 = NULL, q46 = NULL WHERE nickname = 'miss12' AND class_name = '검증반';

  -- 3. 전부 1: 1단계 T(F1 P6) R(A7) O(S7) D(C6 N1) → PASC
  --           합산 T(F6 P7) R(A13) O(S9 E4) D(C6 N7) → PASN
  SELECT * INTO v FROM efti_record.record_results WHERE nickname = 'all1' AND class_name = '검증반';
  IF v.citizen_type IS DISTINCT FROM 'PASC' THEN RAISE EXCEPTION 'all1 citizen_type: PASC 기대, % 나옴', v.citizen_type; END IF;
  IF v.passport_type IS DISTINCT FROM 'PASN' THEN RAISE EXCEPTION 'all1 passport_type: PASN 기대, % 나옴', v.passport_type; END IF;
  IF (v.citizen_f, v.citizen_p, v.citizen_a, v.citizen_t, v.citizen_s, v.citizen_e, v.citizen_c, v.citizen_n)
     IS DISTINCT FROM (1::bigint, 6::bigint, 7::bigint, 0::bigint, 7::bigint, 0::bigint, 6::bigint, 1::bigint) THEN
    RAISE EXCEPTION 'all1 citizen 개수 불일치';
  END IF;
  IF (v.passport_f, v.passport_p, v.passport_a, v.passport_t, v.passport_s, v.passport_e, v.passport_c, v.passport_n)
     IS DISTINCT FROM (6::bigint, 7::bigint, 13::bigint, 0::bigint, 9::bigint, 4::bigint, 6::bigint, 7::bigint) THEN
    RAISE EXCEPTION 'all1 passport 개수 불일치';
  END IF;
  IF v.missing_codes IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'all1 missing_codes: {} 기대, % 나옴', v.missing_codes; END IF;

  -- 전부 2: 1단계 → FTEN, 합산 T(F7 P6) R(T13) O(S4 E9) D(C7 N6) → FTEC
  SELECT * INTO v FROM efti_record.record_results WHERE nickname = 'all2' AND class_name = '검증반';
  IF v.citizen_type IS DISTINCT FROM 'FTEN' THEN RAISE EXCEPTION 'all2 citizen_type: FTEN 기대, % 나옴', v.citizen_type; END IF;
  IF v.passport_type IS DISTINCT FROM 'FTEC' THEN RAISE EXCEPTION 'all2 passport_type: FTEC 기대, % 나옴', v.passport_type; END IF;

  -- 4. 2단계 33-2 만 빈칸 → 시민권 있음, 여권 null
  SELECT * INTO v FROM efti_record.record_results WHERE nickname = 'miss2' AND class_name = '검증반';
  IF v.citizen_type IS DISTINCT FROM 'PASC' THEN RAISE EXCEPTION 'miss2 citizen_type: PASC 기대, % 나옴', v.citizen_type; END IF;
  IF v.passport_type IS NOT NULL THEN RAISE EXCEPTION 'miss2 passport_type: null 기대, % 나옴', v.passport_type; END IF;
  IF v.missing_codes IS DISTINCT FROM '{33-2}'::text[] THEN RAISE EXCEPTION 'miss2 missing_codes: {33-2} 기대, % 나옴', v.missing_codes; END IF;

  -- 5. 15-1, 46 빈칸 → 둘 다 null, 빈칸 코드는 기록지 순서
  SELECT * INTO v FROM efti_record.record_results WHERE nickname = 'miss12' AND class_name = '검증반';
  IF v.citizen_type IS NOT NULL THEN RAISE EXCEPTION 'miss12 citizen_type: null 기대, % 나옴', v.citizen_type; END IF;
  IF v.passport_type IS NOT NULL THEN RAISE EXCEPTION 'miss12 passport_type: null 기대, % 나옴', v.passport_type; END IF;
  IF v.missing_codes IS DISTINCT FROM '{15-1,46}'::text[] THEN RAISE EXCEPTION 'miss12 missing_codes: {15-1,46} 기대, % 나옴', v.missing_codes; END IF;

  -- 6. 1·2 외의 값은 CHECK 위반
  BEGIN
    INSERT INTO efti_record.records (class_name, class_time, teacher_name, nickname, completed_on, q01)
    VALUES ('검증반', '토 10:00', '검증선생', 'bad', '2026-11-19', 3);
    RAISE EXCEPTION 'q01 = 3 이 들어감 (CHECK 누락)';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 7. 같은 반·학생·날짜 중복은 UNIQUE 위반
  BEGIN
    INSERT INTO efti_record.records (class_name, class_time, teacher_name, nickname, completed_on)
    VALUES ('검증반', '토 10:00', '검증선생', 'all1', '2026-11-19');
    RAISE EXCEPTION '중복 행이 들어감 (UNIQUE 누락)';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  RAISE NOTICE 'EFTI record verify: ALL PASSED';
END $$;

ROLLBACK;
```

- [ ] **Step 2: 로컬 Postgres를 띄우고 실패 확인**

위 "로컬 검증 공통 명령"으로 컨테이너를 띄운 뒤:

```bash
docker exec -i efti-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/efti_record_verify.sql
```

Expected: FAIL — `ERROR:  relation "efti_record.questions" does not exist`

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/efti_record_verify.sql
git commit -m "test: add EFTI record DB verification script"
```

---

### Task 2: 마이그레이션 작성 (스키마·시드·뷰·권한)

**Files:**
- Create: `supabase/migrations/2026-11-19-add-efti-record-schema.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- EFTI 반별 성향기록지 저장소 (2026.11 개정 48회차 기록지 기준)
-- 선생님이 기록지를 CSV로 만들어 records 에 올리면 record_results 뷰가
-- 시민권 유형(1단계 28문항)과 여권 유형(1·2단계 52문항)을 계산한다.
-- 웹앱과 아직 연결하지 않으므로 다른 스키마와 독립이다.
--
-- ** 적용 **
-- Supabase 대시보드 SQL Editor에서 실행한다 (이 저장소는 Supabase CLI에 링크되어 있지 않음).
-- 적용 후 supabase/tests/efti_record_verify.sql 을 실행해 'ALL PASSED' 를 확인한다.
-- 웹앱에서 API로 읽게 될 때 Settings > API > Exposed schemas 에 efti_record 를 추가한다.

CREATE SCHEMA IF NOT EXISTS efti_record;

-- 문항 마스터 (기록지 7쪽 정답표). 선생님이 입력한 1·2를 성향 문자로 바꿀 때 쓴다.
CREATE TABLE efti_record.questions (
  code        text PRIMARY KEY,                 -- 기록지 표기 ('01', '15-1')
  column_name text NOT NULL UNIQUE,             -- records 컬럼명 ('q01', 'q15_1')
  stage       smallint NOT NULL CHECK (stage IN (1, 2)),
  axis        char(1) NOT NULL CHECK (axis IN ('T', 'R', 'O', 'D')),
  question    text NOT NULL,
  option1     text NOT NULL,
  option2     text NOT NULL,
  letter1     char(1) NOT NULL,                 -- 1을 골랐을 때의 문자
  letter2     char(1) NOT NULL,                 -- 2를 골랐을 때의 문자
  sort_order  smallint NOT NULL UNIQUE,         -- 기록지 순서 1~52
  CHECK (letter1 <> letter2),
  CHECK (
       (axis = 'T' AND letter1 IN ('F', 'P') AND letter2 IN ('F', 'P'))
    OR (axis = 'R' AND letter1 IN ('A', 'T') AND letter2 IN ('A', 'T'))
    OR (axis = 'O' AND letter1 IN ('S', 'E') AND letter2 IN ('S', 'E'))
    OR (axis = 'D' AND letter1 IN ('C', 'N') AND letter2 IN ('C', 'N'))
  )
);

INSERT INTO efti_record.questions
  (sort_order, code, column_name, stage, axis, question, option1, option2, letter1, letter2)
VALUES
  ( 1, '01',   'q01',   1, 'T', '더 멋진 사람은?',              '내일을 위해 차근차근 준비',   '오늘 주어진 시간을 소중히',       'F', 'P'),
  ( 2, '02',   'q02',   1, 'O', '물건을 받으면?',               '내가 필요한 걸 먼저 챙겨요',   '친구에게 나눠줘요',               'S', 'E'),
  ( 3, '03',   'q03',   1, 'D', '용돈을 받으면?',               '3번 생각하고 사요',           '먼저 바로 사요',                  'C', 'N'),
  ( 4, '04',   'q04',   1, 'R', '일을 할 때?',                  '안전하고 확실한 게 좋아요',   '새로운 일에 도전해요',            'A', 'T'),
  ( 5, '05',   'q05',   1, 'T', '보상을 받으면?',               '현재를 즐겁게 가꾸기',        '미래를 꿈꾸며 준비',              'P', 'F'),
  ( 6, '06',   'q06',   1, 'R', '일을 고를 때?',                '오래 할 수 있는 안전한 직업', '좋아하는 새로운 직업',            'A', 'T'),
  ( 7, '07',   'q07',   1, 'O', '은행에 모은 돈을 쓴다면?',     '내 물건·꿈과 목표에',         '좋아하는 사람과 추억에',          'S', 'E'),
  ( 8, '08',   'q08',   1, 'D', '새 제품을 결정할 때?',         '꼼꼼히 조사하고 결정',        '누구보다 빠르게 결정',            'C', 'N'),
  ( 9, '09',   'q09',   1, 'D', '가게를 운영한다면?',           '직접 나가 홍보',              '계획을 세우고 준비',              'N', 'C'),
  (10, '10',   'q10',   1, 'R', '회사의 조각을 가진다면?',      '크고 튼튼한 회사',            '작지만 커질 회사',                'A', 'T'),
  (11, '11-1', 'q11_1', 1, 'T', '돈을 사용할 때?',              '지금 나를 위해 써요',         '미래를 준비하며 모아요',          'P', 'F'),
  (12, '11-2', 'q11_2', 1, 'O', '큰돈이 생기면?',               '내가 배우고 성장하는 데',     '주변 사람에게 힘이 되는 데',      'S', 'E'),
  (13, '13',   'q13',   1, 'O', '빵집을 연다면?',               '기준과 운영을 먼저',          '약속과 관계를 먼저',              'S', 'E'),
  (14, '14',   'q14',   1, 'T', '용돈이 생기면?',               '지금 필요한 것을 사요',       '기다리며 조금씩 모아요',          'P', 'F'),
  (15, '15-1', 'q15_1', 1, 'O', '집에서 먼저 챙길 것?',         '내 공간',                     '함께 쓰는 공간',                  'S', 'E'),
  (16, '15-2', 'q15_2', 1, 'D', '우리 집 돈을 쓸 때?',          '꼭 필요한지 따져 보고',       '필요한 곳부터 빠르게',            'C', 'N'),
  (17, '16',   'q16',   1, 'D', '새 공간 활동을 시작할 때?',    '먼저 묻고 정리한 뒤',         '작은 활동부터 해 보며',           'C', 'N'),
  (18, '17',   'q17',   1, 'D', '인기 있는 집을 고를 때?',      '꼼꼼히 비교한 뒤',            '기회를 놓치기 전에',              'C', 'N'),
  (19, '18-1', 'q18_1', 1, 'R', '새로운 정보를 찾을 때?',       '익숙한 방법으로 차근차근',    '새로운 방법도 써 보며',           'A', 'T'),
  (20, '18-2', 'q18_2', 1, 'O', '좋은 정보를 먼저 알게 되면?',  '나만의 계획에 먼저 써요',     '친구·가족에게 먼저 알려 줘요',    'S', 'E'),
  (21, '19-1', 'q19_1', 1, 'R', '기회가 보이면?',               '확인하고 안전하게 준비',      '일단 도전하며 배워요',            'A', 'T'),
  (22, '19-2', 'q19_2', 1, 'O', '지진 뒤 돈을 쓴다면?',         '내 계획을 지키는 데',         '다시 시작하는 사람을 돕는 데',    'S', 'E'),
  (23, '20-1', 'q20_1', 1, 'T', '준비할 때?',                   '지금 필요한 준비부터',        '시간이 걸려도 미리 준비',         'P', 'F'),
  (24, '20-2', 'q20_2', 1, 'R', '용돈을 불릴 방법은?',          '확실하게 늘어나는 저금',      '늘 수도 줄 수도 있는 투자',       'A', 'T'),
  (25, '21-1', 'q21_1', 1, 'T', '여유 시간이 생기면?',          '지금 즐겁게 써요',            '미래를 위해 배워요',              'P', 'F'),
  (26, '21-2', 'q21_2', 1, 'R', '나를 키우는 데 돈을 쓴다면?',  '익숙하고 확실한 배움',        '새롭고 어려운 배움',              'A', 'T'),
  (27, '22-1', 'q22_1', 1, 'D', '팀 활동을 할 때?',             '기준과 약속을 정하고 점검',   '상황을 보며 빠르게 바꿔요',       'C', 'N'),
  (28, '22-2', 'q22_2', 1, 'T', '회사 돈을 쓴다면?',            '지금 바로 도움되는 곳에',     '오래 성장할 곳에',                'P', 'F'),
  (29, '25',   'q25',   2, 'R', '바자회에서 팔 물건은?',        '꾸준히 잘 팔린 물건',         '처음 파는 물건',                  'A', 'T'),
  (30, '26',   'q26',   2, 'D', '주말 할 일을 고를 때?',        '더 끌리는 쪽을 바로',         '좋은 점·아쉬운 점을 적어 보고',   'N', 'C'),
  (31, '27',   'q27',   2, 'T', '주말에 무엇을 할까?',          '다음 달 대회를 위해 연습',    '지금 하고 싶은 놀이',             'F', 'P'),
  (32, '28',   'q28',   2, 'O', '새 도구를 만들었다면?',        '마을 사람들에게 빌려줘요',    '내 일을 먼저 끝내요',             'E', 'S'),
  (33, '29',   'q29',   2, 'O', '내 물건이 인기가 많아지면?',   '친구들과 함께 팔아요',        '내 가게를 먼저 키워요',           'E', 'S'),
  (34, '30',   'q30',   2, 'R', '만들기 대회에 나간다면?',      '자신 있는 크기로 튼튼하게',   '아무도 안 해 본 큰 작품',         'A', 'T'),
  (35, '31',   'q31',   2, 'D', '새 아이스크림 맛을 정한다면?', '떠오른 아이디어로 바로',      '친구들에게 먼저 물어봐요',        'N', 'C'),
  (36, '32',   'q32',   2, 'T', '잘하는 일 하나를 키운다면?',   '몇 년 걸려도 꾸준히 연습',    '지금 바로 친구들을 도와요',       'F', 'P'),
  (37, '33-1', 'q33_1', 2, 'R', '게임 보상을 고른다면?',        '스티커 2개를 확실히',         '주사위로 0개 또는 5개',           'A', 'T'),
  (38, '33-2', 'q33_2', 2, 'T', '물건값이 계속 오른다면 내 용돈은?', '오르기 전에 지금 사요',  '이자를 받을 수 있게 모아요',      'P', 'F'),
  (39, '34',   'q34',   2, 'T', '놀이공원에서 1시간이 남으면?', '내일을 위해 일찍 쉬어요',     '놀이기구를 한 번 더',             'F', 'P'),
  (40, '35',   'q35',   2, 'D', '“그 가게 문 닫는대”라고 하면?', '바로 가서 확인해요',         '다른 친구들 말도 더 들어요',      'N', 'C'),
  (41, '37',   'q37',   2, 'T', '방학 계획을 세울 때?',         '다음 학기 준비도 넣어요',     '하고 싶은 활동 위주로',           'F', 'P'),
  (42, '38',   'q38',   2, 'D', '투자를 처음 시작한다면?',      '작은 돈으로 먼저 시작',       '충분히 알아본 뒤에',              'N', 'C'),
  (43, '39-1', 'q39_1', 2, 'R', '큰 기회가 아직 확실하지 않다면?', '자료를 더 찾고 준비되면',  '해 보면서 배우며',                'A', 'T'),
  (44, '39-2', 'q39_2', 2, 'O', '내가 가진 힘을 먼저 어디에?',  '내 꿈과 목표에',              '가족·친구가 함께 좋아지는 데',    'S', 'E'),
  (45, '40',   'q40',   2, 'D', '갖고 싶던 물건이 갑자기 인기가 많아지면?', '다 팔리기 전에 바로 사요', '하루 생각해 봐요',      'N', 'C'),
  (46, '41',   'q41',   2, 'O', '칭찬 쿠폰 1장을 받으면?',      '모둠이 함께 쓰는 물건에',     '내게 필요한 학용품에',            'E', 'S'),
  (47, '42',   'q42',   2, 'D', '마감 3일 전인 과제가 있으면?', '할 수 있는 부분부터 바로',    '계획표를 먼저 만들어요',          'N', 'C'),
  (48, '43',   'q43',   2, 'O', '모둠 간식을 고를 때?',         '모두가 먹을 수 있는 걸',      '내가 정말 먹고 싶은 걸',          'E', 'S'),
  (49, '44',   'q44',   2, 'R', '마을에 새 다리를 놓는다면?',   '검증된 튼튼한 설계',          '아무도 안 해 본 새 설계',         'A', 'T'),
  (50, '45-1', 'q45_1', 2, 'R', '흉년이 올지도 모른다면?',      '곡식을 넉넉히 모아 둬요',     '새 장사를 해 봐요',               'A', 'T'),
  (51, '45-2', 'q45_2', 2, 'O', '흉년에 내 곳간에 곡식이 있다면?', '우리 가족 몫을 먼저',      '굶는 이웃과 먼저 나눠요',         'S', 'E'),
  (52, '46',   'q46',   2, 'T', '어른이 되면 어떤 계획을?',     '먼 훗날의 꿈을 미리 준비',    '지금의 생활을 즐겁게',            'F', 'P');

-- 기록지 응답. CSV 업로드 단위 = 학생 1명 1행. 문항 컬럼은 1·2, 결석 빈칸은 null.
-- 문항 컬럼 이름은 questions.column_name 과 정확히 같아야 한다 (검증 스크립트가 확인).
CREATE TABLE efti_record.records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name   text NOT NULL,   -- 반 이름
  class_time   text NOT NULL,   -- 수업시간
  teacher_name text NOT NULL,   -- 담당 선생님
  nickname     text NOT NULL,   -- 시스템 등록 닉네임 (실명 아님)
  completed_on date NOT NULL,   -- 48회차 수업 날짜 (같은 반의 기수 구분)
  -- 1단계 (28문항)
  q01   smallint CHECK (q01   IN (1, 2)),
  q02   smallint CHECK (q02   IN (1, 2)),
  q03   smallint CHECK (q03   IN (1, 2)),
  q04   smallint CHECK (q04   IN (1, 2)),
  q05   smallint CHECK (q05   IN (1, 2)),
  q06   smallint CHECK (q06   IN (1, 2)),
  q07   smallint CHECK (q07   IN (1, 2)),
  q08   smallint CHECK (q08   IN (1, 2)),
  q09   smallint CHECK (q09   IN (1, 2)),
  q10   smallint CHECK (q10   IN (1, 2)),
  q11_1 smallint CHECK (q11_1 IN (1, 2)),
  q11_2 smallint CHECK (q11_2 IN (1, 2)),
  q13   smallint CHECK (q13   IN (1, 2)),
  q14   smallint CHECK (q14   IN (1, 2)),
  q15_1 smallint CHECK (q15_1 IN (1, 2)),
  q15_2 smallint CHECK (q15_2 IN (1, 2)),
  q16   smallint CHECK (q16   IN (1, 2)),
  q17   smallint CHECK (q17   IN (1, 2)),
  q18_1 smallint CHECK (q18_1 IN (1, 2)),
  q18_2 smallint CHECK (q18_2 IN (1, 2)),
  q19_1 smallint CHECK (q19_1 IN (1, 2)),
  q19_2 smallint CHECK (q19_2 IN (1, 2)),
  q20_1 smallint CHECK (q20_1 IN (1, 2)),
  q20_2 smallint CHECK (q20_2 IN (1, 2)),
  q21_1 smallint CHECK (q21_1 IN (1, 2)),
  q21_2 smallint CHECK (q21_2 IN (1, 2)),
  q22_1 smallint CHECK (q22_1 IN (1, 2)),
  q22_2 smallint CHECK (q22_2 IN (1, 2)),
  -- 2단계 (24문항)
  q25   smallint CHECK (q25   IN (1, 2)),
  q26   smallint CHECK (q26   IN (1, 2)),
  q27   smallint CHECK (q27   IN (1, 2)),
  q28   smallint CHECK (q28   IN (1, 2)),
  q29   smallint CHECK (q29   IN (1, 2)),
  q30   smallint CHECK (q30   IN (1, 2)),
  q31   smallint CHECK (q31   IN (1, 2)),
  q32   smallint CHECK (q32   IN (1, 2)),
  q33_1 smallint CHECK (q33_1 IN (1, 2)),
  q33_2 smallint CHECK (q33_2 IN (1, 2)),
  q34   smallint CHECK (q34   IN (1, 2)),
  q35   smallint CHECK (q35   IN (1, 2)),
  q37   smallint CHECK (q37   IN (1, 2)),
  q38   smallint CHECK (q38   IN (1, 2)),
  q39_1 smallint CHECK (q39_1 IN (1, 2)),
  q39_2 smallint CHECK (q39_2 IN (1, 2)),
  q40   smallint CHECK (q40   IN (1, 2)),
  q41   smallint CHECK (q41   IN (1, 2)),
  q42   smallint CHECK (q42   IN (1, 2)),
  q43   smallint CHECK (q43   IN (1, 2)),
  q44   smallint CHECK (q44   IN (1, 2)),
  q45_1 smallint CHECK (q45_1 IN (1, 2)),
  q45_2 smallint CHECK (q45_2 IN (1, 2)),
  q46   smallint CHECK (q46   IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_name, class_time, teacher_name, nickname, completed_on)
);

-- 성향 결과. 응답을 문항 단위로 펼쳐(to_jsonb ->> column_name) questions 와 조인해 센다.
-- 해당 범위에 빈칸이 하나라도 있으면 유형은 null (빈칸이 있으면 동점이 생길 수 있음).
CREATE VIEW efti_record.record_results WITH (security_invoker = true) AS
WITH answers AS (
  SELECT
    r.id AS record_id,
    q.code,
    q.stage,
    q.sort_order,
    CASE (to_jsonb(r) ->> q.column_name)::smallint
      WHEN 1 THEN q.letter1::text
      WHEN 2 THEN q.letter2::text
    END AS letter
  FROM efti_record.records r
  CROSS JOIN efti_record.questions q
),
counts AS (
  SELECT
    record_id,
    count(*) FILTER (WHERE stage = 1 AND letter = 'F') AS citizen_f,
    count(*) FILTER (WHERE stage = 1 AND letter = 'P') AS citizen_p,
    count(*) FILTER (WHERE stage = 1 AND letter = 'A') AS citizen_a,
    count(*) FILTER (WHERE stage = 1 AND letter = 'T') AS citizen_t,
    count(*) FILTER (WHERE stage = 1 AND letter = 'S') AS citizen_s,
    count(*) FILTER (WHERE stage = 1 AND letter = 'E') AS citizen_e,
    count(*) FILTER (WHERE stage = 1 AND letter = 'C') AS citizen_c,
    count(*) FILTER (WHERE stage = 1 AND letter = 'N') AS citizen_n,
    count(*) FILTER (WHERE stage = 1 AND letter IS NULL) AS citizen_missing,
    count(*) FILTER (WHERE letter = 'F') AS passport_f,
    count(*) FILTER (WHERE letter = 'P') AS passport_p,
    count(*) FILTER (WHERE letter = 'A') AS passport_a,
    count(*) FILTER (WHERE letter = 'T') AS passport_t,
    count(*) FILTER (WHERE letter = 'S') AS passport_s,
    count(*) FILTER (WHERE letter = 'E') AS passport_e,
    count(*) FILTER (WHERE letter = 'C') AS passport_c,
    count(*) FILTER (WHERE letter = 'N') AS passport_n,
    count(*) FILTER (WHERE letter IS NULL) AS passport_missing,
    COALESCE(
      array_agg(code ORDER BY sort_order) FILTER (WHERE letter IS NULL),
      '{}'::text[]
    ) AS missing_codes
  FROM answers
  GROUP BY record_id
)
SELECT
  r.id AS record_id,
  r.class_name,
  r.class_time,
  r.teacher_name,
  r.nickname,
  r.completed_on,
  c.citizen_f, c.citizen_p, c.citizen_a, c.citizen_t,
  c.citizen_s, c.citizen_e, c.citizen_c, c.citizen_n,
  CASE WHEN c.citizen_missing = 0 THEN
       CASE WHEN c.citizen_f > c.citizen_p THEN 'F' ELSE 'P' END
    || CASE WHEN c.citizen_a > c.citizen_t THEN 'A' ELSE 'T' END
    || CASE WHEN c.citizen_s > c.citizen_e THEN 'S' ELSE 'E' END
    || CASE WHEN c.citizen_c > c.citizen_n THEN 'C' ELSE 'N' END
  END AS citizen_type,
  c.passport_f, c.passport_p, c.passport_a, c.passport_t,
  c.passport_s, c.passport_e, c.passport_c, c.passport_n,
  CASE WHEN c.passport_missing = 0 THEN
       CASE WHEN c.passport_f > c.passport_p THEN 'F' ELSE 'P' END
    || CASE WHEN c.passport_a > c.passport_t THEN 'A' ELSE 'T' END
    || CASE WHEN c.passport_s > c.passport_e THEN 'S' ELSE 'E' END
    || CASE WHEN c.passport_c > c.passport_n THEN 'C' ELSE 'N' END
  END AS passport_type,
  c.missing_codes
FROM efti_record.records r
JOIN counts c ON c.record_id = r.id;

-- 권한: 서버(service_role)만 접근. 학생 데이터이므로 공개(anon) 정책은 두지 않는다.
GRANT USAGE ON SCHEMA efti_record TO service_role;
GRANT SELECT ON efti_record.questions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON efti_record.records TO service_role;
GRANT SELECT ON efti_record.record_results TO service_role;

ALTER TABLE efti_record.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE efti_record.records ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: 로컬에 적용**

```bash
docker exec -i efti-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/2026-11-19-add-efti-record-schema.sql
```

Expected: `CREATE SCHEMA`, `CREATE TABLE`, `INSERT 0 52`, `CREATE TABLE`, `CREATE VIEW`, `GRANT` ×4, `ALTER TABLE` ×2 — ERROR 없음.

- [ ] **Step 3: 검증 스크립트 실행 (통과 확인)**

```bash
docker exec -i efti-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/efti_record_verify.sql
```

Expected: `NOTICE:  EFTI record verify: ALL PASSED` 후 `ROLLBACK`.

실패하면 메시지가 가리키는 문항(시드 오타, 컬럼 누락 등)을 고친 뒤 `docker rm -f efti-pg` → 컨테이너 재생성 → Step 2부터 다시.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-11-19-add-efti-record-schema.sql
git commit -m "feat: add efti_record schema for EFTI record sheets"
```

---

### Task 3: CSV 템플릿 작성 + 로컬 Import 확인

**Files:**
- Create: `supabase/templates/efti_record_import_template.csv`

- [ ] **Step 1: 템플릿 작성 (헤더 1줄, 끝에 줄바꿈)**

```csv
class_name,class_time,teacher_name,nickname,completed_on,q01,q02,q03,q04,q05,q06,q07,q08,q09,q10,q11_1,q11_2,q13,q14,q15_1,q15_2,q16,q17,q18_1,q18_2,q19_1,q19_2,q20_1,q20_2,q21_1,q21_2,q22_1,q22_2,q25,q26,q27,q28,q29,q30,q31,q32,q33_1,q33_2,q34,q35,q37,q38,q39_1,q39_2,q40,q41,q42,q43,q44,q45_1,q45_2,q46
```

- [ ] **Step 2: 템플릿 헤더가 questions 순서와 같은지 확인**

```bash
docker exec -i efti-pg psql -U postgres -At -c "SELECT 'class_name,class_time,teacher_name,nickname,completed_on,' || string_agg(column_name, ',' ORDER BY sort_order) FROM efti_record.questions" > /tmp/expected_header.txt
diff <(head -1 supabase/templates/efti_record_import_template.csv | tr -d '\r') /tmp/expected_header.txt && echo HEADER_OK
```

Expected: `HEADER_OK`

- [ ] **Step 3: 샘플 CSV(빈칸 포함)로 Import 동작 확인**

템플릿 헤더 + 샘플 2행(학생 A는 전부 1, 학생 B는 15-1 빈칸)을 만들어 `\copy` 로 넣고 뷰를 본다. 끝나면 지운다.

```bash
{ head -1 supabase/templates/efti_record_import_template.csv | tr -d '\r'
  echo "샘플반,토 10:00,샘플선생,학생A,2026-11-19,$(printf '1,%.0s' {1..51})1"
  echo "샘플반,토 10:00,샘플선생,학생B,2026-11-19,$(printf '1,%.0s' {1..14}),$(printf '1,%.0s' {1..36})1"
} > /tmp/efti_sample.csv
# Git Bash 경로 변환을 피하려고 docker cp 대신 stdin으로 넘긴다
docker exec -i efti-pg psql -U postgres -v ON_ERROR_STOP=1 -c "\copy efti_record.records (class_name,class_time,teacher_name,nickname,completed_on,q01,q02,q03,q04,q05,q06,q07,q08,q09,q10,q11_1,q11_2,q13,q14,q15_1,q15_2,q16,q17,q18_1,q18_2,q19_1,q19_2,q20_1,q20_2,q21_1,q21_2,q22_1,q22_2,q25,q26,q27,q28,q29,q30,q31,q32,q33_1,q33_2,q34,q35,q37,q38,q39_1,q39_2,q40,q41,q42,q43,q44,q45_1,q45_2,q46) FROM STDIN WITH (FORMAT csv, HEADER true)" < /tmp/efti_sample.csv
docker exec -i efti-pg psql -U postgres -c "SELECT nickname, citizen_type, passport_type, missing_codes FROM efti_record.record_results WHERE class_name = '샘플반' ORDER BY nickname"
docker exec -i efti-pg psql -U postgres -c "DELETE FROM efti_record.records WHERE class_name = '샘플반'"
```

학생B 행: 처음 14개 `1,` 는 q01~q14, 이어지는 빈 필드가 15번째 컬럼 q15_1, 그 뒤 37개가 q15_2~q46.

Expected:
```
 nickname | citizen_type | passport_type | missing_codes
----------+--------------+---------------+---------------
 학생A    | PASC         | PASN          | {}
 학생B    |              |               | {15-1}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/templates/efti_record_import_template.csv
git commit -m "feat: add CSV import template for EFTI record sheets"
```

- [ ] **Step 5: 로컬 컨테이너 정리**

```bash
docker rm -f efti-pg
```

---

### Task 4: Supabase에 적용 (사용자 수행)

이 저장소는 Supabase CLI에 링크되어 있지 않고 DDL을 실행할 자격 증명도 없으므로 사용자가 대시보드에서 실행한다.

- [ ] **Step 1: 마이그레이션 실행**

Supabase 대시보드 → SQL Editor → `supabase/migrations/2026-11-19-add-efti-record-schema.sql` 전체 붙여넣기 → Run.
Expected: "Success. No rows returned".

- [ ] **Step 2: 검증 스크립트 실행**

SQL Editor 새 쿼리 → `supabase/tests/efti_record_verify.sql` 전체 붙여넣기 → Run.
Expected: 오류 없이 끝남 (NOTICE `EFTI record verify: ALL PASSED` 는 결과 패널의 메시지에 표시될 수 있음). 오류가 나면 메시지를 그대로 알려 준다.

- [ ] **Step 3: 테이블 확인**

Table Editor에서 스키마 선택 드롭다운 → `efti_record` → `questions` 52행, `records` 0행 확인.
