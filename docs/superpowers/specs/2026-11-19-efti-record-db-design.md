# EFTI 반별 성향기록지 DB 설계

- 작성일: 2026-11-19
- 근거 자료: `[48회차]머니빌리지 EFTI 반별 성향기록지.pdf` (2026.11 개정), `proposal/20261119_report.md`

## 목표

선생님이 기록한 EFTI 성향기록지(학생별 문항 답 1/2)를 Supabase에 저장하고, DB만으로 시민권 유형(24회차, 1단계 28문항)과 여권 유형(48회차, 1·2단계 52문항)을 조회할 수 있게 한다. 웹앱 연동 여부는 아직 정하지 않았으므로 이번 범위는 **DB 저장 + 결과 계산 뷰**까지다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 기존 데이터와의 관계 | 완전 독립. 새 스키마 `efti_record`. 학생은 닉네임 텍스트로만 식별 (나중에 필요하면 FK 컬럼 추가) |
| 입력 방식 | 스프레드시트 → CSV → Supabase 대시보드 Table Editor Import |
| 업로드 시점 | 48회차 종료 후 학생당 1행, 52문항 한 번에 |
| 결과 계산 | DB 뷰가 자동 계산. 원본 응답만 저장 |
| 테이블 구조 | 넓은 응답 테이블(`records`) + 문항 마스터(`questions`) + 계산 뷰(`record_results`) |
| 중복 방지 키 | `(class_name, class_time, teacher_name, nickname, completed_on)` |

## 스키마 `efti_record`

### `efti_record.questions` — 문항 마스터 (시드 52행)

| 컬럼 | 타입 | 제약 / 설명 |
|---|---|---|
| `code` | text | PK. 기록지 표기 그대로 (`'01'`, `'15-1'`) |
| `column_name` | text | NOT NULL UNIQUE. `records` 컬럼명 (`'q01'`, `'q15_1'`) |
| `stage` | smallint | NOT NULL, CHECK IN (1, 2) |
| `axis` | char(1) | NOT NULL, CHECK IN ('T','R','O','D') |
| `question` | text | NOT NULL |
| `option1` | text | NOT NULL. ① 선택지 문구 |
| `option2` | text | NOT NULL. ② 선택지 문구 |
| `letter1` | char(1) | NOT NULL. 1을 골랐을 때의 문자 |
| `letter2` | char(1) | NOT NULL. 2를 골랐을 때의 문자 |
| `sort_order` | smallint | NOT NULL UNIQUE. 기록지 순서 (1~52) |

축-문자 정합성 CHECK: `letter1 <> letter2` 이고
`(axis='T' AND letter1 IN ('F','P') AND letter2 IN ('F','P')) OR (axis='R' AND ... ('A','T')) OR (axis='O' AND ... ('S','E')) OR (axis='D' AND ... ('C','N'))`.

### `efti_record.records` — CSV 업로드 대상 (학생 1명 = 1행)

| 컬럼 | 타입 | 제약 / 설명 |
|---|---|---|
| `id` | uuid | PK, DEFAULT gen_random_uuid() |
| `class_name` | text | NOT NULL. 반 이름 |
| `class_time` | text | NOT NULL. 수업시간 (예: "토 10:00") |
| `teacher_name` | text | NOT NULL. 담당 선생님 |
| `nickname` | text | NOT NULL. 시스템 등록 닉네임 (실명 아님) |
| `completed_on` | date | NOT NULL. 48회차 수업 날짜 (기수 구분용) |
| `q01` … `q46` (52개) | smallint | NULL 허용(결석 빈칸), CHECK (값 IN (1, 2)) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

- UNIQUE `(class_name, class_time, teacher_name, nickname, completed_on)`
- 문항 컬럼 순서 (sort_order 순):
  - 1단계 28개: `q01 q02 q03 q04 q05 q06 q07 q08 q09 q10 q11_1 q11_2 q13 q14 q15_1 q15_2 q16 q17 q18_1 q18_2 q19_1 q19_2 q20_1 q20_2 q21_1 q21_2 q22_1 q22_2`
  - 2단계 24개: `q25 q26 q27 q28 q29 q30 q31 q32 q33_1 q33_2 q34 q35 q37 q38 q39_1 q39_2 q40 q41 q42 q43 q44 q45_1 q45_2 q46`

### `efti_record.record_results` — 결과 계산 뷰

계산 방식:
1. `records r` 를 `to_jsonb(r)` 로 바꾸고 `questions q` 와 CROSS JOIN, `(to_jsonb(r) ->> q.column_name)::smallint` 로 문항별 답을 펼친다.
2. 답 1 → `letter1`, 2 → `letter2`, null → 미응답.
3. 학생별로 `count(*) FILTER (WHERE ...)` 로 문자 개수를 센다. 시민권은 `stage = 1`, 여권은 전체.
4. 축별로 개수가 많은 문자를 골라 T→R→O→D 순서로 이어 붙인다.

문항 코드는 뷰에 하드코딩하지 않는다 (문항 목록의 단일 출처는 `questions`).

| 출력 컬럼 | 설명 |
|---|---|
| `record_id`, `class_name`, `class_time`, `teacher_name`, `nickname`, `completed_on` | 식별 정보 |
| `citizen_f`, `citizen_p`, `citizen_a`, `citizen_t`, `citizen_s`, `citizen_e`, `citizen_c`, `citizen_n` | 1단계 28문항 문자 개수 |
| `citizen_type` | 1단계 28문항이 모두 응답됐을 때만 값 (예: `FASN`), 아니면 null |
| `passport_f` … `passport_n` (8개) | 1·2단계 52문항 문자 개수 |
| `passport_type` | 52문항이 모두 응답됐을 때만 값, 아니면 null |
| `missing_codes` | 미응답 문항 코드 배열 (sort_order 순). 없으면 빈 배열 `{}` |

유형 형식은 `^[FP][AT][SE][CN]$` 로, 기존 `survey.efti_synergy_responses.citizen_type` 과 같은 문자 체계다. 모두 응답했다면 축별 문항 수가 홀수(7 / 13)라 동점이 없다. 빈칸이 있으면 동점이 생길 수 있으므로 null로 둔다 (기록지 규칙: "보충 후 채워요").

### 권한

기존 `boardgame.official_players` 패턴을 따른다.
- `GRANT USAGE ON SCHEMA efti_record TO service_role`, 세 객체에 `GRANT SELECT` (records는 `SELECT, INSERT, UPDATE, DELETE`) `TO service_role`.
- `questions`, `records` 에 RLS ENABLE, 공개 정책 없음 (학생 데이터이므로 anon 접근 차단).
- 뷰는 `WITH (security_invoker = true)` 로 만들어 호출자 권한으로 동작하게 한다.
- 대시보드 Import·SQL Editor는 postgres 역할이라 영향 없음.
- Exposed schemas 추가는 웹앱 연동 시점에 한다 (이번 범위 밖).

## 문항 정답표 (시드 데이터)

| sort | code | stage | axis | 질문 | ① 선택지 | ② 선택지 | 1 | 2 |
|---|---|---|---|---|---|---|---|---|
| 1 | 01 | 1 | T | 더 멋진 사람은? | 내일을 위해 차근차근 준비 | 오늘 주어진 시간을 소중히 | F | P |
| 2 | 02 | 1 | O | 물건을 받으면? | 내가 필요한 걸 먼저 챙겨요 | 친구에게 나눠줘요 | S | E |
| 3 | 03 | 1 | D | 용돈을 받으면? | 3번 생각하고 사요 | 먼저 바로 사요 | C | N |
| 4 | 04 | 1 | R | 일을 할 때? | 안전하고 확실한 게 좋아요 | 새로운 일에 도전해요 | A | T |
| 5 | 05 | 1 | T | 보상을 받으면? | 현재를 즐겁게 가꾸기 | 미래를 꿈꾸며 준비 | P | F |
| 6 | 06 | 1 | R | 일을 고를 때? | 오래 할 수 있는 안전한 직업 | 좋아하는 새로운 직업 | A | T |
| 7 | 07 | 1 | O | 은행에 모은 돈을 쓴다면? | 내 물건·꿈과 목표에 | 좋아하는 사람과 추억에 | S | E |
| 8 | 08 | 1 | D | 새 제품을 결정할 때? | 꼼꼼히 조사하고 결정 | 누구보다 빠르게 결정 | C | N |
| 9 | 09 | 1 | D | 가게를 운영한다면? | 직접 나가 홍보 | 계획을 세우고 준비 | N | C |
| 10 | 10 | 1 | R | 회사의 조각을 가진다면? | 크고 튼튼한 회사 | 작지만 커질 회사 | A | T |
| 11 | 11-1 | 1 | T | 돈을 사용할 때? | 지금 나를 위해 써요 | 미래를 준비하며 모아요 | P | F |
| 12 | 11-2 | 1 | O | 큰돈이 생기면? | 내가 배우고 성장하는 데 | 주변 사람에게 힘이 되는 데 | S | E |
| 13 | 13 | 1 | O | 빵집을 연다면? | 기준과 운영을 먼저 | 약속과 관계를 먼저 | S | E |
| 14 | 14 | 1 | T | 용돈이 생기면? | 지금 필요한 것을 사요 | 기다리며 조금씩 모아요 | P | F |
| 15 | 15-1 | 1 | O | 집에서 먼저 챙길 것? | 내 공간 | 함께 쓰는 공간 | S | E |
| 16 | 15-2 | 1 | D | 우리 집 돈을 쓸 때? | 꼭 필요한지 따져 보고 | 필요한 곳부터 빠르게 | C | N |
| 17 | 16 | 1 | D | 새 공간 활동을 시작할 때? | 먼저 묻고 정리한 뒤 | 작은 활동부터 해 보며 | C | N |
| 18 | 17 | 1 | D | 인기 있는 집을 고를 때? | 꼼꼼히 비교한 뒤 | 기회를 놓치기 전에 | C | N |
| 19 | 18-1 | 1 | R | 새로운 정보를 찾을 때? | 익숙한 방법으로 차근차근 | 새로운 방법도 써 보며 | A | T |
| 20 | 18-2 | 1 | O | 좋은 정보를 먼저 알게 되면? | 나만의 계획에 먼저 써요 | 친구·가족에게 먼저 알려 줘요 | S | E |
| 21 | 19-1 | 1 | R | 기회가 보이면? | 확인하고 안전하게 준비 | 일단 도전하며 배워요 | A | T |
| 22 | 19-2 | 1 | O | 지진 뒤 돈을 쓴다면? | 내 계획을 지키는 데 | 다시 시작하는 사람을 돕는 데 | S | E |
| 23 | 20-1 | 1 | T | 준비할 때? | 지금 필요한 준비부터 | 시간이 걸려도 미리 준비 | P | F |
| 24 | 20-2 | 1 | R | 용돈을 불릴 방법은? | 확실하게 늘어나는 저금 | 늘 수도 줄 수도 있는 투자 | A | T |
| 25 | 21-1 | 1 | T | 여유 시간이 생기면? | 지금 즐겁게 써요 | 미래를 위해 배워요 | P | F |
| 26 | 21-2 | 1 | R | 나를 키우는 데 돈을 쓴다면? | 익숙하고 확실한 배움 | 새롭고 어려운 배움 | A | T |
| 27 | 22-1 | 1 | D | 팀 활동을 할 때? | 기준과 약속을 정하고 점검 | 상황을 보며 빠르게 바꿔요 | C | N |
| 28 | 22-2 | 1 | T | 회사 돈을 쓴다면? | 지금 바로 도움되는 곳에 | 오래 성장할 곳에 | P | F |
| 29 | 25 | 2 | R | 바자회에서 팔 물건은? | 꾸준히 잘 팔린 물건 | 처음 파는 물건 | A | T |
| 30 | 26 | 2 | D | 주말 할 일을 고를 때? | 더 끌리는 쪽을 바로 | 좋은 점·아쉬운 점을 적어 보고 | N | C |
| 31 | 27 | 2 | T | 주말에 무엇을 할까? | 다음 달 대회를 위해 연습 | 지금 하고 싶은 놀이 | F | P |
| 32 | 28 | 2 | O | 새 도구를 만들었다면? | 마을 사람들에게 빌려줘요 | 내 일을 먼저 끝내요 | E | S |
| 33 | 29 | 2 | O | 내 물건이 인기가 많아지면? | 친구들과 함께 팔아요 | 내 가게를 먼저 키워요 | E | S |
| 34 | 30 | 2 | R | 만들기 대회에 나간다면? | 자신 있는 크기로 튼튼하게 | 아무도 안 해 본 큰 작품 | A | T |
| 35 | 31 | 2 | D | 새 아이스크림 맛을 정한다면? | 떠오른 아이디어로 바로 | 친구들에게 먼저 물어봐요 | N | C |
| 36 | 32 | 2 | T | 잘하는 일 하나를 키운다면? | 몇 년 걸려도 꾸준히 연습 | 지금 바로 친구들을 도와요 | F | P |
| 37 | 33-1 | 2 | R | 게임 보상을 고른다면? | 스티커 2개를 확실히 | 주사위로 0개 또는 5개 | A | T |
| 38 | 33-2 | 2 | T | 물건값이 계속 오른다면 내 용돈은? | 오르기 전에 지금 사요 | 이자를 받을 수 있게 모아요 | P | F |
| 39 | 34 | 2 | T | 놀이공원에서 1시간이 남으면? | 내일을 위해 일찍 쉬어요 | 놀이기구를 한 번 더 | F | P |
| 40 | 35 | 2 | D | "그 가게 문 닫는대"라고 하면? | 바로 가서 확인해요 | 다른 친구들 말도 더 들어요 | N | C |
| 41 | 37 | 2 | T | 방학 계획을 세울 때? | 다음 학기 준비도 넣어요 | 하고 싶은 활동 위주로 | F | P |
| 42 | 38 | 2 | D | 투자를 처음 시작한다면? | 작은 돈으로 먼저 시작 | 충분히 알아본 뒤에 | N | C |
| 43 | 39-1 | 2 | R | 큰 기회가 아직 확실하지 않다면? | 자료를 더 찾고 준비되면 | 해 보면서 배우며 | A | T |
| 44 | 39-2 | 2 | O | 내가 가진 힘을 먼저 어디에? | 내 꿈과 목표에 | 가족·친구가 함께 좋아지는 데 | S | E |
| 45 | 40 | 2 | D | 갖고 싶던 물건이 갑자기 인기가 많아지면? | 다 팔리기 전에 바로 사요 | 하루 생각해 봐요 | N | C |
| 46 | 41 | 2 | O | 칭찬 쿠폰 1장을 받으면? | 모둠이 함께 쓰는 물건에 | 내게 필요한 학용품에 | E | S |
| 47 | 42 | 2 | D | 마감 3일 전인 과제가 있으면? | 할 수 있는 부분부터 바로 | 계획표를 먼저 만들어요 | N | C |
| 48 | 43 | 2 | O | 모둠 간식을 고를 때? | 모두가 먹을 수 있는 걸 | 내가 정말 먹고 싶은 걸 | E | S |
| 49 | 44 | 2 | R | 마을에 새 다리를 놓는다면? | 검증된 튼튼한 설계 | 아무도 안 해 본 새 설계 | A | T |
| 50 | 45-1 | 2 | R | 흉년이 올지도 모른다면? | 곡식을 넉넉히 모아 둬요 | 새 장사를 해 봐요 | A | T |
| 51 | 45-2 | 2 | O | 흉년에 내 곳간에 곡식이 있다면? | 우리 가족 몫을 먼저 | 굶는 이웃과 먼저 나눠요 | S | E |
| 52 | 46 | 2 | T | 어른이 되면 어떤 계획을? | 먼 훗날의 꿈을 미리 준비 | 지금의 생활을 즐겁게 | F | P |

축별 문항 수: 1단계 각 축 7개, 2단계 각 축 6개, 합계 각 축 13개.

## 산출물

| 파일 | 내용 |
|---|---|
| `supabase/migrations/2026-11-19-add-efti-record-schema.sql` | 스키마, `questions` + 시드 52행, `records`, `record_results` 뷰, 권한·RLS |
| `supabase/templates/efti_record_import_template.csv` | CSV 헤더 1줄: `class_name,class_time,teacher_name,nickname,completed_on,q01,…,q46` (sort_order 순) |
| `supabase/tests/efti_record_verify.sql` | 검증 스크립트 (BEGIN … ROLLBACK) |

## 적용·운영

- 이 저장소는 Supabase CLI에 링크되어 있지 않으므로 대시보드 SQL Editor에서 마이그레이션을 실행한다.
- CSV 작성: 템플릿을 엑셀로 열어 채우고 "CSV UTF-8"로 저장한다. `completed_on` 은 `YYYY-MM-DD`. 결석 빈칸은 비워 둔다.
- Import: Table Editor → `efti_record.records` → Insert → Import data from CSV.
- 입력 오류는 DB 제약이 막는다: 1·2 외의 값(CHECK), 같은 반·학생·날짜 중복(UNIQUE), 필수 정보 누락(NOT NULL). 오류가 하나라도 있으면 파일 전체가 거부된다.
- 보충 응답 반영: 해당 행의 컬럼을 Table Editor나 SQL `UPDATE` 로 수정한다.
- 결과 조회: `SELECT * FROM efti_record.record_results WHERE class_name = '...'`.

## 검증

`supabase/tests/efti_record_verify.sql` 을 SQL Editor에서 실행한다. 트랜잭션 안에서 샘플을 넣고 결과를 확인한 뒤 ROLLBACK 한다. 기대값과 다르면 `RAISE EXCEPTION` 으로 실패한다.

1. `questions` 행 수 52, stage 1 = 28, stage 2 = 24, (stage 1 기준) 축별 7개, (전체 기준) 축별 13개.
2. `questions.column_name` 집합이 `records` 의 `q*` 컬럼 집합과 정확히 같다 (`information_schema.columns` 비교).
3. 52문항 모두 1인 학생 → `citizen_type = 'PASC'`, `passport_type = 'PASN'`, `missing_codes = '{}'`.
   - 1단계 손계산: T(F1 P6)→P, R(A7)→A, O(S7)→S, D(C6 N1)→C
   - 합산 손계산: T(F6 P7)→P, R(A13)→A, O(S9 E4)→S, D(C6 N7)→N
4. 2단계 `q33_2` 만 빈칸인 학생 → `citizen_type` 값 있음, `passport_type` null, `missing_codes = '{33-2}'`.
5. 1단계 `q15_1` 빈칸 + 2단계 `q46` 빈칸 → 두 유형 모두 null, `missing_codes = '{15-1,46}'`.
6. `q01 = 3` INSERT 가 CHECK 위반으로 실패한다.

## 범위 밖

- 웹앱 입력·조회 화면, API, Exposed schemas 등록
- 24회차 중간 업로드 (48회차 후 일괄 업로드로 결정)
- 기존 `boardgame` / `survey` 데이터와의 연결
- 유형별 설명 문구·2단계 이름(내일 꿈꾸기 등) 저장
