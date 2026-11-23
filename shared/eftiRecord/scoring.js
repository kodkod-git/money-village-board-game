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
