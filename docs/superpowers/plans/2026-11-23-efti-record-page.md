# EFTI 성향기록 관리자 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 모드에 "EFTI 성향기록" 메뉴를 만들어, 종이 기록지와 같은 표(문항 = 행, 학생 = 열)로 직접 입력하거나 엑셀/CSV를 올려 `efti_record.records` 에 저장하고, `record_results` 뷰로 결과를 조회한다.

**Architecture:** 계산·검증·파싱은 프레임워크와 무관한 `shared/eftiRecord/` 순수 JS로 두고 프론트·서버가 함께 쓴다. 서버는 `server/eftiRecord/` 에 Supabase 접근(repo), 엑셀 처리(xlsx), Express Router(routes)를 나눠 두고 `server/index.js` 에서 한 줄로 연결한다. 기록지 한 장 저장은 Postgres 함수 `efti_record.save_sheet` 한 번으로 원자적으로 처리한다. 프론트는 `src/features/eftiRecord/` 에 모은다.

**Tech Stack:** React 18, Express 5, Supabase(supabase-js 2, PostgREST RPC), exceljs 4.4.0(신규), Vitest + Testing Library.

- Spec: `docs/superpowers/specs/2026-11-23-efti-record-page-design.md`
- 선행 스키마: `supabase/migrations/2026-11-19-add-efti-record-schema.sql`

## 파일 구조

| 파일 | 역할 |
|---|---|
| `shared/eftiRecord/testing/seedQuestions.js` | (테스트 전용) 마이그레이션 시드 SQL을 파싱해 52문항 배열을 돌려준다. 테스트 픽스처 = 시드 |
| `shared/eftiRecord/scoring.js` | `computeResult(answers, questions)` 시민권·여권 유형, 축별 개수, 미응답 |
| `shared/eftiRecord/sheetFormat.js` | 빈 답, 정규화, 헤더 비교, DB 행 ↔ 학생 변환, 바뀐 문항 수 |
| `shared/eftiRecord/validation.js` | 오류 코드·메시지, `validateSheet`, `isValidDate`, `makeError` |
| `shared/eftiRecord/grid.js` | 업로드 표 레이아웃 상수, `parseGrid`, `attachCellRefs`, `parseCsv`, `columnLetter` |
| `supabase/migrations/2026-11-23-efti-record-webapp.sql` | `memo` 컬럼, 뷰 재생성, `save_sheet` 함수, 권한 |
| `supabase/tests/efti_record_verify.sql` | 케이스 8~11 추가 |
| `server/eftiRecord/client.js` | efti_record 스키마 supabase 클라이언트 |
| `server/eftiRecord/repo.js` | DB 접근 전부 |
| `server/eftiRecord/xlsx.js` | 템플릿 생성, 업로드 파일 → 표, `UploadFormatError` |
| `server/eftiRecord/routes.js` | `createEftiRecordRouter({ repo, xlsx, requireAdmin })` |
| `server/index.js` | 라우터 연결 (수정) |
| `src/features/eftiRecord/api.js` | fetch 래퍼, `ApiError` |
| `src/features/eftiRecord/sheetState.js` | 입력 화면 상태 reducer |
| `src/features/eftiRecord/SheetGrid.jsx` | 기록지형 표 (입력·읽기 전용 공용), 키보드, 요약 행 |
| `src/features/eftiRecord/SheetEditor.jsx` | 입력 탭: 헤더, 기록지 열기, 저장·삭제, 업로드 시작 |
| `src/features/eftiRecord/UploadPreview.jsx` | 업로드 미리보기 모달 |
| `src/features/eftiRecord/ResultsTable.jsx` | 결과 탭 |
| `src/features/eftiRecord/EftiRecordPage.jsx` | 메뉴 진입, 탭 전환 |
| `src/features/eftiRecord/EftiRecord.module.css` | 기능 전체 스타일 |
| `src/components/admin/adminNavItems.js`, `src/pages/AdminDashboard.jsx` | 메뉴 연결 (수정) |

공통 데이터 형태 (모든 Task가 이 이름을 쓴다):

```js
// 문항
{ code: '15-1', columnName: 'q15_1', stage: 1, axis: 'O', question, option1, option2, letter1: 'S', letter2: 'E', sortOrder: 15 }
// 헤더
{ teacherName, className, classTime, completedOn /* 'YYYY-MM-DD' */ }
// 학생
{ id /* uuid, 새 학생은 없음 */, nickname, memo /* string|null */, answers: { '01': 1, '15-1': null, ... } }
// 오류
{ code, message, field?, studentIndex?, questionCode?, cell? }
```

테스트 실행 명령은 모두 `npx vitest run <경로>` 이다 (`npm test` 는 watch 모드).

---

### Task 1: 시드 문항 로더 + 유형 계산 (`scoring.js`)

**Files:**
- Create: `shared/eftiRecord/testing/seedQuestions.js`
- Create: `shared/eftiRecord/scoring.js`
- Test: `shared/eftiRecord/scoring.test.js`

- [ ] **Step 1: 시드 로더 작성**

`shared/eftiRecord/testing/seedQuestions.js`:

```js
// 테스트 전용. 문항 목록의 단일 출처인 마이그레이션 시드 SQL을 그대로 읽어 픽스처로 쓴다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SEED_PATH = fileURLToPath(
  new URL('../../../supabase/migrations/2026-11-19-add-efti-record-schema.sql', import.meta.url)
)

// ( 1, '01',   'q01',   1, 'T', '질문', '①', '②', 'F', 'P')
const ROW = /\(\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*([12]),\s*'([TROD])',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([A-Z])',\s*'([A-Z])'\s*\)/g

export function loadSeedQuestions() {
  const sql = readFileSync(SEED_PATH, 'utf8')
  return [...sql.matchAll(ROW)]
    .map(m => ({
      sortOrder: Number(m[1]),
      code: m[2],
      columnName: m[3],
      stage: Number(m[4]),
      axis: m[5],
      question: m[6],
      option1: m[7],
      option2: m[8],
      letter1: m[9],
      letter2: m[10],
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function allAnswers(questions, value) {
  return Object.fromEntries(questions.map(q => [q.code, value]))
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`shared/eftiRecord/scoring.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeResult } from './scoring.js'
import { loadSeedQuestions, allAnswers } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

describe('seed 픽스처', () => {
  it('시드 52문항을 기록지 순서로 읽는다 (1단계 28, 2단계 24)', () => {
    expect(QUESTIONS).toHaveLength(52)
    expect(QUESTIONS.filter(q => q.stage === 1)).toHaveLength(28)
    expect(QUESTIONS[0]).toMatchObject({ code: '01', columnName: 'q01', letter1: 'F', letter2: 'P' })
    expect(QUESTIONS[51]).toMatchObject({ code: '46', sortOrder: 52 })
    expect(new Set(QUESTIONS.map(q => q.code)).size).toBe(52)
  })
})

// supabase/tests/efti_record_verify.sql 케이스 3·4·5와 같은 기대값
describe('computeResult', () => {
  it('52문항 모두 1이면 PASC / PASN, 미응답 없음', () => {
    const r = computeResult(allAnswers(QUESTIONS, 1), QUESTIONS)
    expect(r.citizenType).toBe('PASC')
    expect(r.passportType).toBe('PASN')
    expect(r.citizenCounts).toEqual({ F: 1, P: 6, A: 7, T: 0, S: 7, E: 0, C: 6, N: 1 })
    expect(r.passportCounts).toEqual({ F: 6, P: 7, A: 13, T: 0, S: 9, E: 4, C: 6, N: 7 })
    expect(r.missingCodes).toEqual([])
  })

  it('52문항 모두 2이면 FTEN / FTEC', () => {
    const r = computeResult(allAnswers(QUESTIONS, 2), QUESTIONS)
    expect(r.citizenType).toBe('FTEN')
    expect(r.passportType).toBe('FTEC')
  })

  it('2단계 33-2만 빈칸이면 시민권은 나오고 여권은 null', () => {
    const r = computeResult({ ...allAnswers(QUESTIONS, 1), '33-2': null }, QUESTIONS)
    expect(r.citizenType).toBe('PASC')
    expect(r.passportType).toBeNull()
    expect(r.missingCodes).toEqual(['33-2'])
  })

  it('15-1과 46이 빈칸이면 둘 다 null, 미응답은 기록지 순서', () => {
    const r = computeResult({ ...allAnswers(QUESTIONS, 1), '46': null, '15-1': null }, QUESTIONS)
    expect(r.citizenType).toBeNull()
    expect(r.passportType).toBeNull()
    expect(r.missingCodes).toEqual(['15-1', '46'])
  })

  it('1·2가 아닌 값은 미응답으로 센다', () => {
    const r = computeResult({ ...allAnswers(QUESTIONS, 1), '01': '3' }, QUESTIONS)
    expect(r.missingCodes).toEqual(['01'])
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run shared/eftiRecord/scoring.test.js`
Expected: FAIL — `Failed to resolve import "./scoring.js"`

- [ ] **Step 4: 구현**

`shared/eftiRecord/scoring.js`:

```js
// 기록지 답(1/2/빈칸) → 시민권(1단계 28문항)·여권(52문항) 유형.
// 기준은 DB 뷰 efti_record.record_results 이고, 이 함수는 화면 미리보기용으로 같은 규칙을 따른다.
// 축별로 개수가 많은 문자를 T→R→O→D 순서로 잇는다. 미응답이 하나라도 있으면 null.
export const AXIS_PAIRS = [['F', 'P'], ['A', 'T'], ['S', 'E'], ['C', 'N']]
const LETTERS = AXIS_PAIRS.flat()

function tally(answers, questions) {
  const counts = Object.fromEntries(LETTERS.map(l => [l, 0]))
  const missing = []
  for (const q of questions) {
    const v = answers?.[q.code]
    if (v === 1) counts[q.letter1] += 1
    else if (v === 2) counts[q.letter2] += 1
    else missing.push(q.code)
  }
  return { counts, missing }
}

function typeOf({ counts, missing }) {
  if (missing.length > 0) return null
  return AXIS_PAIRS.map(([a, b]) => (counts[a] > counts[b] ? a : b)).join('')
}

export function computeResult(answers, questions) {
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)
  const citizen = tally(answers, ordered.filter(q => q.stage === 1))
  const passport = tally(answers, ordered)
  return {
    citizenType: typeOf(citizen),
    passportType: typeOf(passport),
    citizenCounts: citizen.counts,
    passportCounts: passport.counts,
    missingCodes: passport.missing,
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run shared/eftiRecord/scoring.test.js`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add shared/eftiRecord
git commit -m "feat: add shared EFTI record scoring matching record_results view"
```

---

### Task 2: 기록지 변환 (`sheetFormat.js`)

**Files:**
- Create: `shared/eftiRecord/sheetFormat.js`
- Test: `shared/eftiRecord/sheetFormat.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`shared/eftiRecord/sheetFormat.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  emptyAnswers, isBlankStudent, normalizeHeader, normalizeSheet, sameHeader,
  headerToRow, rowToHeader, rowToStudent, studentToRpc, countChangedAnswers,
} from './sheetFormat.js'
import { loadSeedQuestions, allAnswers } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

describe('sheetFormat', () => {
  it('emptyAnswers는 52개 코드를 모두 null로 만든다', () => {
    const a = emptyAnswers(QUESTIONS)
    expect(Object.keys(a)).toHaveLength(52)
    expect(a['15-1']).toBeNull()
  })

  it('이름·메모·답이 모두 비면 빈 학생이다', () => {
    expect(isBlankStudent({ nickname: ' ', memo: '', answers: emptyAnswers(QUESTIONS) })).toBe(true)
    expect(isBlankStudent({ nickname: '', memo: '', answers: { ...emptyAnswers(QUESTIONS), '01': 1 } })).toBe(false)
    expect(isBlankStudent({ nickname: '', memo: '결석', answers: {} })).toBe(false)
  })

  it('normalizeSheet는 공백을 다듬고 빈 학생을 빼고 빈 메모를 null로 만든다', () => {
    const sheet = normalizeSheet({
      header: { ...HEADER, className: ' 햇살반 ' },
      students: [
        { id: 'r1', nickname: ' 민준 ', memo: '  ', answers: { '01': 1, '02': '' } },
        { nickname: '', memo: '', answers: {} },
      ],
    }, QUESTIONS)
    expect(sheet.header.className).toBe('햇살반')
    expect(sheet.students).toHaveLength(1)
    expect(sheet.students[0]).toMatchObject({ id: 'r1', nickname: '민준', memo: null })
    expect(sheet.students[0].answers['01']).toBe(1)
    expect(sheet.students[0].answers['02']).toBeNull()
    expect(Object.keys(sheet.students[0].answers)).toHaveLength(52)
  })

  it('sameHeader는 앞뒤 공백을 무시하고 비교한다', () => {
    expect(sameHeader(HEADER, { ...HEADER, classTime: ' 토 10:00 ' })).toBe(true)
    expect(sameHeader(HEADER, { ...HEADER, completedOn: '2026-11-30' })).toBe(false)
  })

  it('헤더와 DB 행을 서로 바꾼다', () => {
    const row = headerToRow(HEADER)
    expect(row).toEqual({ teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23' })
    expect(rowToHeader(row)).toEqual(HEADER)
  })

  it('DB 행 → 학생, 학생 → RPC 형태 (답 키는 column_name)', () => {
    const row = { id: 'r1', nickname: '민준', memo: null, q01: 1, q15_1: 2 }
    const student = rowToStudent(row, QUESTIONS)
    expect(student.answers['01']).toBe(1)
    expect(student.answers['15-1']).toBe(2)
    expect(student.answers['02']).toBeNull()
    const rpc = studentToRpc(student, QUESTIONS)
    expect(rpc).toMatchObject({ id: 'r1', nickname: '민준', memo: null })
    expect(rpc.answers.q15_1).toBe(2)
    expect(studentToRpc({ nickname: 'a', memo: null, answers: {} }, QUESTIONS)).not.toHaveProperty('id')
  })

  it('countChangedAnswers는 값이 다른 문항 수를 센다', () => {
    const a = allAnswers(QUESTIONS, 1)
    expect(countChangedAnswers(a, { ...a, '01': 2, '46': null }, QUESTIONS)).toBe(2)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run shared/eftiRecord/sheetFormat.test.js`
Expected: FAIL — `Failed to resolve import "./sheetFormat.js"`

- [ ] **Step 3: 구현**

`shared/eftiRecord/sheetFormat.js`:

```js
// 기록지(헤더 + 학생 목록)와 DB 행 사이의 변환. 화면·서버 공용.
const trim = v => String(v ?? '').trim()
const toAnswer = v => (v === '' || v === undefined ? null : v)

export function emptyAnswers(questions) {
  return Object.fromEntries(questions.map(q => [q.code, null]))
}

export function isBlankStudent(student) {
  return !trim(student.nickname) && !trim(student.memo)
    && Object.values(student.answers ?? {}).every(v => toAnswer(v) === null)
}

export function normalizeHeader(header = {}) {
  return {
    teacherName: trim(header.teacherName),
    className: trim(header.className),
    classTime: trim(header.classTime),
    completedOn: trim(header.completedOn),
  }
}

export function normalizeSheet(sheet, questions) {
  return {
    header: normalizeHeader(sheet.header),
    students: (sheet.students ?? [])
      .filter(s => !isBlankStudent(s))
      .map(s => ({
        ...(s.id ? { id: s.id } : {}),
        nickname: trim(s.nickname),
        memo: trim(s.memo) || null,
        answers: Object.fromEntries(questions.map(q => [q.code, toAnswer(s.answers?.[q.code])])),
      })),
  }
}

export function sameHeader(a, b) {
  const x = normalizeHeader(a)
  const y = normalizeHeader(b)
  return x.teacherName === y.teacherName && x.className === y.className
    && x.classTime === y.classTime && x.completedOn === y.completedOn
}

export function headerToRow(h) {
  return { teacher_name: h.teacherName, class_name: h.className, class_time: h.classTime, completed_on: h.completedOn }
}

export function rowToHeader(r) {
  return { teacherName: r.teacher_name, className: r.class_name, classTime: r.class_time, completedOn: r.completed_on }
}

export function rowToStudent(row, questions) {
  return {
    id: row.id,
    nickname: row.nickname,
    memo: row.memo ?? null,
    answers: Object.fromEntries(questions.map(q => [q.code, row[q.columnName] ?? null])),
  }
}

// save_sheet RPC 형태: 답 키를 records 컬럼명으로 바꾼다.
export function studentToRpc(student, questions) {
  return {
    ...(student.id ? { id: student.id } : {}),
    nickname: student.nickname,
    memo: student.memo ?? null,
    answers: Object.fromEntries(questions.map(q => [q.columnName, student.answers?.[q.code] ?? null])),
  }
}

export function countChangedAnswers(before, after, questions) {
  return questions.filter(q => (before?.[q.code] ?? null) !== (after?.[q.code] ?? null)).length
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run shared/eftiRecord/sheetFormat.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/eftiRecord/sheetFormat.js shared/eftiRecord/sheetFormat.test.js
git commit -m "feat: add EFTI record sheet format helpers"
```

---

### Task 3: 검증 (`validation.js`)

**Files:**
- Create: `shared/eftiRecord/validation.js`
- Test: `shared/eftiRecord/validation.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`shared/eftiRecord/validation.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateSheet, isValidDate, makeError, ERROR_MESSAGES } from './validation.js'
import { emptyAnswers } from './sheetFormat.js'
import { loadSeedQuestions } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const student = (nickname, answers = {}) => ({ nickname, memo: '', answers: { ...emptyAnswers(QUESTIONS), ...answers } })
const codes = errors => errors.map(e => e.code)

describe('isValidDate', () => {
  it('실제 있는 YYYY-MM-DD만 통과', () => {
    expect(isValidDate('2026-11-23')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026/11/23')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})

describe('validateSheet', () => {
  it('정상 기록지는 오류가 없다 (빈칸 허용)', () => {
    expect(validateSheet({ header: HEADER, students: [student('민준', { '01': 1 })] }, QUESTIONS)).toEqual([])
  })

  it('필수 헤더가 비면 필드별 REQUIRED_HEADER', () => {
    const errors = validateSheet({ header: { ...HEADER, className: ' ', completedOn: '' }, students: [student('민준')] }, QUESTIONS)
    expect(errors.filter(e => e.code === 'REQUIRED_HEADER').map(e => e.field)).toEqual(['className', 'completedOn'])
  })

  it('잘못된 날짜는 INVALID_DATE', () => {
    const errors = validateSheet({ header: { ...HEADER, completedOn: '2026-13-01' }, students: [student('민준')] }, QUESTIONS)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'INVALID_DATE', field: 'completedOn' }))
  })

  it('답이 있는데 이름이 없으면 REQUIRED_NICKNAME, 겹치는 이름은 DUPLICATE_NICKNAME', () => {
    const errors = validateSheet({
      header: HEADER,
      students: [student('민준'), student('', { '01': 1 }), student(' 민준 ')],
    }, QUESTIONS)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'REQUIRED_NICKNAME', studentIndex: 1 }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_NICKNAME', studentIndex: 2 }))
  })

  it('1·2·빈칸이 아닌 답은 INVALID_ANSWER (문항 코드 포함)', () => {
    const errors = validateSheet({ header: HEADER, students: [student('민준', { '15-1': 3, '02': '' })] }, QUESTIONS)
    expect(errors).toEqual([expect.objectContaining({ code: 'INVALID_ANSWER', studentIndex: 0, questionCode: '15-1' })])
  })

  it('빈 학생 열은 건너뛰고, 학생이 하나도 없으면 NO_STUDENTS', () => {
    expect(codes(validateSheet({ header: HEADER, students: [student('')] }, QUESTIONS))).toEqual(['NO_STUDENTS'])
  })

  it('makeError는 기본 메시지를 넣고 덮어쓸 수 있다', () => {
    expect(makeError('INVALID_ANSWER', { cell: 'F8' })).toEqual({ code: 'INVALID_ANSWER', message: ERROR_MESSAGES.INVALID_ANSWER, cell: 'F8' })
    expect(makeError('QUESTION_MISMATCH', { message: 'x' }).message).toBe('x')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run shared/eftiRecord/validation.test.js`
Expected: FAIL — `Failed to resolve import "./validation.js"`

- [ ] **Step 3: 구현**

`shared/eftiRecord/validation.js`:

```js
// 기록지 검증. 화면(실시간)과 서버(저장·업로드)가 같은 함수를 쓴다. DB 제약은 최종 방어선으로 그대로 둔다.
import { isBlankStudent } from './sheetFormat.js'

export const ERROR_MESSAGES = {
  REQUIRED_HEADER: '꼭 입력해야 해요',
  INVALID_DATE: '날짜는 YYYY-MM-DD 형식의 실제 날짜여야 해요',
  REQUIRED_NICKNAME: '학생 이름을 입력해 주세요',
  DUPLICATE_NICKNAME: '같은 기록지에 같은 이름이 있어요',
  INVALID_ANSWER: '1 또는 2만 입력할 수 있어요',
  NO_STUDENTS: '저장할 학생이 없어요',
  QUESTION_MISMATCH: '문항 행이 템플릿과 달라요',
  TEACHER_MISMATCH: '선생님 ID가 로그인한 계정과 달라요',
  EMPTY_FILE: '파일이 비어 있어요',
  FILE_TOO_LARGE: '파일이 너무 커요 (25MB 이하)',
  SHEET_EXISTS: '같은 반·수업시간·날짜의 기록지나 같은 이름의 학생이 이미 있어요',
  STALE_SHEET: '기록지가 그사이 바뀌었어요. 기록지를 다시 열어 주세요',
}

export function makeError(code, extra = {}) {
  return { code, message: ERROR_MESSAGES[code], ...extra }
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const HEADER_FIELDS = ['className', 'classTime', 'completedOn']
const isAllowedAnswer = v => v === null || v === undefined || v === '' || v === 1 || v === 2

export function validateSheet(sheet, questions) {
  const errors = []
  const header = sheet.header ?? {}
  for (const field of HEADER_FIELDS) {
    if (!String(header[field] ?? '').trim()) errors.push(makeError('REQUIRED_HEADER', { field }))
  }
  const date = String(header.completedOn ?? '').trim()
  if (date && !isValidDate(date)) errors.push(makeError('INVALID_DATE', { field: 'completedOn' }))

  const seen = new Set()
  let count = 0
  ;(sheet.students ?? []).forEach((student, studentIndex) => {
    if (isBlankStudent(student)) return
    count += 1
    const name = String(student.nickname ?? '').trim()
    if (!name) errors.push(makeError('REQUIRED_NICKNAME', { studentIndex }))
    else if (seen.has(name)) errors.push(makeError('DUPLICATE_NICKNAME', { studentIndex }))
    else seen.add(name)
    for (const q of questions) {
      if (!isAllowedAnswer(student.answers?.[q.code])) {
        errors.push(makeError('INVALID_ANSWER', { studentIndex, questionCode: q.code }))
      }
    }
  })
  if (count === 0) errors.push(makeError('NO_STUDENTS'))
  return errors
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run shared/eftiRecord/validation.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/eftiRecord/validation.js shared/eftiRecord/validation.test.js
git commit -m "feat: add shared EFTI record sheet validation"
```

---

### Task 4: 업로드 표 파싱 (`grid.js`)

업로드 레이아웃 (엑셀 좌표, 1부터):
- B1 선생님 ID, B2 반 이름, B3 수업시간, B4 수업 날짜
- 6행: A~E 머리(코드|단계|질문|①|②), F열부터 학생 이름
- 7행: 학생별 메모
- 8행부터 52문항 (A열 = 문항 코드), F열부터 답

**Files:**
- Create: `shared/eftiRecord/grid.js`
- Test: `shared/eftiRecord/grid.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`shared/eftiRecord/grid.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LAYOUT, columnLetter, parseGrid, attachCellRefs, parseCsv, normalizeDateText } from './grid.js'
import { validateSheet } from './validation.js'
import { loadSeedQuestions } from './testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

// grid[row-1][col-1] 형태로 템플릿과 같은 배치를 만든다. students: [{ nickname, memo, values: {code: v} }]
function makeGrid({ header = {}, students = [], codes = QUESTIONS.map(q => q.code) } = {}) {
  const grid = []
  const set = (row, col, v) => { (grid[row - 1] ??= [])[col - 1] = v }
  set(1, 1, '선생님 ID'); set(1, 2, header.teacherName ?? null)
  set(2, 1, '반 이름'); set(2, 2, header.className ?? null)
  set(3, 1, '수업시간'); set(3, 2, header.classTime ?? null)
  set(4, 1, '수업 날짜'); set(4, 2, header.completedOn ?? null)
  ;['코드', '단계', '질문', '①', '②'].forEach((t, i) => set(LAYOUT.nameRow, i + 1, t))
  set(LAYOUT.memoRow, 1, '메모')
  codes.forEach((code, i) => set(LAYOUT.firstQuestionRow + i, 1, code))
  students.forEach((s, k) => {
    const col = LAYOUT.firstStudentCol + k
    set(LAYOUT.nameRow, col, s.nickname ?? null)
    set(LAYOUT.memoRow, col, s.memo ?? null)
    QUESTIONS.forEach((q, i) => set(LAYOUT.firstQuestionRow + i, col, s.values?.[q.code] ?? null))
  })
  return grid
}

describe('columnLetter', () => {
  it('1→A, 6→F, 26→Z, 27→AA, 40→AN', () => {
    expect([1, 6, 26, 27, 40].map(columnLetter)).toEqual(['A', 'F', 'Z', 'AA', 'AN'])
  })
})

describe('normalizeDateText', () => {
  it('Date, YYYY/M/D, YYYY.MM.DD 를 YYYY-MM-DD 로', () => {
    expect(normalizeDateText(new Date(Date.UTC(2026, 10, 23)))).toBe('2026-11-23')
    expect(normalizeDateText('2026/11/3')).toBe('2026-11-03')
    expect(normalizeDateText('2026.11.23.')).toBe('2026-11-23')
    expect(normalizeDateText('11월 23일')).toBe('11월 23일')
    expect(normalizeDateText(null)).toBe('')
  })
})

describe('parseGrid', () => {
  it('헤더와 학생 열을 읽고, 빈 학생 열은 건너뛴다', () => {
    const grid = makeGrid({
      header: { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' },
      students: [
        { nickname: '민준', memo: '결석', values: { '01': 1, '15-1': '2' } },
        { nickname: null },
        { nickname: '서연', values: { '46': 2 } },
      ],
    })
    const parsed = parseGrid(grid, QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toEqual({ teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' })
    expect(parsed.students.map(s => s.nickname)).toEqual(['민준', '서연'])
    expect(parsed.students[0]).toMatchObject({ memo: '결석' })
    expect(parsed.students[0].answers).toMatchObject({ '01': 1, '15-1': 2, '02': null })
    expect(parsed.studentColumns).toEqual([6, 8])
  })

  it('숫자로 바뀐 문항 코드(1)는 01 로 맞춘다', () => {
    const codes = QUESTIONS.map(q => q.code)
    codes[0] = 1
    expect(parseGrid(makeGrid({ codes }), QUESTIONS).errors).toEqual([])
  })

  it('문항 행이 다르면 QUESTION_MISMATCH 와 셀 주소', () => {
    const codes = QUESTIONS.map(q => q.code)
    codes[2] = '99'
    const { errors } = parseGrid(makeGrid({ codes: [...codes, '47'] }), QUESTIONS)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'QUESTION_MISMATCH', cell: 'A10' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'QUESTION_MISMATCH', cell: 'A60' }))
  })

  it('attachCellRefs는 검증 오류에 엑셀 셀 주소를 붙인다', () => {
    const grid = makeGrid({
      header: { className: '햇살반', classTime: '토 10:00', completedOn: '' },
      students: [{ nickname: '민준', values: { '03': 3 } }, { nickname: null, values: { '01': 1 } }],
    })
    const parsed = parseGrid(grid, QUESTIONS)
    const errors = attachCellRefs(validateSheet(parsed, QUESTIONS), parsed)
    expect(errors).toContainEqual(expect.objectContaining({ code: 'REQUIRED_HEADER', cell: 'B4' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'INVALID_ANSWER', cell: 'F10' }))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'REQUIRED_NICKNAME', cell: 'G6' }))
  })
})

describe('parseCsv', () => {
  it('BOM, 따옴표, 쉼표, CRLF 를 처리하고 빈 칸은 null', () => {
    expect(parseCsv('﻿a,"b,c","say ""hi"""\r\n,1\r\n')).toEqual([
      ['a', 'b,c', 'say "hi"'],
      [null, '1'],
    ])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run shared/eftiRecord/grid.test.js`
Expected: FAIL — `Failed to resolve import "./grid.js"`

- [ ] **Step 3: 구현**

`shared/eftiRecord/grid.js`:

```js
// 업로드 파일(엑셀·CSV)을 읽은 2차원 표 → 기록지. grid[row-1][col-1] 은 엑셀 좌표와 같다.
import { makeError } from './validation.js'

export const LAYOUT = {
  headerCells: { teacherName: 'B1', className: 'B2', classTime: 'B3', completedOn: 'B4' },
  headerLabels: { teacherName: '선생님 ID', className: '반 이름', classTime: '수업시간', completedOn: '수업 날짜' },
  nameRow: 6,
  memoRow: 7,
  firstQuestionRow: 8,
  firstStudentCol: 6, // F
  templateStudentCount: 35, // F~AN
}

export function columnLetter(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const cellRef = (col, row) => `${columnLetter(col)}${row}`
const at = (grid, row, col) => grid[row - 1]?.[col - 1] ?? null

function text(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

// 엑셀 날짜 셀은 UTC 자정 Date 로 들어온다.
export function normalizeDateText(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const t = text(v)
  const m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : t
}

const normalizeCode = v => (typeof v === 'number' ? String(v).padStart(2, '0') : text(v))

function toAnswer(v) {
  const t = text(v)
  if (t === '') return null
  if (t === '1' || t === '2') return Number(t)
  return t // 1·2가 아니면 그대로 두어 validateSheet 가 INVALID_ANSWER 로 잡는다
}

export function parseGrid(grid, questions) {
  const errors = []
  const header = {}
  for (const [field, ref] of Object.entries(LAYOUT.headerCells)) {
    const v = at(grid, Number(ref.slice(1)), 2)
    header[field] = field === 'completedOn' ? normalizeDateText(v) : text(v)
  }

  const questionRows = {}
  questions.forEach((q, i) => {
    const row = LAYOUT.firstQuestionRow + i
    questionRows[q.code] = row
    if (normalizeCode(at(grid, row, 1)) !== q.code) {
      errors.push(makeError('QUESTION_MISMATCH', {
        cell: cellRef(1, row), questionCode: q.code, message: `${cellRef(1, row)} 에는 문항 ${q.code} 가 있어야 해요`,
      }))
    }
  })
  const extraRow = LAYOUT.firstQuestionRow + questions.length
  if (normalizeCode(at(grid, extraRow, 1))) {
    errors.push(makeError('QUESTION_MISMATCH', {
      cell: cellRef(1, extraRow), message: `${cellRef(1, extraRow)} 부터는 문항이 없어야 해요`,
    }))
  }

  const width = grid.reduce((max, row) => Math.max(max, row?.length ?? 0), 0)
  const students = []
  const studentColumns = []
  for (let col = LAYOUT.firstStudentCol; col <= width; col++) {
    const nickname = text(at(grid, LAYOUT.nameRow, col))
    const memo = text(at(grid, LAYOUT.memoRow, col))
    const answers = Object.fromEntries(questions.map(q => [q.code, toAnswer(at(grid, questionRows[q.code], col))]))
    if (!nickname && !memo && Object.values(answers).every(v => v === null)) continue
    students.push({ nickname, memo: memo || null, answers })
    studentColumns.push(col)
  }
  return { header, students, errors, studentColumns, questionRows }
}

export function attachCellRefs(errors, parsed) {
  return errors.map(e => {
    if (e.cell) return e
    if (e.field) return { ...e, cell: LAYOUT.headerCells[e.field] }
    if (e.studentIndex !== undefined) {
      const col = parsed.studentColumns[e.studentIndex]
      const row = e.questionCode ? parsed.questionRows[e.questionCode] : LAYOUT.nameRow
      return { ...e, cell: cellRef(col, row) }
    }
    return e
  })
}

// RFC 4180 범위: 쉼표 구분, 큰따옴표 감싸기·이스케이프, CRLF/LF. 빈 칸은 null.
export function parseCsv(content) {
  const src = content.replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.map(r => r.map(v => (v === '' ? null : v)))
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run shared/eftiRecord/grid.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/eftiRecord/grid.js shared/eftiRecord/grid.test.js
git commit -m "feat: add EFTI record upload grid parser"
```

---

### Task 5: DB 마이그레이션 + 검증 SQL

자동 테스트가 없는 Task다. SQL은 대시보드 SQL Editor에서 사용자가 실행한다.

**Files:**
- Create: `supabase/migrations/2026-11-23-efti-record-webapp.sql`
- Modify: `supabase/tests/efti_record_verify.sql` (`RAISE NOTICE 'EFTI record verify: ALL PASSED';` 바로 위에 케이스 추가)

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/2026-11-23-efti-record-webapp.sql`:

```sql
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

-- 기록지 한 장 저장. 한 트랜잭션: 헤더 변경 → 삭제 → 학생 업서트.
--   p_original : 원래 헤더 {class_name, class_time, teacher_name, completed_on}. NULL 이면 새 기록지(또는 업로드 병합)
--   p_header   : 저장할 헤더
--   p_students : [{id?, nickname, memo?, answers: {q01: 1|2|null, ...}}]  (answers 키는 questions.column_name)
--   p_delete_ids: 지울 학생 id (저장할 헤더의 기록지에 속한 행만 지운다)
-- 헤더를 바꿨는데 새 헤더에 이미 행이 있으면 unique_violation.
-- id 가 있는데 그 기록지에 없는 학생이면 no_data_found (P0002).
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
BEGIN
  IF p_original IS NOT NULL
     AND (o_class, o_time, o_teacher, o_date) IS DISTINCT FROM (h_class, h_time, h_teacher, h_date) THEN
    IF EXISTS (
      SELECT 1 FROM records
       WHERE class_name = h_class AND class_time = h_time AND teacher_name = h_teacher AND completed_on = h_date
    ) THEN
      RAISE EXCEPTION '이미 같은 반·수업시간·날짜 기록지가 있습니다' USING ERRCODE = 'unique_violation';
    END IF;
    UPDATE records
       SET class_name = h_class, class_time = h_time, teacher_name = h_teacher, completed_on = h_date
     WHERE class_name = o_class AND class_time = o_time AND teacher_name = o_teacher AND completed_on = o_date;
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

  FOR s IN SELECT value FROM jsonb_array_elements(COALESCE(p_students, '[]'::jsonb)) LOOP
    saved := NULL;
    IF s ->> 'id' IS NULL THEN
      EXECUTE format(
        'INSERT INTO records (class_name, class_time, teacher_name, completed_on, nickname, memo, %s)
         VALUES ($2, $3, $4, $5, btrim($1 ->> ''nickname''), NULLIF(btrim($1 ->> ''memo''), ''''), %s)
         RETURNING id', cols, vals)
        INTO saved USING s, h_class, h_time, h_teacher, h_date;
    ELSE
      EXECUTE format(
        'UPDATE records
            SET nickname = btrim($1 ->> ''nickname''), memo = NULLIF(btrim($1 ->> ''memo''), ''''), %s
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
END
$$;

REVOKE ALL ON FUNCTION efti_record.save_sheet(jsonb, jsonb, jsonb, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION efti_record.save_sheet(jsonb, jsonb, jsonb, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION efti_record.save_sheet(jsonb, jsonb, jsonb, uuid[]) TO service_role;
```

- [ ] **Step 2: 검증 SQL에 케이스 추가**

`supabase/tests/efti_record_verify.sql` 에서 `  RAISE NOTICE 'EFTI record verify: ALL PASSED';` 줄 **바로 위에** 아래 블록을 넣는다. 파일 첫머리 주석의 "적용 후" 문장도 `2026-11-19-add-efti-record-schema.sql 과 2026-11-23-efti-record-webapp.sql 적용 후` 로 바꾼다.

```sql
  -- 8. memo 컬럼과 뷰 출력
  UPDATE efti_record.records SET memo = '보충 예정' WHERE nickname = 'miss2' AND class_name = '검증반';
  SELECT * INTO v FROM efti_record.record_results WHERE nickname = 'miss2' AND class_name = '검증반';
  IF v.memo IS DISTINCT FROM '보충 예정' THEN RAISE EXCEPTION 'record_results.memo: 보충 예정 기대, % 나옴', v.memo; END IF;

  -- 9. save_sheet: 새 기록지 저장 → 헤더 변경 + 삭제 + 업데이트
  PERFORM efti_record.save_sheet(
    NULL,
    '{"class_name":"저장반","class_time":"일 10:00","teacher_name":"검증선생","completed_on":"2026-11-23"}',
    '[{"nickname":" 가 ","answers":{"q01":1}},{"nickname":"나","memo":"결석","answers":{"q01":2}}]',
    NULL);
  SELECT count(*) INTO n FROM efti_record.records WHERE class_name = '저장반' AND class_time = '일 10:00';
  IF n <> 2 THEN RAISE EXCEPTION 'save_sheet 새 기록지: 2행 기대, %행', n; END IF;

  PERFORM efti_record.save_sheet(
    '{"class_name":"저장반","class_time":"일 10:00","teacher_name":"검증선생","completed_on":"2026-11-23"}',
    '{"class_name":"저장반","class_time":"일 11:00","teacher_name":"검증선생","completed_on":"2026-11-30"}',
    jsonb_build_array(jsonb_build_object(
      'id', (SELECT id FROM efti_record.records WHERE class_name = '저장반' AND nickname = '가'),
      'nickname', '가나',
      'answers', jsonb_build_object('q01', 2, 'q02', 1))),
    ARRAY[(SELECT id FROM efti_record.records WHERE class_name = '저장반' AND nickname = '나')]);
  SELECT count(*) INTO n FROM efti_record.records WHERE class_name = '저장반';
  IF n <> 1 THEN RAISE EXCEPTION 'save_sheet 삭제: 1행 기대, %행', n; END IF;
  SELECT * INTO v FROM efti_record.records WHERE class_name = '저장반';
  IF (v.class_time, v.completed_on, v.nickname, v.q01, v.q02, v.memo)
     IS DISTINCT FROM ('일 11:00'::text, '2026-11-30'::date, '가나'::text, 2::smallint, 1::smallint, NULL::text) THEN
    RAISE EXCEPTION 'save_sheet 헤더 변경·업데이트 결과 불일치';
  END IF;

  -- 10. 이미 있는 기록지 헤더로 바꾸면 unique_violation
  BEGIN
    PERFORM efti_record.save_sheet(
      '{"class_name":"저장반","class_time":"일 11:00","teacher_name":"검증선생","completed_on":"2026-11-30"}',
      '{"class_name":"검증반","class_time":"토 10:00","teacher_name":"검증선생","completed_on":"2026-11-19"}',
      '[]', NULL);
    RAISE EXCEPTION '이미 있는 기록지 헤더로 바뀜 (충돌 검사 누락)';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 11. 다른 기록지 학생 id 로 업데이트하면 no_data_found
  BEGIN
    PERFORM efti_record.save_sheet(
      NULL,
      '{"class_name":"저장반","class_time":"일 11:00","teacher_name":"검증선생","completed_on":"2026-11-30"}',
      jsonb_build_array(jsonb_build_object(
        'id', (SELECT id FROM efti_record.records WHERE nickname = 'all1' AND class_name = '검증반'),
        'nickname', 'x', 'answers', '{}'::jsonb)),
      NULL);
    RAISE EXCEPTION '다른 기록지 학생이 업데이트됨';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;

```

- [ ] **Step 3: 사용자에게 적용 요청 (수동)**

사용자에게 다음을 요청하고 결과를 받을 때까지 서버 연동 확인(Task 16)은 미룬다. Task 6~15는 계속 진행해도 된다.
1. SQL Editor에서 `supabase/migrations/2026-11-23-efti-record-webapp.sql` 실행
2. Settings > API > Exposed schemas 에 `efti_record` 추가
3. SQL Editor에서 `supabase/tests/efti_record_verify.sql` 실행 → `EFTI record verify: ALL PASSED` 확인

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-11-23-efti-record-webapp.sql supabase/tests/efti_record_verify.sql
git commit -m "feat: add memo column and save_sheet function for EFTI record webapp"
```

---

### Task 6: 엑셀 템플릿·업로드 읽기 (`xlsx.js`)

**Files:**
- Modify: `package.json`, `package-lock.json` (exceljs 추가)
- Create: `server/eftiRecord/xlsx.js`
- Test: `server/eftiRecord/xlsx.test.js`

- [ ] **Step 1: 의존성 설치**

Run: `npm install exceljs@4.4.0`
Expected: `package.json` dependencies 에 `"exceljs": "^4.4.0"` 추가

- [ ] **Step 2: 실패하는 테스트 작성**

`server/eftiRecord/xlsx.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTemplate, parseUpload, detectFormat, UploadFormatError } from './xlsx.js'
import { LAYOUT } from '../../shared/eftiRecord/grid.js'
import { loadSeedQuestions } from '../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

async function loadSheet(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return { wb, ws: wb.worksheets[0] }
}

describe('buildTemplate', () => {
  it('기록지와 같은 배치의 템플릿을 만들고, 다시 읽으면 학생 없는 기록지가 된다', async () => {
    const buffer = await buildTemplate(QUESTIONS, { teacherName: 'kim' })
    expect(detectFormat(buffer)).toBe('xlsx')
    const { ws } = await loadSheet(buffer)
    expect(ws.name).toBe('기록지')
    expect(ws.getCell('A8').value).toBe('01')
    expect(ws.getCell('C8').value).toBe(QUESTIONS[0].question)
    expect(ws.getCell('A59').value).toBe('46')
    expect(ws.getCell('F8').dataValidation?.type).toBe('whole')
    expect(ws.getCell('AN59').dataValidation?.type).toBe('whole')

    const parsed = await parseUpload(buffer, QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toEqual({ teacherName: 'kim', className: '', classTime: '', completedOn: '' })
    expect(parsed.students).toEqual([])
  })

  it('템플릿에 값을 채워 올리면 헤더·학생·답·메모를 읽는다 (날짜 셀 포함)', async () => {
    const { wb, ws } = await loadSheet(await buildTemplate(QUESTIONS, { teacherName: '' }))
    ws.getCell('B2').value = '햇살반'
    ws.getCell('B3').value = '토 10:00'
    ws.getCell('B4').value = new Date(Date.UTC(2026, 10, 23))
    ws.getCell(LAYOUT.nameRow, 6).value = '민준'
    ws.getCell(LAYOUT.memoRow, 6).value = '결석'
    ws.getCell('F8').value = 1
    ws.getCell('F9').value = '2'
    ws.getCell(LAYOUT.nameRow, 7).value = '서연'
    ws.getCell('G59').value = 2
    const parsed = await parseUpload(Buffer.from(await wb.xlsx.writeBuffer()), QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toMatchObject({ className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' })
    expect(parsed.students.map(s => s.nickname)).toEqual(['민준', '서연'])
    expect(parsed.students[0]).toMatchObject({ memo: '결석' })
    expect(parsed.students[0].answers).toMatchObject({ '01': 1, '02': 2, '03': null })
    expect(parsed.students[1].answers['46']).toBe(2)
  })
})

describe('parseUpload (CSV)', () => {
  function csvFor({ date = '2026/11/23', firstAnswer = '1' } = {}) {
    const lines = [
      '선생님 ID,kim', '반 이름,햇살반', '수업시간,토 10:00', `수업 날짜,${date}`, '',
      '코드,단계,질문,①,②,민준', '메모,,,,,',
      ...QUESTIONS.map((q, i) => `${q.code},${q.stage}단계,"${q.question}",x,y,${i === 0 ? firstAnswer : ''}`),
    ]
    return '﻿' + lines.join('\r\n')
  }

  it('같은 배치의 UTF-8 CSV 를 읽는다', async () => {
    const parsed = await parseUpload(Buffer.from(csvFor(), 'utf8'), QUESTIONS)
    expect(parsed.errors).toEqual([])
    expect(parsed.header).toEqual({ teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' })
    expect(parsed.students).toHaveLength(1)
    expect(parsed.students[0].answers['01']).toBe(1)
  })

  it('UTF-8 이 아닌 CSV 는 ENCODING 오류', async () => {
    await expect(parseUpload(Buffer.from([0xff, 0xfe, 0x41, 0x2c]), QUESTIONS))
      .rejects.toMatchObject({ code: 'ENCODING' })
  })

  it('xlsx 시그니처인데 깨진 파일은 UNREADABLE_FILE', async () => {
    const err = await parseUpload(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), QUESTIONS).catch(e => e)
    expect(err).toBeInstanceOf(UploadFormatError)
    expect(err.code).toBe('UNREADABLE_FILE')
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run server/eftiRecord/xlsx.test.js`
Expected: FAIL — `Failed to resolve import "./xlsx.js"`

- [ ] **Step 4: 구현**

`server/eftiRecord/xlsx.js`:

```js
// 기록지 엑셀 템플릿 생성과 업로드 파일(.xlsx/.csv) → 표 읽기. 표 해석은 shared/eftiRecord/grid.js 가 한다.
import ExcelJS from 'exceljs'
import { LAYOUT, parseGrid, parseCsv } from '../../shared/eftiRecord/grid.js'

const GREY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
const ANSWER_VALIDATION = {
  type: 'whole',
  operator: 'between',
  allowBlank: true,
  formulae: [1, 2],
  showErrorMessage: true,
  errorTitle: '입력 오류',
  error: '1 또는 2만 입력할 수 있어요',
}

export class UploadFormatError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export async function buildTemplate(questions, { teacherName = '' } = {}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('기록지', {
    views: [{ state: 'frozen', xSplit: LAYOUT.firstStudentCol - 1, ySplit: LAYOUT.memoRow }],
  })
  const lastCol = LAYOUT.firstStudentCol + LAYOUT.templateStudentCount - 1

  for (const [field, ref] of Object.entries(LAYOUT.headerCells)) {
    const label = ws.getCell(Number(ref.slice(1)), 1)
    label.value = LAYOUT.headerLabels[field]
    label.font = { bold: true }
  }
  ws.getCell(LAYOUT.headerCells.teacherName).value = teacherName
  ws.getCell(LAYOUT.headerCells.completedOn).numFmt = 'yyyy-mm-dd'
  ws.getCell('C1').value = '비우면 로그인한 계정으로 저장돼요'
  ws.getCell('C3').value = '예: 토 10:00'
  ws.getCell('C4').value = '48회차 수업 날짜 (예: 2026-11-23)'
  ws.getCell(LAYOUT.nameRow - 1, LAYOUT.firstStudentCol).value = '6행에 학생 이름, 7행에 메모, 8행부터 1 또는 2를 적어 주세요'

  const head = ws.getRow(LAYOUT.nameRow)
  ;['코드', '단계', '질문', '①', '②'].forEach((t, i) => { head.getCell(i + 1).value = t })
  head.font = { bold: true }
  ws.getCell(LAYOUT.memoRow, 1).value = '메모'

  questions.forEach((q, i) => {
    const row = ws.getRow(LAYOUT.firstQuestionRow + i)
    row.getCell(1).numFmt = '@'
    row.getCell(1).value = q.code
    row.getCell(2).value = `${q.stage}단계`
    row.getCell(3).value = q.question
    row.getCell(4).value = q.option1
    row.getCell(5).value = q.option2
    for (let c = 1; c <= 5; c++) row.getCell(c).fill = GREY
    for (let c = LAYOUT.firstStudentCol; c <= lastCol; c++) {
      const cell = row.getCell(c)
      cell.dataValidation = ANSWER_VALIDATION
      cell.alignment = { horizontal: 'center' }
    }
    const next = questions[i + 1]
    if (next && next.stage !== q.stage) {
      for (let c = 1; c <= lastCol; c++) row.getCell(c).border = { bottom: { style: 'thick' } }
    }
  })

  ;[7, 7, 34, 26, 26].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  for (let c = LAYOUT.firstStudentCol; c <= lastCol; c++) ws.getColumn(c).width = 9
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function cellToPrimitive(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) return cellToPrimitive(v.result)
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('')
    if ('text' in v) return v.text
    return null
  }
  return v
}

function worksheetToGrid(ws) {
  const grid = []
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => { cells[colNumber - 1] = cellToPrimitive(cell.value) })
    grid[rowNumber - 1] = cells
  })
  return grid
}

// xlsx 는 zip 이라 'PK\x03\x04' 로 시작한다. 나머지는 CSV 로 본다.
export function detectFormat(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
    ? 'xlsx'
    : 'csv'
}

async function readUploadGrid(buffer) {
  if (detectFormat(buffer) === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(buffer)
    } catch {
      throw new UploadFormatError('UNREADABLE_FILE', '엑셀 파일을 읽을 수 없어요')
    }
    const ws = wb.worksheets[0]
    if (!ws) throw new UploadFormatError('NO_SHEET', '시트를 찾을 수 없어요')
    return worksheetToGrid(ws)
  }
  let content
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new UploadFormatError('ENCODING', 'CSV는 "CSV UTF-8" 형식으로 저장해 주세요')
  }
  return parseCsv(content)
}

export async function parseUpload(buffer, questions) {
  return parseGrid(await readUploadGrid(buffer), questions)
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run server/eftiRecord/xlsx.test.js`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server/eftiRecord/xlsx.js server/eftiRecord/xlsx.test.js
git commit -m "feat: generate and parse EFTI record xlsx/csv sheets"
```

---

### Task 7: Supabase 클라이언트 + repo

**Files:**
- Create: `server/eftiRecord/client.js`
- Create: `server/eftiRecord/repo.js`
- Test: `server/eftiRecord/repo.test.js`

- [ ] **Step 1: 클라이언트 작성**

`server/eftiRecord/client.js`:

```js
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
}

// boardgame과 같은 Supabase 프로젝트의 efti_record 스키마 (server/supabaseSurvey.js 와 같은 방식).
// 대시보드 Settings > API > Exposed schemas 에 efti_record 가 있어야 한다.
export const supabaseEftiRecord = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'efti_record' },
})
```

- [ ] **Step 2: 실패하는 테스트 작성**

`server/eftiRecord/repo.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('./client.js', () => ({
  supabaseEftiRecord: { from: (...a) => mockFrom(...a), rpc: (...a) => mockRpc(...a) },
}))

import { listQuestions, listSheets, getSheet, saveSheet, deleteSheet, listResults } from './repo.js'
import { loadSeedQuestions } from '../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

// 체인 메서드를 기록하고, await 하면 result 를 돌려주는 가짜 쿼리 빌더
function builder(result) {
  const b = { calls: [] }
  for (const m of ['select', 'order', 'eq', 'ilike', 'is', 'delete']) {
    b[m] = vi.fn((...args) => { b.calls.push([m, ...args]); return b })
  }
  b.range = vi.fn(() => Promise.resolve(result))
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return b
}

beforeEach(() => { mockFrom.mockReset(); mockRpc.mockReset() })

describe('repo', () => {
  it('listQuestions는 sort_order 순 문항을 camelCase 로', async () => {
    const b = builder({ data: [{ code: '01', column_name: 'q01', stage: 1, axis: 'T', question: 'q', option1: 'a', option2: 'b', letter1: 'F', letter2: 'P', sort_order: 1 }], error: null })
    mockFrom.mockReturnValue(b)
    expect(await listQuestions()).toEqual([{ code: '01', columnName: 'q01', stage: 1, axis: 'T', question: 'q', option1: 'a', option2: 'b', letter1: 'F', letter2: 'P', sortOrder: 1 }])
    expect(b.order).toHaveBeenCalledWith('sort_order')
  })

  it('listSheets는 결과 뷰 행을 기록지별로 묶고 보충 필요 수를 센다', async () => {
    const rows = [
      { teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23', passport_type: 'PASN' },
      { teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23', passport_type: null },
      { teacher_name: 'kim', class_name: '달님반', class_time: '일 10:00', completed_on: '2026-11-16', passport_type: 'FTEC' },
    ]
    const b = builder({ data: rows, error: null })
    mockFrom.mockReturnValue(b)
    const sheets = await listSheets({ teacherName: 'kim' })
    expect(mockFrom).toHaveBeenCalledWith('record_results')
    expect(b.eq).toHaveBeenCalledWith('teacher_name', 'kim')
    expect(sheets).toEqual([
      { header: HEADER, studentCount: 2, needsFollowUpCount: 1 },
      { header: { teacherName: 'kim', className: '달님반', classTime: '일 10:00', completedOn: '2026-11-16' }, studentCount: 1, needsFollowUpCount: 0 },
    ])
  })

  it('getSheet는 헤더 4개로 거른 records 를 학생으로 바꾼다', async () => {
    const b = builder({ data: [{ id: 'r1', nickname: '민준', memo: null, q01: 1 }], error: null })
    mockFrom.mockReturnValue(b)
    const students = await getSheet(HEADER, QUESTIONS)
    expect(mockFrom).toHaveBeenCalledWith('records')
    expect(b.eq).toHaveBeenCalledWith('class_name', '햇살반')
    expect(b.eq).toHaveBeenCalledWith('completed_on', '2026-11-23')
    expect(students[0]).toMatchObject({ id: 'r1', nickname: '민준' })
    expect(students[0].answers['01']).toBe(1)
  })

  it('saveSheet는 save_sheet RPC 를 snake_case 인자로 부른다', async () => {
    mockRpc.mockResolvedValue({ data: ['r1'], error: null })
    await saveSheet({
      original: HEADER,
      header: { ...HEADER, classTime: '토 11:00' },
      students: [{ id: 'r1', nickname: '민준', memo: null, answers: { '01': 2 } }],
      deleteIds: [],
    }, QUESTIONS)
    const [name, args] = mockRpc.mock.calls[0]
    expect(name).toBe('save_sheet')
    expect(args.p_original).toEqual({ teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23' })
    expect(args.p_header.class_time).toBe('토 11:00')
    expect(args.p_students[0]).toMatchObject({ id: 'r1', nickname: '민준' })
    expect(args.p_students[0].answers.q01).toBe(2)
    expect(args.p_delete_ids).toBeNull()
  })

  it('saveSheet는 DB 오류(code 포함)를 그대로 던진다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'dup' } })
    await expect(saveSheet({ original: null, header: HEADER, students: [], deleteIds: [] }, QUESTIONS))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('deleteSheet는 헤더 4개로 records 를 지운다', async () => {
    const b = builder({ error: null })
    mockFrom.mockReturnValue(b)
    await deleteSheet(HEADER)
    expect(b.delete).toHaveBeenCalled()
    expect(b.eq).toHaveBeenCalledWith('teacher_name', 'kim')
  })

  it('listResults는 필터를 걸고 결과를 camelCase 로', async () => {
    const b = builder({ data: [{
      record_id: 'r1', teacher_name: 'kim', class_name: '햇살반', class_time: '토 10:00', completed_on: '2026-11-23',
      nickname: '민준', memo: '결석', citizen_type: 'PASC', passport_type: null,
      passport_f: 6, passport_p: 6, passport_a: 12, passport_t: 0, passport_s: 9, passport_e: 3, passport_c: 6, passport_n: 7,
      missing_codes: ['33-2'],
    }], error: null })
    mockFrom.mockReturnValue(b)
    const rows = await listResults({ teacherName: 'kim', className: '햇살반', q: '민_', needsFollowUp: true })
    expect(b.eq).toHaveBeenCalledWith('class_name', '햇살반')
    expect(b.ilike).toHaveBeenCalledWith('nickname', '%민\\_%')
    expect(b.is).toHaveBeenCalledWith('passport_type', null)
    expect(rows[0]).toEqual({
      recordId: 'r1', header: HEADER, nickname: '민준', memo: '결석', citizenType: 'PASC', passportType: null,
      passportCounts: { F: 6, P: 6, A: 12, T: 0, S: 9, E: 3, C: 6, N: 7 }, missingCodes: ['33-2'],
    })
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run server/eftiRecord/repo.test.js`
Expected: FAIL — `Failed to resolve import "./repo.js"`

- [ ] **Step 4: 구현**

`server/eftiRecord/repo.js`:

```js
// efti_record 스키마 접근은 이 파일에서만 한다.
import { supabaseEftiRecord as db } from './client.js'
import { headerToRow, rowToHeader, rowToStudent, studentToRpc } from '../../shared/eftiRecord/sheetFormat.js'

const PAGE = 1000

async function fetchAll(build) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

function whereHeader(query, header) {
  return Object.entries(headerToRow(header)).reduce((q, [k, v]) => q.eq(k, v), query)
}

const escapeLike = s => s.replace(/[\\%_]/g, c => `\\${c}`)

export async function listQuestions() {
  const { data, error } = await db.from('questions').select('*').order('sort_order')
  if (error) throw error
  return data.map(q => ({
    code: q.code, columnName: q.column_name, stage: q.stage, axis: q.axis, question: q.question,
    option1: q.option1, option2: q.option2, letter1: q.letter1, letter2: q.letter2, sortOrder: q.sort_order,
  }))
}

export async function listSheets({ teacherName = null } = {}) {
  const rows = await fetchAll(() => {
    let q = db.from('record_results')
      .select('teacher_name, class_name, class_time, completed_on, passport_type')
    if (teacherName) q = q.eq('teacher_name', teacherName)
    return q.order('completed_on', { ascending: false }).order('class_name').order('class_time').order('record_id')
  })
  const sheets = new Map()
  for (const r of rows) {
    const key = [r.teacher_name, r.class_name, r.class_time, r.completed_on].join('\u0000')
    if (!sheets.has(key)) sheets.set(key, { header: rowToHeader(r), studentCount: 0, needsFollowUpCount: 0 })
    const sheet = sheets.get(key)
    sheet.studentCount += 1
    if (!r.passport_type) sheet.needsFollowUpCount += 1
  }
  return [...sheets.values()]
}

export async function getSheet(header, questions) {
  const { data, error } = await whereHeader(db.from('records').select('*'), header)
    .order('created_at').order('nickname')
  if (error) throw error
  return data.map(r => rowToStudent(r, questions))
}

export async function saveSheet({ original, header, students, deleteIds }, questions) {
  const { data, error } = await db.rpc('save_sheet', {
    p_original: original ? headerToRow(original) : null,
    p_header: headerToRow(header),
    p_students: students.map(s => studentToRpc(s, questions)),
    p_delete_ids: deleteIds?.length ? deleteIds : null,
  })
  if (error) throw error
  return data
}

export async function deleteSheet(header) {
  const { error } = await whereHeader(db.from('records').delete(), header)
  if (error) throw error
}

function toResult(r) {
  return {
    recordId: r.record_id,
    header: rowToHeader(r),
    nickname: r.nickname,
    memo: r.memo ?? null,
    citizenType: r.citizen_type,
    passportType: r.passport_type,
    passportCounts: {
      F: r.passport_f, P: r.passport_p, A: r.passport_a, T: r.passport_t,
      S: r.passport_s, E: r.passport_e, C: r.passport_c, N: r.passport_n,
    },
    missingCodes: r.missing_codes ?? [],
  }
}

export async function listResults({ teacherName, className, classTime, completedOn, q, needsFollowUp } = {}) {
  const rows = await fetchAll(() => {
    let query = db.from('record_results').select('*')
    if (teacherName) query = query.eq('teacher_name', teacherName)
    if (className) query = query.eq('class_name', className)
    if (classTime) query = query.eq('class_time', classTime)
    if (completedOn) query = query.eq('completed_on', completedOn)
    if (q) query = query.ilike('nickname', `%${escapeLike(q)}%`)
    if (needsFollowUp) query = query.is('passport_type', null)
    return query.order('completed_on', { ascending: false }).order('class_name').order('nickname').order('record_id')
  })
  return rows.map(toResult)
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run server/eftiRecord/repo.test.js`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add server/eftiRecord/client.js server/eftiRecord/repo.js server/eftiRecord/repo.test.js
git commit -m "feat: add EFTI record repository over efti_record schema"
```

---

### Task 8: API 라우터 + 서버 연결

**Files:**
- Create: `server/eftiRecord/routes.js`
- Modify: `server/index.js` (import 3줄, `app.post('/api/admin/signup'` 바로 위에 `app.use` 1줄)
- Test: `server/eftiRecord/routes.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/eftiRecord/routes.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import { once } from 'node:events'
import { createEftiRecordRouter } from './routes.js'
import { emptyAnswers } from '../../shared/eftiRecord/sheetFormat.js'
import { loadSeedQuestions, allAnswers } from '../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const TEACHER = { username: 'kim', isSuper: false }
const MASTER = { username: 'admin', isSuper: true }
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const LEE_QUERY = '?teacher_name=lee&class_name=a&class_time=b&completed_on=2026-11-23'

const student = (nickname, answers = {}, extra = {}) => ({ nickname, memo: null, answers: { ...emptyAnswers(QUESTIONS), ...answers }, ...extra })

function fakeRepo(overrides = {}) {
  return {
    listQuestions: vi.fn(async () => QUESTIONS),
    listSheets: vi.fn(async () => []),
    getSheet: vi.fn(async () => []),
    saveSheet: vi.fn(async () => []),
    deleteSheet: vi.fn(async () => {}),
    listResults: vi.fn(async () => []),
    ...overrides,
  }
}

function fakeXlsx(overrides = {}) {
  return {
    buildTemplate: vi.fn(async () => Buffer.from('xlsx')),
    parseUpload: vi.fn(),
    ...overrides,
  }
}

async function call({ repo = fakeRepo(), xlsx = fakeXlsx(), admin = TEACHER, method = 'GET', path, body, raw }) {
  const app = express()
  app.use(express.json())
  const requireAdmin = (req, _res, next) => { req.admin = admin; next() }
  app.use('/api', createEftiRecordRouter({ repo, xlsx, requireAdmin }))
  const server = app.listen(0)
  await once(server, 'listening')
  try {
    const headers = {}
    let payload
    if (raw) { headers['Content-Type'] = 'application/octet-stream'; payload = raw }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: payload })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* 바이너리 응답 */ }
    return { status: res.status, headers: res.headers, json, repo, xlsx }
  } finally {
    server.close()
  }
}

describe('GET /sheets, /results', () => {
  it('일반 관리자는 자기 기록만, 마스터는 전체', async () => {
    const a = await call({ path: '/sheets' })
    expect(a.repo.listSheets).toHaveBeenCalledWith({ teacherName: 'kim' })
    const b = await call({ admin: MASTER, path: '/sheets' })
    expect(b.repo.listSheets).toHaveBeenCalledWith({ teacherName: null })
  })

  it('결과 조회: 일반 관리자는 teacher_name 쿼리를 무시하고 자기 것만', async () => {
    const r = await call({ path: '/results?teacher_name=lee&class_name=햇살반&q=민&needs_follow_up=1' })
    expect(r.repo.listResults).toHaveBeenCalledWith({
      teacherName: 'kim', className: '햇살반', classTime: null, completedOn: null, q: '민', needsFollowUp: true,
    })
    const m = await call({ admin: MASTER, path: '/results?teacher_name=lee' })
    expect(m.repo.listResults).toHaveBeenCalledWith(expect.objectContaining({ teacherName: 'lee', needsFollowUp: false }))
  })
})

describe('GET/DELETE /sheet', () => {
  it('다른 선생님 기록지는 일반 관리자에게 403', async () => {
    expect((await call({ path: `/sheet${LEE_QUERY}` })).status).toBe(403)
    expect((await call({ method: 'DELETE', path: `/sheet${LEE_QUERY}` })).status).toBe(403)
  })

  it('없는 기록지는 404, 있으면 헤더와 학생', async () => {
    expect((await call({ admin: MASTER, path: `/sheet${LEE_QUERY}` })).status).toBe(404)
    const repo = fakeRepo({ getSheet: vi.fn(async () => [student('민준', {}, { id: 'r1' })]) })
    const r = await call({ repo, admin: MASTER, path: `/sheet${LEE_QUERY}` })
    expect(r.status).toBe(200)
    expect(r.json.header).toEqual({ teacherName: 'lee', className: 'a', classTime: 'b', completedOn: '2026-11-23' })
    expect(r.json.students[0].id).toBe('r1')
  })

  it('DELETE 는 204', async () => {
    const r = await call({ method: 'DELETE', path: '/sheet?teacher_name=kim&class_name=a&class_time=b&completed_on=2026-11-23' })
    expect(r.status).toBe(204)
    expect(r.repo.deleteSheet).toHaveBeenCalledWith({ teacherName: 'kim', className: 'a', classTime: 'b', completedOn: '2026-11-23' })
  })
})

describe('PUT /sheet', () => {
  it('새 기록지: 일반 관리자는 선생님 칸을 로그인 계정으로 덮어쓴다', async () => {
    const r = await call({ method: 'PUT', path: '/sheet', body: {
      original: null, header: { ...HEADER, teacherName: 'lee', className: ' 햇살반 ' }, students: [student('민준', { '01': 1 }), student('')], deleteIds: [],
    } })
    expect(r.status).toBe(200)
    const [payload] = r.repo.saveSheet.mock.calls[0]
    expect(payload.header).toEqual(HEADER)
    expect(payload.students).toHaveLength(1)
    expect(r.repo.getSheet).toHaveBeenCalledWith(HEADER, QUESTIONS)
  })

  it('남의 기록지 수정: 일반 관리자는 403, 마스터는 원래 선생님을 유지', async () => {
    const body = { original: { ...HEADER, teacherName: 'lee' }, header: { ...HEADER, teacherName: 'admin' }, students: [student('민준')], deleteIds: ['r9'] }
    expect((await call({ method: 'PUT', path: '/sheet', body })).status).toBe(403)
    const m = await call({ admin: MASTER, method: 'PUT', path: '/sheet', body })
    expect(m.status).toBe(200)
    const [payload] = m.repo.saveSheet.mock.calls[0]
    expect(payload.header.teacherName).toBe('lee')
    expect(payload.original.teacherName).toBe('lee')
    expect(payload.deleteIds).toEqual(['r9'])
  })

  it('검증 오류는 400 이고 저장하지 않는다', async () => {
    const r = await call({ method: 'PUT', path: '/sheet', body: { original: null, header: { ...HEADER, className: '' }, students: [student('민준', { '01': 3 })] } })
    expect(r.status).toBe(400)
    expect(r.json.errors.map(e => e.code)).toEqual(['REQUIRED_HEADER', 'INVALID_ANSWER'])
    expect(r.repo.saveSheet).not.toHaveBeenCalled()
  })

  it('UNIQUE 위반은 409 SHEET_EXISTS, P0002 는 409 STALE_SHEET', async () => {
    const dup = fakeRepo({ saveSheet: vi.fn(async () => { throw { code: '23505' } }) })
    const a = await call({ repo: dup, method: 'PUT', path: '/sheet', body: { original: null, header: HEADER, students: [student('민준')] } })
    expect(a.status).toBe(409)
    expect(a.json.errors[0].code).toBe('SHEET_EXISTS')
    const stale = fakeRepo({ saveSheet: vi.fn(async () => { throw { code: 'P0002' } }) })
    const b = await call({ repo: stale, method: 'PUT', path: '/sheet', body: { original: null, header: HEADER, students: [student('민준')] } })
    expect(b.json.errors[0].code).toBe('STALE_SHEET')
  })
})

describe('POST /upload', () => {
  const parsed = (header, students) => ({
    header, students, errors: [], studentColumns: students.map((_, i) => 6 + i),
    questionRows: Object.fromEntries(QUESTIONS.map((q, i) => [q.code, 8 + i])),
  })

  it('빈 파일은 400 EMPTY_FILE', async () => {
    const r = await call({ method: 'POST', path: '/upload', raw: Buffer.alloc(0) })
    expect(r.status).toBe(400)
    expect(r.json.errors[0].code).toBe('EMPTY_FILE')
  })

  it('일반 관리자 파일의 선생님 칸이 다르면 TEACHER_MISMATCH (B1)', async () => {
    const xlsx = fakeXlsx({ parseUpload: vi.fn(async () => parsed({ ...HEADER, teacherName: 'lee' }, [student('민준', allAnswers(QUESTIONS, 1))])) })
    const r = await call({ xlsx, method: 'POST', path: '/upload', raw: Buffer.from('x') })
    expect(r.status).toBe(200)
    expect(r.json.header.teacherName).toBe('kim')
    expect(r.json.errors).toContainEqual(expect.objectContaining({ code: 'TEACHER_MISMATCH', cell: 'B1' }))
  })

  it('기존 학생과 이름이 같으면 overwrite + 바뀐 문항 수, 아니면 new', async () => {
    const repo = fakeRepo({ getSheet: vi.fn(async () => [student('민준', allAnswers(QUESTIONS, 1), { id: 'r1' })]) })
    const xlsx = fakeXlsx({ parseUpload: vi.fn(async () => parsed({ ...HEADER, teacherName: '' }, [
      student('민준', { ...allAnswers(QUESTIONS, 1), '01': 2 }),
      student('서연', { '01': 1 }),
    ])) })
    const r = await call({ repo, xlsx, method: 'POST', path: '/upload', raw: Buffer.from('x') })
    expect(r.json.errors).toEqual([])
    expect(r.json.existingSheet).toBe(true)
    expect(r.json.students.map(s => [s.nickname, s.status, s.existingId, s.changedCount])).toEqual([
      ['민준', 'overwrite', 'r1', 1],
      ['서연', 'new', null, 0],
    ])
  })

  it('UploadFormatError 는 400 과 그 코드', async () => {
    const { UploadFormatError } = await import('./xlsx.js')
    const xlsx = fakeXlsx({ parseUpload: vi.fn(async () => { throw new UploadFormatError('ENCODING', 'utf8') }) })
    const r = await call({ xlsx, method: 'POST', path: '/upload', raw: Buffer.from('x') })
    expect(r.status).toBe(400)
    expect(r.json.errors[0]).toEqual({ code: 'ENCODING', message: 'utf8' })
  })
})

describe('GET /template.xlsx', () => {
  it('로그인 계정을 선생님 칸에 넣은 엑셀 파일을 내려준다', async () => {
    const r = await call({ path: '/template.xlsx' })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('spreadsheetml')
    expect(r.headers.get('content-disposition')).toContain('attachment')
    expect(r.xlsx.buildTemplate).toHaveBeenCalledWith(QUESTIONS, { teacherName: 'kim' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/eftiRecord/routes.test.js`
Expected: FAIL — `Failed to resolve import "./routes.js"`

- [ ] **Step 3: 구현**

`server/eftiRecord/routes.js`:

```js
// /api/admin/efti-record 라우터. 의존성(repo, xlsx, requireAdmin)을 주입받아 다른 서버로 옮기기 쉽게 한다.
import express from 'express'
import { validateSheet, makeError, isValidDate } from '../../shared/eftiRecord/validation.js'
import { normalizeSheet, normalizeHeader, countChangedAnswers } from '../../shared/eftiRecord/sheetFormat.js'
import { attachCellRefs } from '../../shared/eftiRecord/grid.js'
import { UploadFormatError } from './xlsx.js'

const TEMPLATE_FILENAME = 'EFTI_성향기록지_템플릿.xlsx'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function headerFromQuery(q) {
  return normalizeHeader({
    teacherName: q.teacher_name, className: q.class_name, classTime: q.class_time, completedOn: q.completed_on,
  })
}

function sendError(res, err) {
  if (err?.code === '23505') return res.status(409).json({ errors: [makeError('SHEET_EXISTS')] })
  if (err?.code === 'P0002') return res.status(409).json({ errors: [makeError('STALE_SHEET')] })
  if (err?.type === 'entity.too.large') return res.status(413).json({ errors: [makeError('FILE_TOO_LARGE')] })
  console.error('efti-record error:', err)
  return res.status(500).json({ error: '요청을 처리하지 못했어요' })
}

export function createEftiRecordRouter({ repo, xlsx, requireAdmin }) {
  const router = express.Router()
  router.use(requireAdmin)

  const canAccess = (req, teacherName) => Boolean(req.admin.isSuper) || teacherName === req.admin.username
  const handle = fn => async (req, res) => {
    try {
      await fn(req, res)
    } catch (err) {
      sendError(res, err)
    }
  }

  router.get('/questions', handle(async (_req, res) => {
    res.json(await repo.listQuestions())
  }))

  router.get('/sheets', handle(async (req, res) => {
    res.json(await repo.listSheets({ teacherName: req.admin.isSuper ? null : req.admin.username }))
  }))

  router.get('/sheet', handle(async (req, res) => {
    const header = headerFromQuery(req.query)
    if (!canAccess(req, header.teacherName)) return res.status(403).json({ error: 'Forbidden' })
    const questions = await repo.listQuestions()
    const students = await repo.getSheet(header, questions)
    if (students.length === 0) return res.status(404).json({ error: 'Sheet not found' })
    res.json({ header, students })
  }))

  router.put('/sheet', handle(async (req, res) => {
    const { original = null, header = {}, students = [], deleteIds = [] } = req.body ?? {}
    let teacherName
    if (original) {
      teacherName = normalizeHeader(original).teacherName
      if (!canAccess(req, teacherName)) return res.status(403).json({ error: 'Forbidden' })
    } else {
      const requested = String(header.teacherName ?? '').trim()
      teacherName = req.admin.isSuper && requested ? requested : req.admin.username
    }
    const sheet = { header: { ...header, teacherName }, students }
    const questions = await repo.listQuestions()
    const errors = validateSheet(sheet, questions)
    if (errors.length) return res.status(400).json({ errors })
    const normalized = normalizeSheet(sheet, questions)
    await repo.saveSheet({
      original: original ? normalizeHeader(original) : null,
      header: normalized.header,
      students: normalized.students,
      deleteIds: Array.isArray(deleteIds) ? deleteIds : [],
    }, questions)
    res.json({ header: normalized.header, students: await repo.getSheet(normalized.header, questions) })
  }))

  router.delete('/sheet', handle(async (req, res) => {
    const header = headerFromQuery(req.query)
    if (!canAccess(req, header.teacherName)) return res.status(403).json({ error: 'Forbidden' })
    await repo.deleteSheet(header)
    res.status(204).end()
  }))

  router.post('/upload', express.raw({ type: () => true, limit: '25mb' }), handle(async (req, res) => {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    if (buffer.length === 0) return res.status(400).json({ errors: [makeError('EMPTY_FILE')] })
    const questions = await repo.listQuestions()
    let parsed
    try {
      parsed = await xlsx.parseUpload(buffer, questions)
    } catch (err) {
      if (err instanceof UploadFormatError) return res.status(400).json({ errors: [{ code: err.code, message: err.message }] })
      throw err
    }

    const errors = [...parsed.errors]
    const fileTeacher = String(parsed.header.teacherName ?? '').trim()
    let teacherName = req.admin.username
    if (req.admin.isSuper) teacherName = fileTeacher || req.admin.username
    else if (fileTeacher && fileTeacher !== req.admin.username) errors.push(makeError('TEACHER_MISMATCH', { field: 'teacherName' }))

    const sheet = { header: { ...parsed.header, teacherName }, students: parsed.students }
    errors.push(...validateSheet(sheet, questions))
    const header = normalizeHeader(sheet.header)

    let existing = []
    if (header.className && header.classTime && isValidDate(header.completedOn)) {
      existing = await repo.getSheet(header, questions)
    }
    const byName = new Map(existing.map(s => [s.nickname.trim(), s]))
    const students = parsed.students.map(s => {
      const match = byName.get(s.nickname.trim())
      return match
        ? { ...s, status: 'overwrite', existingId: match.id, changedCount: countChangedAnswers(match.answers, s.answers, questions) }
        : { ...s, status: 'new', existingId: null, changedCount: 0 }
    })
    res.json({ header, students, errors: attachCellRefs(errors, parsed), existingSheet: existing.length > 0 })
  }))

  router.get('/template.xlsx', handle(async (req, res) => {
    const buffer = await xlsx.buildTemplate(await repo.listQuestions(), { teacherName: req.admin.username })
    res.set({
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="efti-record-template.xlsx"; filename*=UTF-8''${encodeURIComponent(TEMPLATE_FILENAME)}`,
    })
    res.send(buffer)
  }))

  router.get('/results', handle(async (req, res) => {
    const q = req.query
    res.json(await repo.listResults({
      teacherName: req.admin.isSuper ? (q.teacher_name || null) : req.admin.username,
      className: q.class_name || null,
      classTime: q.class_time || null,
      completedOn: q.completed_on || null,
      q: String(q.q ?? '').trim() || null,
      needsFollowUp: q.needs_follow_up === '1',
    }))
  }))

  // express.raw 의 크기 초과 등 미들웨어 오류
  router.use((err, _req, res, _next) => sendError(res, err))

  return router
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/eftiRecord/routes.test.js`
Expected: PASS (14 tests)

- [ ] **Step 5: 서버에 연결**

`server/index.js` 상단 import 블록 끝(`import { toBoardCount } ...` 아래)에 추가:

```js
import { createEftiRecordRouter } from './eftiRecord/routes.js'
import * as eftiRecordRepo from './eftiRecord/repo.js'
import * as eftiRecordXlsx from './eftiRecord/xlsx.js'
```

`app.post('/api/admin/signup', async (req, res) => {` 줄 **바로 위**에 추가:

```js
// EFTI 성향기록지 입력·조회 (docs/superpowers/specs/2026-11-23-efti-record-page-design.md)
app.use('/api/admin/efti-record', createEftiRecordRouter({ repo: eftiRecordRepo, xlsx: eftiRecordXlsx, requireAdmin }))

```

- [ ] **Step 6: 서버 테스트 전체 확인**

Run: `npx vitest run server shared`
Expected: PASS (기존 server 테스트 포함 전부)

- [ ] **Step 7: Commit**

```bash
git add server/eftiRecord/routes.js server/eftiRecord/routes.test.js server/index.js
git commit -m "feat: add EFTI record admin API"
```

---

### Task 9: 프론트 API 래퍼

**Files:**
- Create: `src/features/eftiRecord/api.js`
- Test: `src/features/eftiRecord/api.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/api.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSheet, saveSheet, deleteSheet, fetchResults, uploadFile, ApiError } from './api'
import { setAdminSession, clearAdminSession } from '../../utils/adminAuth'

const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

beforeEach(() => {
  clearAdminSession()
  setAdminSession('t1', { username: 'kim', isSuper: false })
  global.fetch = vi.fn(() => ok({}))
})

describe('eftiRecord api', () => {
  it('fetchSheet는 헤더를 쿼리로 보내고 토큰을 붙인다', async () => {
    await fetchSheet(HEADER)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/efti-record/sheet?teacher_name=kim&class_name=%ED%96%87%EC%82%B4%EB%B0%98&class_time=%ED%86%A0+10%3A00&completed_on=2026-11-23')
    expect(options.headers.Authorization).toBe('Bearer t1')
  })

  it('saveSheet는 PUT JSON', async () => {
    await saveSheet({ original: null, header: HEADER, students: [], deleteIds: [] })
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/efti-record/sheet')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body).header).toEqual(HEADER)
  })

  it('오류 응답은 errors 를 가진 ApiError', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ errors: [{ code: 'SHEET_EXISTS', message: '이미 있어요' }] }) }))
    const err = await saveSheet({}).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.errors[0].code).toBe('SHEET_EXISTS')
    expect(err.message).toBe('이미 있어요')
  })

  it('deleteSheet 204 는 null', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) }))
    expect(await deleteSheet(HEADER)).toBeNull()
  })

  it('fetchResults는 값이 있는 필터만 보낸다', async () => {
    await fetchResults({ teacherName: '', className: '햇살반', q: '', needsFollowUp: true })
    expect(global.fetch.mock.calls[0][0]).toBe('/api/admin/efti-record/results?class_name=%ED%96%87%EC%82%B4%EB%B0%98&needs_follow_up=1')
  })

  it('uploadFile은 파일을 octet-stream 으로 보낸다', async () => {
    const file = new Blob(['x'])
    await uploadFile(file)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/efti-record/upload')
    expect(options.headers['Content-Type']).toBe('application/octet-stream')
    expect(options.body).toBe(file)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/api.test.js`
Expected: FAIL — `Failed to resolve import "./api"`

- [ ] **Step 3: 구현**

`src/features/eftiRecord/api.js`:

```js
import { adminFetch } from '../../utils/adminAuth'

const BASE = '/api/admin/efti-record'
const TEMPLATE_FILENAME = 'EFTI_성향기록지_템플릿.xlsx'

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.errors?.[0]?.message ?? body?.error ?? `HTTP ${status}`)
    this.status = status
    this.errors = body?.errors ?? []
  }
}

async function request(path, options) {
  const res = await adminFetch(`${BASE}${path}`, options)
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body
}

const headerQuery = h => new URLSearchParams({
  teacher_name: h.teacherName, class_name: h.className, class_time: h.classTime, completed_on: h.completedOn,
}).toString()

export const fetchQuestions = () => request('/questions')
export const fetchSheets = () => request('/sheets')
export const fetchSheet = header => request(`/sheet?${headerQuery(header)}`)
export const deleteSheet = header => request(`/sheet?${headerQuery(header)}`, { method: 'DELETE' })

export const saveSheet = payload => request('/sheet', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

export const uploadFile = file => request('/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: file,
})

export function fetchResults(filters = {}) {
  const params = new URLSearchParams()
  if (filters.teacherName) params.set('teacher_name', filters.teacherName)
  if (filters.className) params.set('class_name', filters.className)
  if (filters.classTime) params.set('class_time', filters.classTime)
  if (filters.completedOn) params.set('completed_on', filters.completedOn)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.needsFollowUp) params.set('needs_follow_up', '1')
  const qs = params.toString()
  return request(`/results${qs ? `?${qs}` : ''}`)
}

export async function downloadTemplate() {
  const res = await adminFetch(`${BASE}/template.xlsx`)
  if (!res.ok) throw new ApiError(res.status, null)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = TEMPLATE_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/api.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/eftiRecord/api.js src/features/eftiRecord/api.test.js
git commit -m "feat: add EFTI record frontend API client"
```

---

### Task 10: 입력 화면 상태 (`sheetState.js`)

**Files:**
- Create: `src/features/eftiRecord/sheetState.js`
- Test: `src/features/eftiRecord/sheetState.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/sheetState.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { sheetReducer, initialSheetState, loadedSheetState, toSavePayload } from './sheetState'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

describe('sheetState', () => {
  it('새 기록지는 선생님이 채워진 빈 헤더와 빈 학생 1명', () => {
    const s = initialSheetState(QUESTIONS, 'kim')
    expect(s.original).toBeNull()
    expect(s.header).toEqual({ teacherName: 'kim', className: '', classTime: '', completedOn: '' })
    expect(s.students).toHaveLength(1)
    expect(s.students[0].answers['01']).toBeNull()
    expect(s.dirty).toBe(false)
  })

  it('cycleAnswer 는 빈칸 → 1 → 2 → 빈칸', () => {
    let s = initialSheetState(QUESTIONS, 'kim')
    const key = s.students[0].key
    const step = () => { s = sheetReducer(s, { type: 'cycleAnswer', key, code: '01' }); return s.students[0].answers['01'] }
    expect([step(), step(), step()]).toEqual([1, 2, null])
    expect(s.dirty).toBe(true)
  })

  it('저장된 학생 열을 지우면 deleteIds 에 id 가 들어간다', () => {
    let s = loadedSheetState(HEADER, [{ id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }])
    s = sheetReducer(s, { type: 'addStudent', questions: QUESTIONS })
    expect(s.students).toHaveLength(2)
    s = sheetReducer(s, { type: 'removeStudent', key: s.students[0].key })
    s = sheetReducer(s, { type: 'removeStudent', key: s.students[0].key })
    expect(s.deleteIds).toEqual(['r1'])
    expect(s.students).toHaveLength(0)
  })

  it('toSavePayload 는 original·header·students(id 있는 것만 id)·deleteIds', () => {
    let s = loadedSheetState(HEADER, [{ id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }])
    s = sheetReducer(s, { type: 'setHeader', field: 'classTime', value: '토 11:00' })
    s = sheetReducer(s, { type: 'addStudent', questions: QUESTIONS })
    s = sheetReducer(s, { type: 'setStudentField', key: s.students[1].key, field: 'nickname', value: '서연' })
    s = sheetReducer(s, { type: 'setAnswer', key: s.students[1].key, code: '01', value: 2 })
    const p = toSavePayload(s)
    expect(p.original).toEqual(HEADER)
    expect(p.header.classTime).toBe('토 11:00')
    expect(p.students[0]).toMatchObject({ id: 'r1', nickname: '민준', memo: '' })
    expect(p.students[1]).not.toHaveProperty('id')
    expect(p.students[1].answers['01']).toBe(2)
    expect(p.deleteIds).toEqual([])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/sheetState.test.js`
Expected: FAIL — `Failed to resolve import "./sheetState"`

- [ ] **Step 3: 구현**

`src/features/eftiRecord/sheetState.js`:

```js
// 입력 화면(기록지 한 장) 상태. key 는 화면용 식별자, id 는 DB 행 id(새 학생은 null).
import { emptyAnswers } from '../../../shared/eftiRecord/sheetFormat.js'

let seq = 0
const newKey = () => `s${++seq}`

export function blankStudent(questions) {
  return { key: newKey(), id: null, nickname: '', memo: '', answers: emptyAnswers(questions) }
}

export function initialSheetState(questions, teacherName) {
  return {
    original: null,
    header: { teacherName, className: '', classTime: '', completedOn: '' },
    students: [blankStudent(questions)],
    deleteIds: [],
    dirty: false,
  }
}

export function loadedSheetState(header, students) {
  return {
    original: header,
    header,
    students: students.map(s => ({ key: newKey(), id: s.id, nickname: s.nickname, memo: s.memo ?? '', answers: s.answers })),
    deleteIds: [],
    dirty: false,
  }
}

const NEXT_ANSWER = { null: 1, 1: 2, 2: null }

function updateStudent(state, key, fn) {
  return { ...state, students: state.students.map(s => (s.key === key ? fn(s) : s)), dirty: true }
}

export function sheetReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return action.state
    case 'setHeader':
      return { ...state, header: { ...state.header, [action.field]: action.value }, dirty: true }
    case 'addStudent':
      return { ...state, students: [...state.students, blankStudent(action.questions)], dirty: true }
    case 'removeStudent': {
      const target = state.students.find(s => s.key === action.key)
      return {
        ...state,
        students: state.students.filter(s => s.key !== action.key),
        deleteIds: target?.id ? [...state.deleteIds, target.id] : state.deleteIds,
        dirty: true,
      }
    }
    case 'setStudentField':
      return updateStudent(state, action.key, s => ({ ...s, [action.field]: action.value }))
    case 'setAnswer':
      return updateStudent(state, action.key, s => ({ ...s, answers: { ...s.answers, [action.code]: action.value } }))
    case 'cycleAnswer':
      return updateStudent(state, action.key, s => ({
        ...s, answers: { ...s.answers, [action.code]: NEXT_ANSWER[s.answers[action.code] ?? null] ?? null },
      }))
    default:
      return state
  }
}

export function toSavePayload(state) {
  return {
    original: state.original,
    header: state.header,
    students: state.students.map(({ id, nickname, memo, answers }) => ({ ...(id ? { id } : {}), nickname, memo, answers })),
    deleteIds: state.deleteIds,
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/sheetState.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/eftiRecord/sheetState.js src/features/eftiRecord/sheetState.test.js
git commit -m "feat: add EFTI record sheet editor state reducer"
```

---

### Task 11: 기록지형 표 (`SheetGrid.jsx`) + 스타일

**Files:**
- Create: `src/features/eftiRecord/SheetGrid.jsx`
- Create: `src/features/eftiRecord/EftiRecord.module.css`
- Test: `src/features/eftiRecord/SheetGrid.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/SheetGrid.test.jsx`:

```jsx
import { useReducer, useMemo } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SheetGrid from './SheetGrid'
import { sheetReducer, initialSheetState } from './sheetState'
import { computeResult } from '../../../shared/eftiRecord/scoring.js'
import { loadSeedQuestions } from '../../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

function Harness({ onRemove = vi.fn() }) {
  const [state, dispatch] = useReducer(sheetReducer, undefined, () => initialSheetState(QUESTIONS, 'kim'))
  const results = useMemo(() => state.students.map(s => computeResult(s.answers, QUESTIONS)), [state.students])
  return (
    <SheetGrid
      questions={QUESTIONS}
      students={state.students}
      results={results}
      onCycle={(key, code) => dispatch({ type: 'cycleAnswer', key, code })}
      onSetAnswer={(key, code, value) => dispatch({ type: 'setAnswer', key, code, value })}
      onSetName={(key, value) => dispatch({ type: 'setStudentField', key, field: 'nickname', value })}
      onSetMemo={(key, value) => dispatch({ type: 'setStudentField', key, field: 'memo', value })}
      onRemove={onRemove}
      onAdd={() => dispatch({ type: 'addStudent', questions: QUESTIONS })}
    />
  )
}

const cell = name => screen.getByRole('button', { name })

describe('SheetGrid', () => {
  it('문항 코드·질문·선택지와 1단계/2단계 구분 행을 보여준다', () => {
    render(<Harness />)
    expect(screen.getByText('더 멋진 사람은?')).toBeInTheDocument()
    expect(screen.getByText('내일을 위해 차근차근 준비')).toBeInTheDocument()
    expect(screen.getByText('1단계')).toBeInTheDocument()
    expect(screen.getByText('2단계')).toBeInTheDocument()
  })

  it('클릭하면 빈칸 → ① → ② → 빈칸', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(cell('학생 1 01'))
    expect(cell('학생 1 01')).toHaveTextContent('①')
    await user.click(cell('학생 1 01'))
    expect(cell('학생 1 01')).toHaveTextContent('②')
    await user.click(cell('학생 1 01'))
    expect(cell('학생 1 01')).toHaveTextContent(/^$/)
  })

  it('1/2 를 누르면 입력하고 아래 칸으로, Backspace 는 비우기, 방향키 이동', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    act(() => cell('학생 1 01').focus())
    await user.keyboard('1')
    expect(cell('학생 1 01')).toHaveTextContent('①')
    expect(cell('학생 1 02')).toHaveFocus()
    await user.keyboard('2')
    expect(cell('학생 1 02')).toHaveTextContent('②')
    await user.keyboard('{ArrowUp}{Backspace}')
    expect(cell('학생 1 01')).toHaveTextContent(/^$/)
  })

  it('이름을 넣고 52문항을 모두 1로 채우면 요약 행에 PASC / PASN', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('학생 1 이름'), '민준{Enter}')
    expect(cell('민준 01')).toHaveFocus()
    expect(screen.getAllByText('보충 필요').length).toBeGreaterThan(0)
    await user.keyboard('1'.repeat(52))
    expect(screen.getByText('PASC')).toBeInTheDocument()
    expect(screen.getByText('PASN')).toBeInTheDocument()
    expect(screen.queryByText('보충 필요')).not.toBeInTheDocument()
  })

  it('+ 학생 으로 열을 늘리고, 삭제 버튼은 onRemove(key)', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Harness onRemove={onRemove} />)
    await user.click(screen.getByRole('button', { name: '+ 학생' }))
    expect(screen.getByLabelText('학생 2 이름')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '학생 2 삭제' }))
    expect(onRemove).toHaveBeenCalledWith(expect.stringMatching(/^s\d+$/))
  })

  it('읽기 전용이면 배지·메모를 보여주고 입력 버튼이 없다', () => {
    const students = [{ key: 'u0', nickname: '민준', memo: '결석', answers: { '01': 1, '02': '3' } }]
    render(
      <SheetGrid
        readOnly
        questions={QUESTIONS}
        students={students}
        results={[computeResult(students[0].answers, QUESTIONS)]}
        errors={[{ code: 'INVALID_ANSWER', message: '1 또는 2만', studentIndex: 0, questionCode: '02' }]}
        badges={{ u0: '새로 추가' }}
      />
    )
    expect(screen.getByText('새로 추가')).toBeInTheDocument()
    expect(screen.getByTitle('결석')).toBeInTheDocument()
    expect(screen.getByText('3')).toHaveAttribute('title', '1 또는 2만')
    expect(screen.queryByRole('button', { name: '+ 학생' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/SheetGrid.test.jsx`
Expected: FAIL — `Failed to resolve import "./SheetGrid"`

- [ ] **Step 3: 표 컴포넌트 구현**

`src/features/eftiRecord/SheetGrid.jsx`:

```jsx
// 기록지형 표: 문항 = 행, 학생 = 열. 입력 화면과 업로드 미리보기(readOnly)가 함께 쓴다.
import { Fragment, useEffect, useRef, useState } from 'react'
import styles from './EftiRecord.module.css'

const MARK = { 1: '①', 2: '②' }
const MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

const studentLabel = (s, i) => String(s.nickname ?? '').trim() || `학생 ${i + 1}`
const display = v => MARK[v] ?? (v === null || v === undefined ? '' : String(v))

export default function SheetGrid({
  questions, students, results, errors = [], readOnly = false, badges = {}, focusKey = null,
  onCycle, onSetAnswer, onSetName, onSetMemo, onRemove, onAdd,
}) {
  const refs = useRef(new Map())
  const [memoOpen, setMemoOpen] = useState(null)
  const setRef = key => el => { if (el) refs.current.set(key, el); else refs.current.delete(key) }
  const extraCol = readOnly ? 0 : 1
  const firstStage2 = questions.findIndex(q => q.stage === 2)

  const answerError = (i, code) => errors.find(e => e.studentIndex === i && e.questionCode === code)
  const nameError = i => errors.find(e => e.studentIndex === i && !e.questionCode)

  useEffect(() => {
    if (focusKey) refs.current.get(`name:${focusKey}`)?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [focusKey])

  const focusCell = (row, col) => refs.current.get(`${row}:${col}`)?.focus()

  function handleCellKey(e, row, col, student, q) {
    if (MOVES[e.key]) {
      e.preventDefault()
      const [dr, dc] = MOVES[e.key]
      focusCell(
        Math.min(Math.max(row + dr, 0), questions.length - 1),
        Math.min(Math.max(col + dc, 0), students.length - 1),
      )
    } else if (e.key === '1' || e.key === '2') {
      e.preventDefault()
      onSetAnswer(student.key, q.code, Number(e.key))
      if (row < questions.length - 1) focusCell(row + 1, col)
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault()
      onSetAnswer(student.key, q.code, null)
    }
  }

  const stageRow = label => (
    <tr className={styles.stageRow}>
      <td colSpan={4 + students.length + extraCol}>{label}</td>
    </tr>
  )

  return (
    <div className={styles.gridWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={`${styles.colCode} ${styles.sticky}`}>코드</th>
            <th className={`${styles.colQuestion} ${styles.sticky}`}>질문</th>
            <th className={`${styles.colOption1} ${styles.sticky}`}>①</th>
            <th className={`${styles.colOption2} ${styles.sticky}`}>②</th>
            {students.map((s, i) => {
              const label = studentLabel(s, i)
              const err = nameError(i)
              return (
                <th key={s.key} className={styles.studentHead}>
                  {badges[s.key] && <span className={styles.badge}>{badges[s.key]}</span>}
                  {readOnly ? (
                    <span ref={setRef(`name:${s.key}`)} className={styles.studentName} title={err?.message}>
                      {s.nickname || '(이름 없음)'}
                    </span>
                  ) : (
                    <input
                      ref={setRef(`name:${s.key}`)}
                      aria-label={`학생 ${i + 1} 이름`}
                      className={`${styles.nameInput} ${err ? styles.invalid : ''}`}
                      title={err?.message}
                      value={s.nickname}
                      placeholder={`학생 ${i + 1}`}
                      onChange={e => onSetName(s.key, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusCell(0, i) } }}
                    />
                  )}
                  {readOnly && s.memo && <span className={styles.memoText} title={s.memo}>메모</span>}
                  {!readOnly && (
                    <div className={styles.studentTools}>
                      <button
                        type="button"
                        aria-label={`${label} 메모`}
                        className={s.memo ? styles.memoOn : ''}
                        onClick={() => setMemoOpen(memoOpen === s.key ? null : s.key)}
                      >✎</button>
                      <button type="button" aria-label={`${label} 삭제`} onClick={() => onRemove(s.key)}>×</button>
                    </div>
                  )}
                  {!readOnly && memoOpen === s.key && (
                    <textarea
                      aria-label={`${label} 메모 입력`}
                      className={styles.memoBox}
                      value={s.memo}
                      onChange={e => onSetMemo(s.key, e.target.value)}
                    />
                  )}
                </th>
              )
            })}
            {!readOnly && (
              <th className={styles.addCol}>
                <button type="button" onClick={onAdd}>+ 학생</button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {questions.map((q, row) => (
            <Fragment key={q.code}>
              {row === 0 && stageRow('1단계')}
              {row === firstStage2 && stageRow('2단계')}
              <tr>
                <th scope="row" className={`${styles.colCode} ${styles.sticky}`}>{q.code}</th>
                <td className={`${styles.colQuestion} ${styles.sticky}`}>{q.question}</td>
                <td className={`${styles.colOption1} ${styles.sticky}`}>{q.option1}</td>
                <td className={`${styles.colOption2} ${styles.sticky}`}>{q.option2}</td>
                {students.map((s, col) => {
                  const value = s.answers[q.code]
                  const err = answerError(col, q.code)
                  const empty = value === null || value === undefined
                  const className = [styles.answer, empty && styles.missing, err && styles.invalid].filter(Boolean).join(' ')
                  const title = err?.message ?? (value === 1 ? q.option1 : value === 2 ? q.option2 : '미응답')
                  return (
                    <td key={s.key} className={styles.answerCell}>
                      {readOnly ? (
                        <span className={className} title={title}>{display(value)}</span>
                      ) : (
                        <button
                          type="button"
                          ref={setRef(`${row}:${col}`)}
                          aria-label={`${studentLabel(s, col)} ${q.code}`}
                          className={className}
                          title={title}
                          onClick={() => onCycle(s.key, q.code)}
                          onKeyDown={e => handleCellKey(e, row, col, s, q)}
                        >{display(value)}</button>
                      )}
                    </td>
                  )
                })}
                {!readOnly && <td />}
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4} className={styles.sticky}>시민권</th>
            {results.map((r, i) => <td key={students[i].key} className={styles.summary}>{r.citizenType ?? '–'}</td>)}
            {!readOnly && <td />}
          </tr>
          <tr>
            <th colSpan={4} className={styles.sticky}>여권</th>
            {results.map((r, i) => (
              <td key={students[i].key} className={styles.summary}>
                {r.passportType ?? <span className={styles.followUp}>보충 필요</span>}
              </td>
            ))}
            {!readOnly && <td />}
          </tr>
          <tr>
            <th colSpan={4} className={styles.sticky}>미응답</th>
            {results.map((r, i) => (
              <td key={students[i].key} className={styles.summary} title={r.missingCodes.join(', ')}>
                {r.missingCodes.length}
              </td>
            ))}
            {!readOnly && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: 스타일 작성**

`src/features/eftiRecord/EftiRecord.module.css`:

```css
/* EFTI 성향기록 화면 전체 스타일. 색은 index.css 의 --admin-* 변수를 쓴다. */
.page { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.title { margin: 0; font-size: 22px; font-weight: 700; color: var(--admin-text); }
.tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--admin-border); }
.tab { padding: 10px 16px; border: none; background: none; font-size: 15px; color: var(--admin-text-2); cursor: pointer; border-bottom: 2px solid transparent; }
.tabActive { color: var(--admin-blue); border-bottom-color: var(--admin-blue); font-weight: 600; }

.toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 12px; padding: 16px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--admin-text-2); }
.field input, .field select { height: 36px; padding: 0 10px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input-bg); font-size: 14px; color: var(--admin-text); }
.field input[readonly] { color: var(--admin-text-3); }
.spacer { flex: 1; }
.button { height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--admin-border); background: var(--admin-surface); font-size: 14px; cursor: pointer; color: var(--admin-text); }
.button:disabled { opacity: 0.45; cursor: not-allowed; }
.primary { background: var(--admin-blue); border-color: var(--admin-blue); color: #fff; }
.danger { color: #d64545; }
.status { margin: 0; font-size: 14px; }
.statusOk { color: var(--admin-blue); }
.statusError { color: #d64545; }
.hiddenInput { display: none; }

.gridWrap { overflow: auto; max-height: calc(100vh - 300px); border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-surface); }
.grid { border-collapse: separate; border-spacing: 0; font-size: 13px; color: var(--admin-text); }
.grid th, .grid td { border-bottom: 1px solid var(--admin-border); border-right: 1px solid var(--admin-border); padding: 4px 6px; background: var(--admin-surface); }
.grid thead th { position: sticky; top: 0; z-index: 2; background: var(--admin-icon-bg); vertical-align: top; }
.grid tfoot th, .grid tfoot td { position: sticky; bottom: 0; z-index: 2; background: var(--admin-blue-soft); font-weight: 600; }
.grid tfoot tr:nth-child(1) th, .grid tfoot tr:nth-child(1) td { bottom: 56px; }
.grid tfoot tr:nth-child(2) th, .grid tfoot tr:nth-child(2) td { bottom: 28px; }
.sticky { position: sticky; z-index: 1; }
.grid thead .sticky, .grid tfoot .sticky { z-index: 3; }
.colCode { left: 0; width: 52px; min-width: 52px; text-align: center; }
.colQuestion { left: 52px; width: 200px; min-width: 200px; }
.colOption1 { left: 252px; width: 160px; min-width: 160px; color: var(--admin-text-2); }
.colOption2 { left: 412px; width: 160px; min-width: 160px; color: var(--admin-text-2); }
.grid tfoot th.sticky { left: 0; text-align: right; }
.stageRow td { background: var(--admin-purple-tint); color: var(--admin-purple); font-weight: 700; text-align: left; padding-left: 12px; }

.studentHead { min-width: 92px; width: 92px; }
.nameInput { width: 100%; box-sizing: border-box; height: 28px; border: 1px solid var(--admin-border); border-radius: 6px; padding: 0 6px; font-size: 13px; }
.studentName { display: block; font-weight: 600; }
.studentTools { display: flex; justify-content: center; gap: 4px; margin-top: 4px; }
.studentTools button { border: none; background: none; cursor: pointer; color: var(--admin-text-3); font-size: 14px; }
.memoOn { color: var(--admin-orange) !important; }
.memoBox { width: 100%; box-sizing: border-box; min-height: 56px; margin-top: 4px; font-size: 12px; }
.memoText { display: inline-block; margin-top: 2px; font-size: 11px; color: var(--admin-orange); }
.badge { display: inline-block; margin-bottom: 4px; padding: 1px 6px; border-radius: 999px; background: var(--admin-blue-soft); color: var(--admin-blue); font-size: 11px; font-weight: 600; }
.addCol { min-width: 80px; }
.addCol button { border: 1px dashed var(--admin-blue-line); background: none; color: var(--admin-blue); border-radius: 6px; padding: 4px 8px; cursor: pointer; }

.answerCell { text-align: center; padding: 2px !important; }
.answer { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 26px; border: 1px solid transparent; border-radius: 6px; background: none; font-size: 15px; cursor: pointer; color: var(--admin-text); }
.answer:focus { outline: 2px solid var(--admin-blue); outline-offset: -2px; }
.missing { background: var(--admin-yellow-tint); }
.invalid { border-color: #d64545 !important; background: #fdecec; }
.summary { text-align: center; }
.followUp { display: inline-block; padding: 1px 6px; border-radius: 999px; background: #fdecec; color: #d64545; font-size: 11px; font-weight: 600; }

.overlay { position: fixed; inset: 0; z-index: 50; background: rgba(15, 20, 40, 0.45); display: flex; align-items: center; justify-content: center; padding: 24px; }
.modal { background: var(--admin-surface); border-radius: 16px; padding: 20px; width: min(1200px, 100%); max-height: 100%; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
.modal h2 { margin: 0; font-size: 18px; }
.modalActions { display: flex; justify-content: flex-end; gap: 8px; }
.errorList { margin: 0; padding: 10px 10px 10px 28px; max-height: 120px; overflow: auto; background: #fdecec; color: #d64545; border-radius: 8px; font-size: 13px; }

.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 14px; height: 36px; }
.resultsTable { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--admin-surface); }
.resultsTable th, .resultsTable td { padding: 8px 10px; border-bottom: 1px solid var(--admin-border); text-align: left; white-space: nowrap; }
.resultsTable th { background: var(--admin-icon-bg); color: var(--admin-text-2); font-weight: 600; }
.resultsTable tbody tr { cursor: pointer; }
.resultsTable tbody tr:hover td { background: var(--admin-blue-soft); }
.rowFollowUp td { background: #fff7f7; }
.empty { padding: 32px; text-align: center; color: var(--admin-text-3); }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/SheetGrid.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/features/eftiRecord/SheetGrid.jsx src/features/eftiRecord/SheetGrid.test.jsx src/features/eftiRecord/EftiRecord.module.css
git commit -m "feat: add EFTI record sheet grid with keyboard input"
```

---

### Task 12: 업로드 미리보기 (`UploadPreview.jsx`)

**Files:**
- Create: `src/features/eftiRecord/UploadPreview.jsx`
- Test: `src/features/eftiRecord/UploadPreview.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/UploadPreview.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadPreview from './UploadPreview'
import * as api from './api'
import { emptyAnswers } from '../../../shared/eftiRecord/sheetFormat.js'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

vi.mock('./api')

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const PREVIEW = {
  header: HEADER,
  existingSheet: true,
  errors: [],
  students: [
    { nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1), status: 'overwrite', existingId: 'r1', changedCount: 3 },
    { nickname: '서연', memo: '결석', answers: emptyAnswers(QUESTIONS), status: 'new', existingId: null, changedCount: 0 },
  ],
}

beforeEach(() => vi.clearAllMocks())

describe('UploadPreview', () => {
  it('헤더 요약, 학생별 배지와 유형을 보여준다', () => {
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('햇살반 · 토 10:00 · 2026-11-23 · 선생님 kim · 학생 2명')).toBeInTheDocument()
    expect(screen.getByText('덮어쓰기 (바뀐 문항 3개)')).toBeInTheDocument()
    expect(screen.getByText('새로 추가')).toBeInTheDocument()
    expect(screen.getByText('PASN')).toBeInTheDocument()
  })

  it('오류가 있으면 셀 주소와 함께 보여주고 저장을 막는다', () => {
    const preview = { ...PREVIEW, errors: [{ code: 'INVALID_ANSWER', message: '1 또는 2만 입력할 수 있어요', cell: 'F10', studentIndex: 0, questionCode: '03' }] }
    render(<UploadPreview questions={QUESTIONS} preview={preview} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('F10: 1 또는 2만 입력할 수 있어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('저장은 덮어쓸 학생에 existingId 를 id 로 보내고 onSaved 를 부른다', async () => {
    const user = userEvent.setup()
    const saved = { header: HEADER, students: [] }
    api.saveSheet.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={vi.fn()} onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: '저장' }))
    const payload = api.saveSheet.mock.calls[0][0]
    expect(payload.original).toBeNull()
    expect(payload.deleteIds).toEqual([])
    expect(payload.students[0]).toMatchObject({ id: 'r1', nickname: '민준' })
    expect(payload.students[1]).not.toHaveProperty('id')
    expect(onSaved).toHaveBeenCalledWith(saved)
  })

  it('저장 실패 메시지를 보여준다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockRejectedValue({ errors: [{ code: 'SHEET_EXISTS', message: '이미 있어요' }] })
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 있어요')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/UploadPreview.test.jsx`
Expected: FAIL — `Failed to resolve import "./UploadPreview"`

- [ ] **Step 3: 구현**

`src/features/eftiRecord/UploadPreview.jsx`:

```jsx
import { useMemo, useState } from 'react'
import * as api from './api'
import SheetGrid from './SheetGrid'
import { computeResult } from '../../../shared/eftiRecord/scoring.js'
import styles from './EftiRecord.module.css'

export default function UploadPreview({ questions, preview, onCancel, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const students = useMemo(() => preview.students.map((s, i) => ({ ...s, key: `u${i}` })), [preview])
  const results = useMemo(() => students.map(s => computeResult(s.answers, questions)), [students, questions])
  const badges = Object.fromEntries(students.map(s => [
    s.key, s.status === 'overwrite' ? `덮어쓰기 (바뀐 문항 ${s.changedCount}개)` : '새로 추가',
  ]))
  const h = preview.header
  const hasErrors = preview.errors.length > 0

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.saveSheet({
        original: null,
        header: h,
        students: preview.students.map(s => ({
          ...(s.existingId ? { id: s.existingId } : {}), nickname: s.nickname, memo: s.memo, answers: s.answers,
        })),
        deleteIds: [],
      })
      onSaved(saved)
    } catch (err) {
      setError(err?.errors?.[0]?.message ?? '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="업로드 미리보기">
        <h2>업로드 미리보기</h2>
        <p className={styles.status}>
          {[h.className || '(반 이름 없음)', h.classTime || '(수업시간 없음)', h.completedOn || '(날짜 없음)', `선생님 ${h.teacherName}`, `학생 ${students.length}명`].join(' · ')}
        </p>
        {hasErrors && (
          <ul className={styles.errorList} aria-label="업로드 오류">
            {preview.errors.map((e, i) => <li key={i}>{e.cell ? `${e.cell}: ` : ''}{e.message}</li>)}
          </ul>
        )}
        {students.length > 0 && (
          <SheetGrid readOnly questions={questions} students={students} results={results} errors={preview.errors} badges={badges} />
        )}
        {error && <p role="alert" className={`${styles.status} ${styles.statusError}`}>{error}</p>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.button} onClick={onCancel}>취소</button>
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={hasErrors || saving} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/UploadPreview.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/eftiRecord/UploadPreview.jsx src/features/eftiRecord/UploadPreview.test.jsx
git commit -m "feat: add EFTI record upload preview"
```

---

### Task 13: 입력 탭 (`SheetEditor.jsx`)

**Files:**
- Create: `src/features/eftiRecord/SheetEditor.jsx`
- Test: `src/features/eftiRecord/SheetEditor.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/SheetEditor.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SheetEditor from './SheetEditor'
import * as api from './api'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

vi.mock('./api')

const QUESTIONS = loadSeedQuestions()
const PROFILE = { username: 'kim', isSuper: false }
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const SHEET = {
  header: HEADER,
  students: [
    { id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) },
    { id: 'r2', nickname: '서연', memo: '결석', answers: allAnswers(QUESTIONS, 2) },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchSheets.mockResolvedValue([{ header: HEADER, studentCount: 2, needsFollowUpCount: 0 }])
  api.fetchSheet.mockResolvedValue(SHEET)
})

async function fillHeader(user) {
  await user.type(screen.getByLabelText('반 이름'), '햇살반')
  await user.type(screen.getByLabelText('수업시간'), '토 10:00')
  fireEvent.change(screen.getByLabelText('수업 날짜'), { target: { value: '2026-11-23' } })
}

describe('SheetEditor', () => {
  it('선생님 칸은 로그인 계정으로 채워지고 수정할 수 없다', async () => {
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    const teacher = screen.getByLabelText('선생님')
    expect(teacher).toHaveValue('kim')
    expect(teacher).toHaveAttribute('readonly')
    await waitFor(() => expect(api.fetchSheets).toHaveBeenCalled())
  })

  it('헤더와 학생을 채우면 저장이 켜지고, 저장 결과로 다시 채운다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockResolvedValue({ header: HEADER, students: [{ id: 'r9', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }] })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    const save = screen.getByRole('button', { name: '저장' })
    expect(save).toBeDisabled()
    await fillHeader(user)
    await user.type(screen.getByLabelText('학생 1 이름'), '민준')
    await user.click(screen.getByRole('button', { name: '민준 01' }))
    expect(save).toBeEnabled()
    await user.click(save)
    const payload = api.saveSheet.mock.calls[0][0]
    expect(payload.original).toBeNull()
    expect(payload.header).toEqual(HEADER)
    expect(payload.students[0]).toMatchObject({ nickname: '민준' })
    expect(payload.students[0].answers['01']).toBe(1)
    expect(await screen.findByText('학생 1명을 저장했어요')).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  it('target 으로 기록지를 열고, 저장된 학생 열을 지우면 확인 후 deleteIds 로 보낸다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockResolvedValue({ header: HEADER, students: [SHEET.students[0]] })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} target={{ header: HEADER, nickname: '서연' }} />)
    expect(await screen.findByDisplayValue('서연')).toBeInTheDocument()
    expect(api.fetchSheet).toHaveBeenCalledWith(HEADER)
    await user.click(screen.getByRole('button', { name: '서연 삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.queryByDisplayValue('서연')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '저장' }))
    const payload = api.saveSheet.mock.calls[0][0]
    expect(payload.original).toEqual(HEADER)
    expect(payload.deleteIds).toEqual(['r2'])
  })

  it('서버 오류 메시지를 보여준다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockRejectedValue({ errors: [{ code: 'SHEET_EXISTS', message: '같은 기록지가 이미 있어요' }] })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} target={{ header: HEADER }} />)
    await screen.findByDisplayValue('민준')
    await user.clear(screen.getByLabelText('수업시간'))
    await user.type(screen.getByLabelText('수업시간'), '토 11:00')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('같은 기록지가 이미 있어요')).toBeInTheDocument()
  })

  it('저장하지 않은 변경이 있으면 다른 기록지를 열기 전에 묻는다', async () => {
    const user = userEvent.setup()
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    await user.type(screen.getByLabelText('반 이름'), 'x')
    const select = await screen.findByRole('combobox', { name: '기존 기록지 열기' })
    await waitFor(() => expect(select.options.length).toBe(2))
    await user.selectOptions(select, '0')
    expect(screen.getByText('저장하지 않은 내용이 있어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '계속' }))
    expect(await screen.findByDisplayValue('민준')).toBeInTheDocument()
  })

  it('파일을 고르면 업로드 미리보기를 띄운다', async () => {
    const user = userEvent.setup()
    api.uploadFile.mockResolvedValue({ header: HEADER, students: [], errors: [], existingSheet: false })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    await user.upload(screen.getByLabelText('업로드 파일'), new File(['x'], 'sheet.xlsx'))
    expect(await screen.findByRole('dialog', { name: '업로드 미리보기' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/SheetEditor.test.jsx`
Expected: FAIL — `Failed to resolve import "./SheetEditor"`

- [ ] **Step 3: 구현**

`src/features/eftiRecord/SheetEditor.jsx`:

```jsx
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as api from './api'
import SheetGrid from './SheetGrid'
import UploadPreview from './UploadPreview'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { sheetReducer, initialSheetState, loadedSheetState, toSavePayload } from './sheetState'
import { computeResult } from '../../../shared/eftiRecord/scoring.js'
import { validateSheet } from '../../../shared/eftiRecord/validation.js'
import { isBlankStudent } from '../../../shared/eftiRecord/sheetFormat.js'
import styles from './EftiRecord.module.css'

const FIELD_LABELS = { teacherName: '선생님', className: '반 이름', classTime: '수업시간', completedOn: '수업 날짜' }
const unique = values => [...new Set(values.filter(Boolean))]

export function sheetLabel(sheet, showTeacher) {
  const h = sheet.header
  const parts = [h.completedOn, h.className, h.classTime, `${sheet.studentCount}명`]
  if (showTeacher) parts.push(h.teacherName)
  if (sheet.needsFollowUpCount) parts.push(`보충 ${sheet.needsFollowUpCount}`)
  return parts.join(' · ')
}

function describeError(e, students) {
  const where = e.field
    ? FIELD_LABELS[e.field]
    : e.studentIndex !== undefined
      ? `${String(students[e.studentIndex]?.nickname ?? '').trim() || `학생 ${e.studentIndex + 1}`}${e.questionCode ? ` ${e.questionCode}` : ''}`
      : ''
  return where ? `${where}: ${e.message}` : e.message
}

export default function SheetEditor({ questions, profile, target = null, onDirtyChange }) {
  const [state, dispatch] = useReducer(sheetReducer, undefined, () => initialSheetState(questions, profile.username))
  const [sheets, setSheets] = useState([])
  const [serverErrors, setServerErrors] = useState([])
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [preview, setPreview] = useState(null)
  const [focusKey, setFocusKey] = useState(null)
  const fileRef = useRef(null)

  const refreshSheets = useCallback(() => {
    api.fetchSheets().then(setSheets).catch(() => setSheets([]))
  }, [])

  useEffect(() => { refreshSheets() }, [refreshSheets])
  useEffect(() => { onDirtyChange?.(state.dirty) }, [state.dirty, onDirtyChange])
  useEffect(() => {
    if (!state.dirty) return undefined
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.dirty])

  const results = useMemo(() => state.students.map(s => computeResult(s.answers, questions)), [state.students, questions])
  const errors = useMemo(() => validateSheet(state, questions), [state, questions])
  const shownErrors = serverErrors.length ? serverErrors : (state.dirty ? errors : [])
  const headerError = field => shownErrors.find(e => e.field === field)

  const edit = action => { setServerErrors([]); setStatus(null); dispatch(action) }

  function resetTo(next, focusNickname = null) {
    dispatch({ type: 'reset', state: next })
    setServerErrors([])
    setFocusKey(next.students.find(s => s.nickname === focusNickname)?.key ?? null)
  }

  function guard(action) {
    if (!state.dirty) return action()
    setConfirm({
      title: '저장하지 않은 내용이 있어요',
      description: '계속하면 입력한 내용이 사라져요.',
      confirmLabel: '계속',
      onConfirm: action,
    })
  }

  const openSheet = useCallback(async (header, nickname = null) => {
    try {
      const sheet = await api.fetchSheet(header)
      resetTo(loadedSheetState(sheet.header, sheet.students), nickname)
      setStatus(null)
    } catch (err) {
      setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '기록지를 열지 못했어요' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (target) openSheet(target.header, target.nickname ?? null)
  }, [target, openSheet])

  async function save() {
    setSaving(true)
    setServerErrors([])
    try {
      const saved = await api.saveSheet(toSavePayload(state))
      resetTo(loadedSheetState(saved.header, saved.students))
      setStatus({ tone: 'ok', text: `학생 ${saved.students.length}명을 저장했어요` })
      refreshSheets()
    } catch (err) {
      setServerErrors(err?.errors ?? [])
      setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '저장하지 못했어요' })
    } finally {
      setSaving(false)
    }
  }

  function removeStudent(key) {
    const index = state.students.findIndex(s => s.key === key)
    const student = state.students[index]
    const run = () => edit({ type: 'removeStudent', key })
    if (!student.id && isBlankStudent(student)) return run()
    setConfirm({
      title: `${String(student.nickname).trim() || `학생 ${index + 1}`} 열을 지울까요?`,
      description: student.id ? '저장하면 이 학생 기록이 삭제돼요.' : '입력한 내용이 사라져요.',
      confirmLabel: '삭제',
      onConfirm: run,
    })
  }

  function deleteCurrentSheet() {
    setConfirm({
      title: '기록지를 삭제할까요?',
      description: `${sheetLabel({ header: state.original, studentCount: state.students.length }, false)} 기록지의 모든 학생 기록이 삭제돼요.`,
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await api.deleteSheet(state.original)
          resetTo(initialSheetState(questions, profile.username))
          setStatus({ tone: 'ok', text: '기록지를 삭제했어요' })
          refreshSheets()
        } catch (err) {
          setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '삭제하지 못했어요' })
        }
      },
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPreview(await api.uploadFile(file))
    } catch (err) {
      setStatus({ tone: 'error', text: err?.errors?.[0]?.message ?? '파일을 읽지 못했어요' })
    }
  }

  function handleUploaded(saved) {
    setPreview(null)
    resetTo(loadedSheetState(saved.header, saved.students))
    setStatus({ tone: 'ok', text: `업로드한 기록지를 저장했어요 (학생 ${saved.students.length}명)` })
    refreshSheets()
  }

  const headerInput = (field, props = {}) => (
    <label className={styles.field}>
      {FIELD_LABELS[field]}
      <input
        value={state.header[field]}
        onChange={e => edit({ type: 'setHeader', field, value: e.target.value })}
        className={headerError(field) ? styles.invalid : ''}
        title={headerError(field)?.message}
        {...props}
      />
    </label>
  )

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={styles.button} onClick={() => guard(() => resetTo(initialSheetState(questions, profile.username)))}>
          새 기록지
        </button>
        <label className={styles.field}>
          기존 기록지
          <select
            aria-label="기존 기록지 열기"
            value=""
            onChange={e => {
              const sheet = sheets[Number(e.target.value)]
              if (sheet) guard(() => openSheet(sheet.header))
            }}
          >
            <option value="">기존 기록지 열기</option>
            {sheets.map((s, i) => <option key={i} value={i}>{sheetLabel(s, profile.isSuper)}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          선생님
          <input value={state.header.teacherName} readOnly />
        </label>
        {headerInput('className', { list: 'efti-class-names' })}
        {headerInput('classTime', { list: 'efti-class-times', placeholder: '토 10:00' })}
        {headerInput('completedOn', { type: 'date' })}
        <datalist id="efti-class-names">
          {unique(sheets.map(s => s.header.className)).map(v => <option key={v} value={v} />)}
        </datalist>
        <datalist id="efti-class-times">
          {unique(sheets.map(s => s.header.classTime)).map(v => <option key={v} value={v} />)}
        </datalist>
        <div className={styles.spacer} />
        <button type="button" className={styles.button} onClick={() => api.downloadTemplate().catch(() => setStatus({ tone: 'error', text: '템플릿을 받지 못했어요' }))}>
          엑셀 템플릿 받기
        </button>
        <button type="button" className={styles.button} onClick={() => guard(() => fileRef.current?.click())}>
          파일 업로드
        </button>
        <input
          ref={fileRef}
          type="file"
          aria-label="업로드 파일"
          accept=".xlsx,.csv"
          className={styles.hiddenInput}
          onChange={handleFile}
        />
        {state.original && (
          <button type="button" className={`${styles.button} ${styles.danger}`} onClick={deleteCurrentSheet}>
            기록지 삭제
          </button>
        )}
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={!state.dirty || errors.length > 0 || saving}
          onClick={save}
        >
          저장
        </button>
      </div>

      {status && (
        <p role="status" className={`${styles.status} ${status.tone === 'ok' ? styles.statusOk : styles.statusError}`}>{status.text}</p>
      )}
      {!status && shownErrors.length > 0 && (
        <p className={`${styles.status} ${styles.statusError}`}>
          오류 {shownErrors.length}개 · {describeError(shownErrors[0], state.students)}
        </p>
      )}

      <SheetGrid
        questions={questions}
        students={state.students}
        results={results}
        errors={shownErrors}
        focusKey={focusKey}
        onCycle={(key, code) => edit({ type: 'cycleAnswer', key, code })}
        onSetAnswer={(key, code, value) => edit({ type: 'setAnswer', key, code, value })}
        onSetName={(key, value) => edit({ type: 'setStudentField', key, field: 'nickname', value })}
        onSetMemo={(key, value) => edit({ type: 'setStudentField', key, field: 'memo', value })}
        onRemove={removeStudent}
        onAdd={() => edit({ type: 'addStudent', questions })}
      />

      {preview && (
        <UploadPreview questions={questions} preview={preview} onCancel={() => setPreview(null)} onSaved={handleUploaded} />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          description={confirm.description}
          cancelLabel="취소"
          confirmLabel={confirm.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const run = confirm.onConfirm; setConfirm(null); run() }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/SheetEditor.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/eftiRecord/SheetEditor.jsx src/features/eftiRecord/SheetEditor.test.jsx
git commit -m "feat: add EFTI record sheet editor tab"
```

---

### Task 14: 결과 탭 (`ResultsTable.jsx`)

**Files:**
- Create: `src/features/eftiRecord/ResultsTable.jsx`
- Test: `src/features/eftiRecord/ResultsTable.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/ResultsTable.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResultsTable from './ResultsTable'
import * as api from './api'

vi.mock('./api')

const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const COUNTS = { F: 6, P: 7, A: 13, T: 0, S: 9, E: 4, C: 6, N: 7 }
const ROWS = [
  { recordId: 'r1', header: HEADER, nickname: '민준', memo: null, citizenType: 'PASC', passportType: 'PASN', passportCounts: COUNTS, missingCodes: [] },
  { recordId: 'r2', header: HEADER, nickname: '서연', memo: '결석', citizenType: 'PASC', passportType: null, passportCounts: COUNTS, missingCodes: ['33-2', '46'] },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchSheets.mockResolvedValue([
    { header: HEADER, studentCount: 2, needsFollowUpCount: 1 },
    { header: { ...HEADER, teacherName: 'lee', className: '달님반' }, studentCount: 1, needsFollowUpCount: 0 },
  ])
  api.fetchResults.mockResolvedValue(ROWS)
})

describe('ResultsTable', () => {
  it('학생별 유형·축별 개수·미응답을 보여주고 보충 필요를 표시한다', async () => {
    render(<ResultsTable profile={{ username: 'kim', isSuper: false }} onOpen={vi.fn()} />)
    expect(await screen.findByText('민준')).toBeInTheDocument()
    expect(screen.getByText('PASN')).toBeInTheDocument()
    expect(screen.getAllByText('6:7')[0]).toBeInTheDocument()
    expect(screen.getByText('보충 필요')).toBeInTheDocument()
    expect(screen.getByText('33-2, 46')).toBeInTheDocument()
    expect(screen.getByText('결석')).toBeInTheDocument()
    expect(screen.queryByLabelText('선생님')).not.toBeInTheDocument()
  })

  it('필터를 바꾸면 그 조건으로 다시 조회한다', async () => {
    const user = userEvent.setup()
    render(<ResultsTable profile={{ username: 'kim', isSuper: false }} onOpen={vi.fn()} />)
    await screen.findByText('민준')
    await waitFor(() => expect(screen.getByLabelText('반 이름').options.length).toBe(3))
    await user.selectOptions(screen.getByLabelText('반 이름'), '햇살반')
    await user.click(screen.getByLabelText('보충 필요만'))
    await waitFor(() => expect(api.fetchResults).toHaveBeenLastCalledWith(expect.objectContaining({ className: '햇살반', needsFollowUp: true })))
  })

  it('마스터에게만 선생님 필터가 보인다', async () => {
    render(<ResultsTable profile={{ username: 'admin', isSuper: true }} onOpen={vi.fn()} />)
    await screen.findByText('민준')
    await waitFor(() => expect(screen.getByLabelText('선생님').options.length).toBe(3))
  })

  it('행을 누르면 그 학생 기록지를 연다', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<ResultsTable profile={{ username: 'kim', isSuper: false }} onOpen={onOpen} />)
    await user.click(await screen.findByText('서연'))
    expect(onOpen).toHaveBeenCalledWith({ header: HEADER, nickname: '서연' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/ResultsTable.test.jsx`
Expected: FAIL — `Failed to resolve import "./ResultsTable"`

- [ ] **Step 3: 구현**

`src/features/eftiRecord/ResultsTable.jsx`:

```jsx
import { useEffect, useState } from 'react'
import * as api from './api'
import { AXIS_PAIRS } from '../../../shared/eftiRecord/scoring.js'
import styles from './EftiRecord.module.css'

const EMPTY_FILTERS = { teacherName: '', className: '', classTime: '', completedOn: '', q: '', needsFollowUp: false }
const unique = values => [...new Set(values.filter(Boolean))].sort()

export default function ResultsTable({ profile, onOpen }) {
  const [sheets, setSheets] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { api.fetchSheets().then(setSheets).catch(() => setSheets([])) }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.fetchResults(filters)
      .then(data => { if (!cancelled) { setRows(data); setError(null) } })
      .catch(() => { if (!cancelled) setError('결과를 불러오지 못했어요') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters])

  const set = (field, value) => setFilters(f => ({ ...f, [field]: value }))
  const select = (field, label, values) => (
    <label className={styles.field}>
      {label}
      <select value={filters[field]} onChange={e => set(field, e.target.value)}>
        <option value="">전체</option>
        {values.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  )

  return (
    <>
      <div className={styles.filters}>
        {profile.isSuper && select('teacherName', '선생님', unique(sheets.map(s => s.header.teacherName)))}
        {select('className', '반 이름', unique(sheets.map(s => s.header.className)))}
        {select('classTime', '수업시간', unique(sheets.map(s => s.header.classTime)))}
        {select('completedOn', '수업 날짜', unique(sheets.map(s => s.header.completedOn)).reverse())}
        <label className={styles.field}>
          학생 이름
          <input type="search" value={filters.q} onChange={e => set('q', e.target.value)} placeholder="이름 검색" />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={filters.needsFollowUp} onChange={e => set('needsFollowUp', e.target.checked)} />
          보충 필요만
        </label>
      </div>

      {error && <p className={`${styles.status} ${styles.statusError}`}>{error}</p>}
      <div className={styles.gridWrap}>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>학생</th><th>반</th><th>수업시간</th><th>수업 날짜</th><th>선생님</th>
              <th>시민권</th><th>여권</th>
              {AXIS_PAIRS.map(([a, b]) => <th key={a}>{a}/{b}</th>)}
              <th>미응답</th><th>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.recordId}
                className={r.passportType ? '' : styles.rowFollowUp}
                tabIndex={0}
                onClick={() => onOpen({ header: r.header, nickname: r.nickname })}
                onKeyDown={e => { if (e.key === 'Enter') onOpen({ header: r.header, nickname: r.nickname }) }}
              >
                <td>{r.nickname}</td>
                <td>{r.header.className}</td>
                <td>{r.header.classTime}</td>
                <td>{r.header.completedOn}</td>
                <td>{r.header.teacherName}</td>
                <td>{r.citizenType ?? '–'}</td>
                <td>{r.passportType ?? <span className={styles.followUp}>보충 필요</span>}</td>
                {AXIS_PAIRS.map(([a, b]) => <td key={a}>{r.passportCounts[a]}:{r.passportCounts[b]}</td>)}
                <td>{r.missingCodes.join(', ')}</td>
                <td>{r.memo ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <p className={styles.empty}>조건에 맞는 기록이 없어요</p>}
      </div>
    </>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/ResultsTable.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/eftiRecord/ResultsTable.jsx src/features/eftiRecord/ResultsTable.test.jsx
git commit -m "feat: add EFTI record results table"
```

---

### Task 15: 메뉴 진입 화면 + 관리자 메뉴 연결

**Files:**
- Create: `src/features/eftiRecord/EftiRecordPage.jsx`
- Test: `src/features/eftiRecord/EftiRecordPage.test.jsx`
- Modify: `src/components/admin/adminNavItems.js`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/eftiRecord/EftiRecordPage.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EftiRecordPage from './EftiRecordPage'
import * as api from './api'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

vi.mock('./api')

const QUESTIONS = loadSeedQuestions()
const PROFILE = { username: 'kim', isSuper: false }
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchQuestions.mockResolvedValue(QUESTIONS)
  api.fetchSheets.mockResolvedValue([])
  api.fetchResults.mockResolvedValue([
    { recordId: 'r1', header: HEADER, nickname: '민준', memo: null, citizenType: 'PASC', passportType: 'PASN', passportCounts: { F: 6, P: 7, A: 13, T: 0, S: 9, E: 4, C: 6, N: 7 }, missingCodes: [] },
  ])
  api.fetchSheet.mockResolvedValue({ header: HEADER, students: [{ id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }] })
})

describe('EftiRecordPage', () => {
  it('문항을 불러와 입력 탭을 먼저 보여준다', async () => {
    render(<EftiRecordPage profile={PROFILE} />)
    expect(await screen.findByText('더 멋진 사람은?')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '입력' })).toHaveAttribute('aria-selected', 'true')
  })

  it('결과 탭에서 행을 누르면 입력 탭에서 그 기록지를 연다', async () => {
    const user = userEvent.setup()
    render(<EftiRecordPage profile={PROFILE} />)
    await screen.findByText('더 멋진 사람은?')
    await user.click(screen.getByRole('tab', { name: '결과' }))
    await user.click(await screen.findByText('민준'))
    expect(screen.getByRole('tab', { name: '입력' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByDisplayValue('민준')).toBeInTheDocument()
    expect(api.fetchSheet).toHaveBeenCalledWith(HEADER)
  })

  it('입력 중에 결과 탭으로 가면 확인을 받는다', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<EftiRecordPage profile={PROFILE} onDirtyChange={onDirtyChange} />)
    await user.type(await screen.findByLabelText('반 이름'), 'x')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('tab', { name: '결과' }))
    expect(screen.getByText('저장하지 않은 내용이 있어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '계속' }))
    expect(screen.getByRole('tab', { name: '결과' })).toHaveAttribute('aria-selected', 'true')
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('문항을 못 불러오면 오류를 보여준다', async () => {
    api.fetchQuestions.mockRejectedValue(new Error('x'))
    render(<EftiRecordPage profile={PROFILE} />)
    expect(await screen.findByText('문항을 불러오지 못했어요. Exposed schemas 설정을 확인해 주세요')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/eftiRecord/EftiRecordPage.test.jsx`
Expected: FAIL — `Failed to resolve import "./EftiRecordPage"`

- [ ] **Step 3: 페이지 구현**

`src/features/eftiRecord/EftiRecordPage.jsx`:

```jsx
// 관리자 메뉴 "EFTI 성향기록": [입력] [결과] 두 탭.
import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import SheetEditor from './SheetEditor'
import ResultsTable from './ResultsTable'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import styles from './EftiRecord.module.css'

const TABS = [
  { key: 'input', label: '입력' },
  { key: 'results', label: '결과' },
]

export default function EftiRecordPage({ profile, onDirtyChange }) {
  const [tab, setTab] = useState('input')
  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState(null)
  const [target, setTarget] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState(null)

  useEffect(() => {
    api.fetchQuestions()
      .then(setQuestions)
      .catch(() => setError('문항을 불러오지 못했어요. Exposed schemas 설정을 확인해 주세요'))
  }, [])

  const handleDirty = useCallback(value => {
    setDirty(value)
    onDirtyChange?.(value)
  }, [onDirtyChange])

  function goTo(next) {
    if (next !== 'input') handleDirty(false)
    setTab(next)
  }

  function switchTab(next) {
    if (next === tab) return
    if (dirty) setPendingTab(next)
    else goTo(next)
  }

  function openFromResults(t) {
    setTarget(t)
    goTo('input')
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>EFTI 성향기록</h1>
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className={`${styles.status} ${styles.statusError}`}>{error}</p>}
      {questions && tab === 'input' && (
        <SheetEditor questions={questions} profile={profile} target={target} onDirtyChange={handleDirty} />
      )}
      {questions && tab === 'results' && <ResultsTable profile={profile} onOpen={openFromResults} />}

      {pendingTab && (
        <ConfirmDialog
          title="저장하지 않은 내용이 있어요"
          description="계속하면 입력한 내용이 사라져요."
          cancelLabel="취소"
          confirmLabel="계속"
          onCancel={() => setPendingTab(null)}
          onConfirm={() => { const next = pendingTab; setPendingTab(null); goTo(next) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/eftiRecord/EftiRecordPage.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 메뉴 항목 추가**

`src/components/admin/adminNavItems.js` 의 `settings` 항목 **바로 위**에 추가:

```js
  // 학생 성향기록지(입력 표가 넓어) PC 전용. 일반 관리자는 자기 기록만 본다.
  { key: 'efti-record', label: 'EFTI 성향기록', icon: '/icons/IconTable.png', mobile: false },
```

- [ ] **Step 6: AdminDashboard 연결**

`src/pages/AdminDashboard.jsx` 를 다음과 같이 바꾼다.

import 추가 (`import AdminAllResults from './AdminAllResults'` 아래):

```jsx
import EftiRecordPage from '../features/eftiRecord/EftiRecordPage'
import ConfirmDialog from '../components/admin/ConfirmDialog'
```

`DESKTOP_ONLY_SECTIONS` 수정:

```jsx
const DESKTOP_ONLY_SECTIONS = ['responses', 'all-results', 'efti-record']
```

`const [section, setSection] = useState('classes')` 아래에 상태 추가:

```jsx
  // EFTI 성향기록 입력 중 저장하지 않은 내용이 있으면 메뉴를 옮기기 전에 묻는다.
  const [eftiDirty, setEftiDirty] = useState(false)
  const [pendingSection, setPendingSection] = useState(null)
```

`handleNavigate` 를 다음으로 바꾼다:

```jsx
  function handleNavigate(key) {
    if ((key === 'team-status' || key === 'ranking') && !selectedClass) return
    if ((key === 'responses' || key === 'all-results') && !profile?.isSuper) return
    if (section === 'efti-record' && eftiDirty && key !== section) {
      setPendingSection(key)
      return
    }
    setSection(key)
  }
```

`{section === 'settings' && ...}` 줄 **바로 위**에 추가:

```jsx
      {!desktopOnly && section === 'efti-record' && (
        <EftiRecordPage profile={profile} onDirtyChange={setEftiDirty} />
      )}
      {pendingSection && (
        <ConfirmDialog
          title="저장하지 않은 내용이 있어요"
          description="다른 메뉴로 가면 입력한 내용이 사라져요."
          cancelLabel="취소"
          confirmLabel="계속"
          onCancel={() => setPendingSection(null)}
          onConfirm={() => {
            setEftiDirty(false)
            setSection(pendingSection)
            setPendingSection(null)
          }}
        />
      )}
```

- [ ] **Step 7: 기존 관리자 테스트 확인**

Run: `npx vitest run src/pages/AdminDashboard src/components/admin`
Expected: PASS. 메뉴 개수를 세는 테스트가 실패하면, 새 메뉴 `EFTI 성향기록` 을 기대값에 더해 고친다 (모바일 탭바 테스트는 `mobile: false` 라 영향이 없어야 한다).

- [ ] **Step 8: Commit**

```bash
git add src/features/eftiRecord/EftiRecordPage.jsx src/features/eftiRecord/EftiRecordPage.test.jsx src/components/admin/adminNavItems.js src/pages/AdminDashboard.jsx
git commit -m "feat: add EFTI record menu to admin mode"
```

(Step 7에서 테스트를 고쳤다면 그 파일도 함께 add 한다.)

---

### Task 16: 전체 검증

**Files:** 없음 (확인만)

- [ ] **Step 1: 전체 테스트**

Run: `npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: `vite build` 성공 (shared/ 를 프론트에서 import 해도 번들에 `node:fs` 가 들어가지 않아야 한다 — `testing/seedQuestions.js` 는 테스트에서만 import)

- [ ] **Step 3: 실제 앱 확인 (Task 5 Step 3 의 DB 적용이 끝난 뒤)**

1. `npm run dev` 실행, 브라우저에서 `/admin` 로그인 (일반 관리자 계정 1개, 마스터 1개)
2. 왼쪽 메뉴 "EFTI 성향기록" → 입력 탭
   - 헤더 입력, 학생 2명 이름 입력, 셀 클릭(빈칸→①→②→빈칸), 키보드 `1`/`2`/`Backspace`/방향키 확인
   - 한 학생을 52문항 모두 채우면 요약 행에 시민권·여권 유형, 다른 학생은 "보충 필요"
   - 저장 → "학생 2명을 저장했어요", Supabase Table Editor `efti_record.records` 에 2행
3. "엑셀 템플릿 받기" → 엑셀에서 열어 1·2 외 값 입력이 막히는지 확인 → 값 채워 "파일 업로드" → 미리보기 배지(새로 추가/덮어쓰기) → 저장
4. 같은 파일을 CSV UTF-8 로 저장해 업로드 → 같은 미리보기
5. 헤더(수업시간)를 바꿔 저장 → 같은 기록지 행이 모두 바뀌는지, 이미 있는 기록지 헤더로 바꾸면 오류 메시지
6. 결과 탭: 필터, 보충 필요만, 행 클릭 → 입력 탭에서 해당 학생 열로 이동
7. 일반 관리자 계정으로 마스터가 만든 기록지가 보이지 않는지, 마스터에게는 선생님 필터가 보이는지
8. 입력 중 다른 메뉴/탭으로 이동 시 확인 대화상자, 모바일 폭에서 "PC에서 이용해 주세요"

- [ ] **Step 4: 마무리**

모든 확인이 끝나면 superpowers:finishing-a-development-branch 로 병합 방식을 정한다.
