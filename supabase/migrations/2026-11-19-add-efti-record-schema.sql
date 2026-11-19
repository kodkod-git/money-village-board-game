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
