# EFTI 성향기록 관리자 화면 설계

- 작성일: 2026-11-23
- 근거: `proposal/20261123_efti_record_page.md`
- 선행 설계: `docs/superpowers/specs/2026-11-19-efti-record-db-design.md` (스키마 `efti_record`: `questions`, `records`, `record_results`)

## 목표

관리자 모드에 **"EFTI 성향기록"** 메뉴를 추가한다. 선생님은 종이 성향기록지와 같은 모양의 표에서 직접 입력하거나 엑셀/CSV 파일을 올려 저장하고, 결과 테이블에서 학생별 시민권·여권 유형과 보충이 필요한 학생을 확인한다. 나중에 다른 웹으로 옮길 수 있도록 계산·검증·파싱 로직을 화면과 API에서 분리한다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 학생 이름 | 기존 `nickname` 칸 하나. 화면 표기는 "학생 이름". 실명/닉네임은 선생님이 기록지에 적힌 대로 입력 |
| 선생님 | `teacher_name` = 로그인한 관리자 username (텍스트, FK 없음). 화면에서 수정 불가 |
| 권한 | 일반 관리자는 `teacher_name = 내 username` 인 기록만 조회·수정·삭제. 마스터(`isSuper`)는 전체 |
| 반 이름·수업시간 | 자유 입력 + 내가 저장한 값 자동완성. `boardgame.classes` 와 연결하지 않음 |
| 기록지 단위 | `(class_name, class_time, teacher_name, completed_on)` 묶음 = 기록지 한 장 |
| 중복 처리 | 업로드 미리보기에 학생별 "새로 추가 / 덮어쓰기(바뀐 문항 N개)"를 표시하고, 저장을 눌러야 반영 |
| 중간 입력 | 허용. 1단계만 먼저 저장 가능(빈칸 허용). 기록지 헤더(반 이름·수업시간·날짜)를 나중에 고치면 그 기록지의 모든 학생 행이 함께 바뀜 |
| 입력 레이아웃 | 기록지형 표 (문항 = 행, 학생 = 열) |
| 메모 | `records.memo` 컬럼 추가 (학생별, NULL 허용) |
| 모바일 | 메뉴 전체 PC 전용 (`mobile: false`) |
| 엑셀 처리 | 서버에서 `exceljs` 로 템플릿 생성·파일 파싱 |
| 유형 계산 기준 | DB 뷰 `record_results`. 화면의 실시간 계산은 미리보기용이며 뷰와 결과가 같아야 함 |

## 구조

```
shared/eftiRecord/                 프레임워크와 무관한 순수 JS (프론트·서버 공용)
  scoring.js       computeResult(answers, questions)
                   → { citizenType, passportType, citizenCounts, passportCounts, missingCodes }
  validation.js    validateSheet(sheet, questions) → 오류 목록
  sheetFormat.js   기록지 표 ↔ records 행 변환, 정규화, 바뀐 문항 수
  grid.js          업로드 표(2차원 배열) → 기록지 파싱, 문항 행 일치 검사, 셀 주소 붙이기, CSV 파서
server/eftiRecord/
  client.js        efti_record 스키마용 supabase 클라이언트 (server/supabaseSurvey.js 패턴)
  repo.js          기록지 조회·저장(save_sheet RPC)·삭제, 결과 조회. DB 접근은 여기만
  xlsx.js          템플릿 생성, .xlsx/.csv 파싱 (exceljs)
  routes.js        Express Router. requireAdmin + 권한 검사. server/index.js 에서 한 줄로 연결
src/features/eftiRecord/
  api.js           fetch 래퍼 (관리자 토큰 헤더)
  EftiRecordPage.jsx   메뉴 진입. [입력] [결과] 탭
  SheetEditor.jsx      기록지형 표 + 키보드 입력 + 실시간 요약 행
  UploadPreview.jsx    업로드 → 미리보기 → 저장
  ResultsTable.jsx     결과 테이블 + 필터
```

기존 코드는 `src/pages` + `src/components/admin` 구조지만, 다른 웹으로 옮기기 쉽게 하려고 이 기능만 `shared/`, `src/features/eftiRecord/` 로 묶는다. `shared/` 는 브라우저 API나 Node API를 쓰지 않는다.

### 데이터 형태 (공용)

```js
// 문항 (GET /questions 응답, questions 테이블 그대로)
{ code: '15-1', columnName: 'q15_1', stage: 1, axis: 'O', question, option1, option2, letter1, letter2, sortOrder }

// 기록지
{
  header: { teacherName, className, classTime, completedOn /* 'YYYY-MM-DD' */ },
  students: [
    { id /* uuid | undefined(새 학생) */, nickname, memo /* string | null */,
      answers: { '01': 1, '02': 2, '15-1': null, ... } /* 52개 코드, 값 1 | 2 | null */ }
  ]
}

// 오류
{ code: 'INVALID_ANSWER', message: '1 또는 2만 입력할 수 있어요', cell: 'G12' /* 업로드일 때 */,
  studentIndex: 1, questionCode: '03' /* 해당될 때 */, field: 'className' /* 헤더 오류일 때 */ }
```

## DB 변경

마이그레이션 `supabase/migrations/2026-11-23-efti-record-webapp.sql` (대시보드 SQL Editor에서 실행).

1. `ALTER TABLE efti_record.records ADD COLUMN memo text;`
2. `record_results` 뷰를 `CREATE OR REPLACE VIEW` 로 다시 만들고 출력 **맨 끝**에 `memo` 를 추가한다 (기존 컬럼 순서 유지, `security_invoker = true` 유지).
3. 함수 `efti_record.save_sheet(p_original jsonb, p_header jsonb, p_students jsonb, p_delete_ids uuid[]) RETURNS SETOF uuid`
   - `LANGUAGE plpgsql`, 한 트랜잭션으로 실행한다.
   - `p_original` (헤더 4개 키, NULL 이면 새 기록지 또는 업로드)이 있고 `p_header` 와 다르면, 새 헤더에 이미 행이 있을 때 `unique_violation` 으로 거부하고, 없으면 원래 헤더의 모든 행을 `UPDATE` 로 새 헤더로 바꾼다.
   - `p_original` 이 NULL 인데 같은 헤더 기록지가 이미 있으면 그 기록지에 학생을 더한다 (업로드 병합과 같은 동작).
   - `p_delete_ids` 행을 삭제한다. 단, 새 헤더 기록지에 속한 행만 삭제한다.
   - `p_students` 각 항목: `id` 가 있으면 그 행(새 헤더 기록지에 속해야 함)을 `UPDATE`, 없으면 `INSERT`. 문항 컬럼은 `questions.column_name` 으로 찾는다 (코드 하드코딩 없음). `answers` 에 없는 코드는 NULL.
   - 저장된 행 id를 반환한다.
   - `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE ... TO service_role`.
4. 수동 작업 (주석으로 안내): Settings > API > Exposed schemas 에 `efti_record` 추가.

DB 제약(CHECK, UNIQUE, NOT NULL)은 그대로 둔다. 서버 검증을 통과해도 DB 제약이 최종 방어선이다.

## API

모두 `/api/admin/efti-record` 아래, `requireAdmin` 적용.

| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| GET | `/questions` | – | 문항 52개 (`sort_order` 순) |
| GET | `/sheets` | – | `[{ header, studentCount, needsFollowUpCount }]`, `completedOn` 내림차순 |
| GET | `/sheet` | 쿼리: `teacher_name, class_name, class_time, completed_on` | `{ header, students }` (404: 없음) |
| PUT | `/sheet` | `{ original, header, students, deleteIds }` | 저장된 `{ header, students }` |
| DELETE | `/sheet` | 쿼리: 헤더 4개 | 204 |
| POST | `/upload` | 원본 바이트 (`express.raw`, `Content-Type` 로 xlsx/csv 구분, 최대 25MB) | `{ header, students: [{ ..., status: 'new' \| 'overwrite', existingId, changedCount }], errors }` — **저장하지 않음** |
| GET | `/template.xlsx` | – | `questions` 로 생성한 템플릿 파일 |
| GET | `/results` | 쿼리: `teacher_name?, class_name?, class_time?, completed_on?, q?, needs_follow_up?` | `record_results` 행 목록 |

### 저장 규칙

- 학생은 기록지 안에서 `id` 로 구분한다. 이름을 고쳐도 같은 행이 수정된다.
- 입력 화면에서 학생 열을 지우면 (확인 대화상자 후) 저장 시 `deleteIds` 로 보낸다.
- 업로드 저장은 `deleteIds` 를 보내지 않는다. 파일에 없는 기존 학생은 그대로 남는다.
- 업로드 미리보기는 대상 기록지의 기존 학생과 이름(앞뒤 공백 제거 후 완전 일치)으로 맞춘다. 일치하면 `overwrite` (+ `existingId`, 값이 다른 문항 수 `changedCount`), 없으면 `new`. 저장 시 `existingId` 를 `id` 로 보내 덮어쓴다.
- `needsFollowUp` = `passport_type IS NULL` (52문항 중 미응답이 하나라도 있음).

### 권한

- 일반 관리자
  - 저장하는 `header.teacherName` 은 항상 서버가 토큰의 username으로 덮어쓴다.
  - `/sheets`, `/results` 는 자기 기록만 반환. 다른 선생님 기록지를 `GET/PUT/DELETE /sheet` 하면 403.
  - 업로드 파일의 선생님 칸: 비어 있으면 내 username, 내 username이면 통과, 다른 값이면 오류.
- 마스터
  - 모든 기록지 조회·수정·삭제. 남의 기록지를 수정할 때 `teacher_name` 은 원래 값을 유지한다 (`original.teacherName` 과 다르게 바꿀 수 없음).
  - 새 기록지(`original` 이 null 인 저장)는 요청의 선생님 값을 쓰고, 비면 자기 username. 입력 화면은 자기 username을 보내고, 업로드 저장은 파일의 선생님 칸 값을 보낸다.
  - 결과 탭에 선생님 필터가 보인다.

### 검증 (`shared/eftiRecord/validation.js`, 화면·서버 공용)

| 코드 | 조건 |
|---|---|
| `REQUIRED_HEADER` | 반 이름·수업시간·수업 날짜 중 빈 값 (공백만 있어도 빈 값) |
| `INVALID_DATE` | 수업 날짜가 `YYYY-MM-DD` 실제 날짜가 아님 |
| `REQUIRED_NICKNAME` | 문항 값이나 메모가 있는데 학생 이름이 빈 열 |
| `DUPLICATE_NICKNAME` | 한 기록지 안에서 이름이 겹침 |
| `INVALID_ANSWER` | 답이 1·2·빈칸이 아님 |
| `QUESTION_MISMATCH` | (업로드) 문항 행의 코드·순서가 `questions` 와 다름 |
| `TEACHER_MISMATCH` | (업로드, 일반 관리자) 선생님 칸이 내 username이 아님 |
| `NO_STUDENTS` | 저장할 학생이 0명 |

서버 오류 응답: 400 `{ errors }` (검증), 403 (권한), 404 (기록지 없음), 409 `SHEET_EXISTS` (`save_sheet` 의 헤더 충돌 `EF409`) / `NICKNAME_EXISTS` (같은 기록지 학생 이름 UNIQUE 위반 `23505`) / `STALE_SHEET` (`P0002`: 원래 기록지나 학생이 없어짐), 400 `INVALID_INPUT` (`22P02`·`22007`·`22008`), 413 `FILE_TOO_LARGE`, 500 `{ error: '요청을 처리하지 못했어요' }` (상세는 서버 로그만).

## 화면

### 메뉴

`src/components/admin/adminNavItems.js` 에 `{ key: 'efti-record', label: 'EFTI 성향기록', icon, mobile: false }` 추가 (모든 관리자). `AdminDashboard.jsx` 에서 `section === 'efti-record'` 일 때 `EftiRecordPage` 를 렌더한다 (`responses` 처럼 `desktopOnly` 가드 적용). 위쪽에 **[입력] [결과]** 탭.

### 입력 탭

**위쪽 바**
- [새 기록지] / [기존 기록지 열기 ▾] (`/sheets`, 날짜 최신순, "반 · 수업시간 · 날짜 · 학생 N명" 표시. 마스터는 선생님도 표시)
- 헤더: 선생님(읽기 전용), 반 이름·수업시간(자동완성 = `/sheets` 의 고유값), 수업 날짜(`<input type="date">`)
- [엑셀 템플릿 받기] [파일 업로드] [저장]
  - 저장은 변경이 있고 화면 검증 오류가 없을 때만 활성화.
  - 저장하지 않은 변경이 있을 때 다른 기록지를 열거나 탭·메뉴를 옮기면 확인 대화상자. 브라우저 닫기는 `beforeunload` 경고.
  - [기록지 삭제] (기존 기록지일 때, 확인 대화상자)

**기록지형 표**
- 왼쪽 고정 열: 코드 / 질문 / ① 문구 / ② 문구. 단계는 별도 열 대신 구분 행("1단계", 28행 뒤 "2단계")으로 보여준다.
- 학생 열: 맨 위 이름 입력칸, 메모 아이콘(누르면 이름 아래에 메모 입력칸이 펼쳐지고 Esc로 닫힘, 메모가 있으면 아이콘 강조), 열 삭제 버튼. 맨 끝 [+ 학생] 열.
- Tab 순서: 학생 이름 → 그 학생의 첫 문항 → 다음 학생 이름. 나머지 칸은 방향키로 이동한다.
- 셀: `①` / `②` / 빈칸. 클릭하면 빈칸 → ① → ② → 빈칸. 마우스를 올리면 고른 선택지 문구 툴팁.
- 키보드 (셀 포커스 상태):
  - `1` / `2`: 값 입력 후 아래 칸으로 이동 (마지막 문항이면 그대로)
  - `Backspace` / `Delete` / `0`: 비우기
  - 방향키: 이동
  - 이름 칸에서 `Enter`: 그 학생의 첫 문항 칸으로
- 맨 아래 고정 요약 행: 학생별 시민권 유형, 여권 유형, 미응답 수 (툴팁에 미응답 코드). 유형이 없으면 "보충 필요" 배지. 미응답 칸은 연한 강조.
- 검증 오류 칸·입력칸은 빨간 테두리 + 툴팁.
- 실시간 계산은 `shared/eftiRecord/scoring.js` 를 쓴다.

### 업로드 미리보기 (모달)

- 파일에서 읽은 헤더와 학생 열을 같은 표 모양으로 읽기 전용 표시.
- 학생별 배지 `새로 추가` / `덮어쓰기 (바뀐 문항 N개)`, 시민권·여권 유형, 미응답.
- 오류가 있으면 셀 주소와 메시지 목록을 보여주고 [저장] 비활성화.
- [저장] → `PUT /sheet` (`original` = 대상 기록지 헤더 또는 null, `deleteIds` 없음) → 성공하면 모달을 닫고 그 기록지를 입력 탭에 연다.
- 입력 탭에 저장하지 않은 변경이 있으면 업로드 전에 확인 대화상자.

### 엑셀 템플릿 (`/template.xlsx`, 시트 1개 "기록지")

```
A1 선생님 ID   B1 (비우면 로그인 계정)
A2 반 이름     B2
A3 수업시간    B3 (예: 토 10:00)
A4 수업 날짜   B4 (날짜 서식)
6행  코드 | 단계 | 질문 | ① | ② | 학생 이름 → F6 부터 오른쪽 (학생 35명분: F~AN)
7행  메모 (학생 열마다)
8~59행  52문항 (sort_order 순) × 학생 열
```

- 문항 열(A~E)은 `questions` 값으로 채우고 잠금 서식(회색 배경). 학생 칸(F8:AN59)에는 데이터 유효성 검사 "정수 1~2"와 오류 메시지.
- 1단계/2단계 경계(35행과 36행 사이)에 굵은 테두리.
- 파싱: 학생 이름이 빈 열은 건너뛴다(값이 있는데 이름이 비면 `REQUIRED_NICKNAME`). 날짜 칸은 엑셀 날짜·`YYYY-MM-DD` 문자열 모두 받는다. 문항 행은 A열 코드로 `questions` 와 순서까지 대조한다. 숫자 1/2와 문자 "1"/"2" 모두 허용.
- CSV: 같은 배치(1~4행 헤더, 5행 빈 줄, 6행 표 머리, 7행 메모, 8행부터 문항). UTF-8(BOM 허용).

### 결과 탭

- 필터: 선생님(마스터만), 반 이름, 수업시간, 수업 날짜 (`/sheets` 로 만든 드롭다운), 학생 이름 검색, "보충 필요만" 체크박스.
- 컬럼: 학생, 반, 수업시간, 수업 날짜, 선생님, 시민권, 여권, F/P, A/T, S/E, C/N (여권 기준 개수 `n:m`), 미응답(코드 목록), 메모.
- 정렬: 수업 날짜 내림차순 → 반 → 학생 이름.
- 유형이 없는 행은 강조 + "보충 필요" 배지.
- 행 클릭 → 입력 탭에서 그 기록지를 열고 해당 학생 열로 스크롤.

## 테스트 (vitest)

| 파일 | 내용 |
|---|---|
| `shared/eftiRecord/scoring.test.js` | `efti_record_verify.sql` 케이스 3·4·5와 같은 기대값: 모두 1 → `PASC`/`PASN`, 미응답 없음 / `q33_2` 빈칸 → 시민권 있음·여권 null·`['33-2']` / `q15_1`+`q46` 빈칸 → 둘 다 null·`['15-1','46']`. 축별 개수 확인 |
| `shared/eftiRecord/questionsFixture.test.js` | 테스트용 52문항 픽스처가 `2026-11-19-add-efti-record-schema.sql` 시드와 같은지 (SQL 파싱 비교) |
| `shared/eftiRecord/validation.test.js` | 검증 코드별 케이스 |
| `shared/eftiRecord/sheetFormat.test.js` | 표 ↔ records 행 변환, 문항 행 일치 검사 |
| `server/eftiRecord/xlsx.test.js` | 템플릿 생성 → 다시 파싱하면 빈 기록지, 값을 채운 xlsx·csv 파싱, 셀 주소가 들어간 오류 |
| `server/eftiRecord/routes.test.js` | repo 모킹. 일반/마스터 권한, 남의 기록지 403, teacherName 덮어쓰기, 업로드 new/overwrite 판정, EF409·23505·P0002 → 409 |
| `src/features/eftiRecord/SheetEditor.test.jsx` | 3단 토글, 키보드(1/2 후 아래로 이동, Backspace, 방향키), 요약 행 실시간 갱신, 열 추가·삭제, 저장 버튼 활성 조건 |
| `src/features/eftiRecord/UploadPreview.test.jsx` | 배지, 오류 시 저장 비활성 |
| `src/features/eftiRecord/ResultsTable.test.jsx` | 필터, 보충 필요 강조, 행 클릭 이동 |

DB: `supabase/tests/efti_record_verify.sql` 에 케이스를 추가한다 (대시보드에서 수동 실행, BEGIN … ROLLBACK).
7. `memo` 컬럼 존재, `record_results.memo` 출력.
8. `save_sheet` 새 기록지 저장 → 헤더 변경 시 모든 행이 함께 바뀜 → `p_delete_ids` 삭제 → `id` 업데이트.
9. 다른 기록지와 같은 헤더로 바꾸면 UNIQUE 위반.

## 범위 밖

- 유형·축 분포 통계 시각화, 결과 엑셀 내보내기
- 모바일 화면
- 기존 '학생 = 행' CSV 업로드 (11/19 템플릿은 대시보드 Import 용으로 그대로 둠)
- 실명 컬럼, `admins` FK
- 동시 수정 충돌 감지 (나중에 저장한 쪽이 반영됨)
