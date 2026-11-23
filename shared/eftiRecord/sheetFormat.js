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
