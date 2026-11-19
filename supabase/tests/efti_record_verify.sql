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
