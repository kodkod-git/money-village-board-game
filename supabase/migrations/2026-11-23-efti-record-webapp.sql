-- EFTI 성향기록 웹앱 연동 (docs/superpowers/specs/2026-11-23-efti-record-page-design.md)
-- 1) 학생별 메모 컬럼  2) record_results 뷰에 memo 추가  3) 기록지 한 장을 원자적으로 저장하는 save_sheet 함수
--
-- ** 적용 **
-- 1. Supabase 대시보드 SQL Editor에서 이 파일을 실행한다.
-- 2. Settings > API > Exposed schemas 에 efti_record 를 추가하고 저장한다 (웹앱 서버가 PostgREST로 읽고 RPC를 호출한다).
-- 3. supabase/tests/efti_record_verify.sql 을 실행해 'ALL PASSED' 를 확인한다.

ALTER TABLE efti_record.records ADD COLUMN IF NOT EXISTS memo text;

-- 기존 컬럼 순서를 그대로 두고 memo 를 맨 끝에 붙인다 (CREATE OR REPLACE VIEW 규칙).
CREATE OR REPLACE VIEW efti_record.record_results WITH (security_invoker = true) AS
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
  c.missing_codes,
  r.memo
FROM efti_record.records r
JOIN counts c ON c.record_id = r.id;

-- 기록지 한 장 저장. 한 트랜잭션: 헤더 변경 → 삭제 → 학생 수정(id 있는 것) → 학생 추가(id 없는 것).
--   p_original : 원래 헤더 {class_name, class_time, teacher_name, completed_on}. NULL 이면 새 기록지(또는 업로드 병합)
--   p_header   : 저장할 헤더
--   p_students : [{id?, nickname, memo?, answers: {q01: 1|2|null, ...}}]  (answers 키는 questions.column_name)
--                answers 는 문항 전체를 담아야 한다. 빠진 키는 NULL 로 저장된다.
--   p_delete_ids: 지울 학생 id (저장할 헤더의 기록지에 속한 행만 지운다)
-- 오류:
--   EF409 (기록지 헤더 충돌)       : 헤더를 바꿨는데 새 헤더에 이미 행이 있음
--   23505 unique_violation         : 같은 기록지 안 학생 이름 중복
--   P0002 no_data_found            : 원래 기록지가 없거나, id 가 있는데 그 기록지에 없는 학생
CREATE OR REPLACE FUNCTION efti_record.save_sheet(
  p_original   jsonb,
  p_header     jsonb,
  p_students   jsonb,
  p_delete_ids uuid[]
) RETURNS SETOF uuid
LANGUAGE plpgsql
SET search_path = efti_record, pg_temp
AS $$
DECLARE
  h_class   text := btrim(p_header ->> 'class_name');
  h_time    text := btrim(p_header ->> 'class_time');
  h_teacher text := btrim(p_header ->> 'teacher_name');
  h_date    date := (p_header ->> 'completed_on')::date;
  o_class   text := p_original ->> 'class_name';
  o_time    text := p_original ->> 'class_time';
  o_teacher text := p_original ->> 'teacher_name';
  o_date    date := (p_original ->> 'completed_on')::date;
  cols text;
  vals text;
  sets text;
  s jsonb;
  saved uuid;
  renamed int;
  pass int;
BEGIN
  IF p_original IS NOT NULL
     AND (o_class, o_time, o_teacher, o_date) IS DISTINCT FROM (h_class, h_time, h_teacher, h_date) THEN
    IF EXISTS (
      SELECT 1 FROM records
       WHERE class_name = h_class AND class_time = h_time AND teacher_name = h_teacher AND completed_on = h_date
    ) THEN
      RAISE EXCEPTION '이미 같은 반·수업시간·날짜 기록지가 있습니다' USING ERRCODE = 'EF409';
    END IF;
    UPDATE records
       SET class_name = h_class, class_time = h_time, teacher_name = h_teacher, completed_on = h_date
     WHERE class_name = o_class AND class_time = o_time AND teacher_name = o_teacher AND completed_on = o_date;
    GET DIAGNOSTICS renamed = ROW_COUNT;
    IF renamed = 0 THEN
      RAISE EXCEPTION '원래 기록지가 더 이상 없습니다' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  IF p_delete_ids IS NOT NULL THEN
    DELETE FROM records
     WHERE id = ANY (p_delete_ids)
       AND class_name = h_class AND class_time = h_time AND teacher_name = h_teacher AND completed_on = h_date;
  END IF;

  -- 문항 컬럼은 questions 에서 만든다 (문항 목록의 단일 출처).
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY sort_order),
         string_agg(format('($1 -> ''answers'' ->> %L)::smallint', column_name), ', ' ORDER BY sort_order),
         string_agg(format('%I = ($1 -> ''answers'' ->> %L)::smallint', column_name, column_name), ', ' ORDER BY sort_order)
    INTO cols, vals, sets
    FROM questions;

  -- 1차: id 있는 학생(수정), 2차: id 없는 학생(추가). 이름을 맞바꾸거나 옮기고 새로 추가해도 UNIQUE 에 걸리지 않게 한다.
  FOR pass IN 1..2 LOOP
    FOR s IN SELECT value FROM jsonb_array_elements(COALESCE(p_students, '[]'::jsonb))
              WHERE (value ->> 'id' IS NOT NULL) = (pass = 1) LOOP
      saved := NULL;
      IF pass = 2 THEN
        EXECUTE format(
          'INSERT INTO records (class_name, class_time, teacher_name, completed_on, nickname, memo, %s)
           VALUES ($2, $3, $4, $5, NULLIF(btrim($1 ->> ''nickname''), ''''), NULLIF(btrim($1 ->> ''memo''), ''''), %s)
           RETURNING id', cols, vals)
          INTO saved USING s, h_class, h_time, h_teacher, h_date;
      ELSE
        EXECUTE format(
          'UPDATE records
              SET nickname = NULLIF(btrim($1 ->> ''nickname''), ''''), memo = NULLIF(btrim($1 ->> ''memo''), ''''), %s
            WHERE id = ($1 ->> ''id'')::uuid
              AND class_name = $2 AND class_time = $3 AND teacher_name = $4 AND completed_on = $5
           RETURNING id', sets)
          INTO saved USING s, h_class, h_time, h_teacher, h_date;
        IF saved IS NULL THEN
          RAISE EXCEPTION '기록지에 없는 학생입니다: %', s ->> 'id' USING ERRCODE = 'no_data_found';
        END IF;
      END IF;
      RETURN NEXT saved;
    END LOOP;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION efti_record.save_sheet(jsonb, jsonb, jsonb, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION efti_record.save_sheet(jsonb, jsonb, jsonb, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION efti_record.save_sheet(jsonb, jsonb, jsonb, uuid[]) TO service_role;
